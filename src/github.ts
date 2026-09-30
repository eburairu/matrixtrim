export type WorkflowRun = {
	id: number;
	name: string;
	path: string;
	run_number: number;
	conclusion: string | null;
	created_at: string;
	head_sha: string;
};

export type WorkflowJob = {
	id: number;
	name: string;
	conclusion: string | null;
	started_at: string | null;
	completed_at: string | null;
	labels?: string[];
};

export type CheckRunAnnotation = {
	annotation_level: "notice" | "warning" | "failure" | string;
	message: string;
	title?: string | null;
};

export type IssueComment = {
	id: number;
	body: string | null;
	user: { login: string } | null;
};

export type RepositoryInfo = {
	private: boolean;
	visibility?: "public" | "private" | "internal" | string;
	default_branch?: string;
};

export type PullRequestInfo = {
	number: number;
	html_url: string;
	state: string;
	draft?: boolean;
};

export type GitContent = {
	content: string;
	encoding: string;
	sha: string;
};

export class GitHubHttpError extends Error {
	constructor(
		readonly status: number,
		message: string,
	) {
		super(message);
		this.name = "GitHubHttpError";
	}
}

export type GitHubClientOptions = {
	fetchImpl?: typeof fetch;
	sleep?: (milliseconds: number) => Promise<void>;
	timeoutMs?: number;
	maxRetries?: number;
	retryBaseMs?: number;
	maxRetryDelayMs?: number;
};

const MAX_PAGINATION_PAGES = 1_000;

function defaultSleep(milliseconds: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function retryAfterMilliseconds(response: Response): number | null {
	const retryAfter = response.headers.get("retry-after");
	if (retryAfter) {
		const seconds = Number(retryAfter);
		if (Number.isFinite(seconds) && seconds >= 0) {
			return seconds * 1_000;
		}
		const timestamp = Date.parse(retryAfter);
		if (Number.isFinite(timestamp)) {
			return Math.max(0, timestamp - Date.now());
		}
	}

	if (response.headers.get("x-ratelimit-remaining") === "0") {
		const reset = Number(response.headers.get("x-ratelimit-reset"));
		if (Number.isFinite(reset) && reset > 0) {
			return Math.max(0, reset * 1_000 - Date.now());
		}
	}

	return null;
}

function repoPath(repo: string): string {
	const parts = repo.split("/");
	if (parts.length !== 2 || parts.some((part) => !part)) {
		throw new Error("repository must be in owner/repo form");
	}
	return parts.map(encodeURIComponent).join("/");
}

function refPath(ref: string): string {
	return ref.split("/").filter(Boolean).map(encodeURIComponent).join("/");
}

export class GitHubClient {
	private readonly fetchImpl: typeof fetch;
	private readonly sleep: (milliseconds: number) => Promise<void>;
	private readonly timeoutMs: number;
	private readonly maxRetries: number;
	private readonly retryBaseMs: number;
	private readonly maxRetryDelayMs: number;

	constructor(
		private readonly repo: string,
		private readonly token?: string,
		options: GitHubClientOptions = {},
	) {
		this.fetchImpl = options.fetchImpl ?? fetch;
		this.sleep = options.sleep ?? defaultSleep;
		this.timeoutMs = options.timeoutMs ?? 30_000;
		this.maxRetries = options.maxRetries ?? 4;
		this.retryBaseMs = options.retryBaseMs ?? 500;
		this.maxRetryDelayMs = options.maxRetryDelayMs ?? 30_000;

		if (!Number.isFinite(this.timeoutMs) || this.timeoutMs <= 0) {
			throw new Error("GitHub request timeoutMs must be positive");
		}
		if (!Number.isInteger(this.maxRetries) || this.maxRetries < 0) {
			throw new Error("GitHub maxRetries must be a non-negative integer");
		}
	}

	private headers(): Record<string, string> {
		return {
			Accept: "application/vnd.github+json",
			"User-Agent": "matrixtrim",
			"X-GitHub-Api-Version": "2022-11-28",
			...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
		};
	}

	private retryableResponse(response: Response): boolean {
		if ([429, 500, 502, 503, 504].includes(response.status)) return true;
		return (
			response.status === 403 &&
			(response.headers.has("retry-after") ||
				response.headers.get("x-ratelimit-remaining") === "0")
		);
	}

	private retryDelay(response: Response | null, attempt: number): number {
		const explicit = response ? retryAfterMilliseconds(response) : null;
		const exponential = this.retryBaseMs * 2 ** attempt;
		return Math.min(explicit ?? exponential, this.maxRetryDelayMs);
	}

	private async request<T>(
		path: string,
		init: RequestInit,
		parse: (response: Response) => Promise<T>,
	): Promise<T> {
		const attempts = this.maxRetries + 1;
		let lastError: unknown;

		for (let attempt = 0; attempt < attempts; attempt++) {
			const controller = new AbortController();
			const externalSignal = init.signal;
			const forwardAbort = () => controller.abort();
			if (externalSignal?.aborted) controller.abort();
			else
				externalSignal?.addEventListener("abort", forwardAbort, { once: true });

			const timer = setTimeout(() => controller.abort(), this.timeoutMs);
			let response: Response | null = null;

			try {
				response = await this.fetchImpl(`https://api.github.com${path}`, {
					...init,
					headers: {
						...this.headers(),
						...(init.headers ?? {}),
					},
					signal: controller.signal,
				});

				if (response.ok) {
					return await parse(response);
				}

				const body = await response.text();
				const retryable = this.retryableResponse(response);
				if (!retryable || attempt === attempts - 1) {
					throw new GitHubHttpError(
						response.status,
						`GitHub API ${response.status}: ${body}`,
					);
				}

				const explicitDelay = retryAfterMilliseconds(response);
				if (explicitDelay !== null && explicitDelay > this.maxRetryDelayMs) {
					throw new GitHubHttpError(
						response.status,
						`GitHub API ${response.status}: retry delay ${explicitDelay}ms exceeds ${this.maxRetryDelayMs}ms limit: ${body}`,
					);
				}

				await this.sleep(this.retryDelay(response, attempt));
			} catch (error) {
				if (error instanceof GitHubHttpError) throw error;
				if (response) throw error;

				lastError = error;
				if (attempt === attempts - 1) {
					const timedOut =
						controller.signal.aborted && !externalSignal?.aborted;
					const reason = timedOut
						? `timed out after ${this.timeoutMs}ms`
						: error instanceof Error
							? error.message
							: String(error);
					throw new Error(
						`GitHub API request failed after ${attempts} attempt(s): ${path}: ${reason}`,
						{ cause: error },
					);
				}

				await this.sleep(this.retryDelay(null, attempt));
			} finally {
				clearTimeout(timer);
				externalSignal?.removeEventListener("abort", forwardAbort);
			}
		}

		throw new Error("unreachable GitHub request state", { cause: lastError });
	}

	private async json<T>(path: string, init: RequestInit = {}): Promise<T> {
		return await this.request(
			path,
			init,
			async (response) => (await response.json()) as T,
		);
	}

	async repositoryInfo(): Promise<RepositoryInfo> {
		return await this.json<RepositoryInfo>(`/repos/${repoPath(this.repo)}`);
	}

	async getRun(runId: number): Promise<WorkflowRun> {
		return await this.json<WorkflowRun>(
			`/repos/${repoPath(this.repo)}/actions/runs/${runId}`,
		);
	}

	async listRuns(limit: number, workflow?: string): Promise<WorkflowRun[]> {
		const result: WorkflowRun[] = [];
		const base = workflow
			? `/repos/${repoPath(this.repo)}/actions/workflows/${encodeURIComponent(workflow)}/runs`
			: `/repos/${repoPath(this.repo)}/actions/runs`;

		for (let page = 1; result.length < limit; page++) {
			const perPage = Math.min(100, limit - result.length);
			const data = await this.json<{ workflow_runs: WorkflowRun[] }>(
				`${base}?status=completed&per_page=${perPage}&page=${page}`,
			);
			result.push(...data.workflow_runs);
			if (data.workflow_runs.length < perPage) break;
		}
		return result.slice(0, limit);
	}

	async listJobs(runId: number): Promise<WorkflowJob[]> {
		const result: WorkflowJob[] = [];
		let totalCount: number | null = null;

		for (let page = 1; page <= MAX_PAGINATION_PAGES; page++) {
			const data = await this.json<{
				total_count: number;
				jobs: WorkflowJob[];
			}>(
				`/repos/${repoPath(this.repo)}/actions/runs/${runId}/jobs?filter=all&per_page=100&page=${page}`,
			);
			totalCount ??= data.total_count;
			result.push(...data.jobs);

			if (result.length >= data.total_count) {
				return result.slice(0, data.total_count);
			}
			if (!data.jobs.length) break;
		}

		if (totalCount !== null && result.length < totalCount) {
			throw new Error(
				`GitHub jobs pagination incomplete for run ${runId}: expected ${totalCount}, received ${result.length}`,
			);
		}
		return result;
	}

	async listCheckRunAnnotations(
		checkRunId: number,
	): Promise<CheckRunAnnotation[]> {
		const result: CheckRunAnnotation[] = [];
		for (let page = 1; page <= MAX_PAGINATION_PAGES; page++) {
			const items = await this.json<CheckRunAnnotation[]>(
				`/repos/${repoPath(this.repo)}/check-runs/${checkRunId}/annotations?per_page=100&page=${page}`,
			);
			result.push(...items);
			if (items.length < 100) return result;
		}
		throw new Error(
			`GitHub check annotation pagination exceeded ${MAX_PAGINATION_PAGES} pages for check ${checkRunId}`,
		);
	}

	async file(
		path: string,
		ref?: string,
	): Promise<{ text: string; sha: string }> {
		const encodedPath = path
			.split("/")
			.filter(Boolean)
			.map(encodeURIComponent)
			.join("/");
		const refQuery = ref ? `?ref=${encodeURIComponent(ref)}` : "";
		const data = await this.json<GitContent>(
			`/repos/${repoPath(this.repo)}/contents/${encodedPath}${refQuery}`,
		);
		if (data.encoding !== "base64") {
			throw new Error(`unsupported GitHub content encoding: ${data.encoding}`);
		}
		return {
			text: Buffer.from(data.content.replace(/\n/g, ""), "base64").toString(
				"utf8",
			),
			sha: data.sha,
		};
	}

	async fileText(path: string, ref?: string): Promise<string> {
		return (await this.file(path, ref)).text;
	}

	async refSha(branch: string): Promise<string | null> {
		try {
			const data = await this.json<{ object: { sha: string } }>(
				`/repos/${repoPath(this.repo)}/git/ref/heads/${refPath(branch)}`,
			);
			return data.object.sha;
		} catch (error) {
			if (error instanceof GitHubHttpError && error.status === 404) {
				return null;
			}
			throw error;
		}
	}

	async createBranch(branch: string, sha: string): Promise<void> {
		await this.json(`/repos/${repoPath(this.repo)}/git/refs`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				ref: `refs/heads/${branch}`,
				sha,
			}),
		});
	}

	async updateBranch(branch: string, sha: string): Promise<void> {
		await this.json(
			`/repos/${repoPath(this.repo)}/git/refs/heads/${refPath(branch)}`,
			{
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ sha, force: true }),
			},
		);
	}

	async updateFile(
		path: string,
		branch: string,
		sha: string,
		text: string,
		message: string,
	): Promise<void> {
		const encodedPath = path
			.split("/")
			.filter(Boolean)
			.map(encodeURIComponent)
			.join("/");
		await this.json(`/repos/${repoPath(this.repo)}/contents/${encodedPath}`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				message,
				content: Buffer.from(text, "utf8").toString("base64"),
				sha,
				branch,
			}),
		});
	}

	async listOpenPullRequests(
		branch: string,
		base: string,
	): Promise<PullRequestInfo[]> {
		const owner = this.repo.split("/")[0]!;
		return await this.json<PullRequestInfo[]>(
			`/repos/${repoPath(this.repo)}/pulls?state=open&head=${encodeURIComponent(`${owner}:${branch}`)}&base=${encodeURIComponent(base)}&per_page=20`,
		);
	}

	async createPullRequest(
		title: string,
		head: string,
		base: string,
		body: string,
	): Promise<PullRequestInfo> {
		return await this.json<PullRequestInfo>(
			`/repos/${repoPath(this.repo)}/pulls`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					title,
					head,
					base,
					body,
					draft: true,
				}),
			},
		);
	}

	async updatePullRequest(
		number: number,
		title: string,
		body: string,
	): Promise<PullRequestInfo> {
		return await this.json<PullRequestInfo>(
			`/repos/${repoPath(this.repo)}/pulls/${number}`,
			{
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ title, body }),
			},
		);
	}

	async listIssueComments(issueNumber: number): Promise<IssueComment[]> {
		const result: IssueComment[] = [];
		for (let page = 1; page <= MAX_PAGINATION_PAGES; page++) {
			const items = await this.json<IssueComment[]>(
				`/repos/${repoPath(this.repo)}/issues/${issueNumber}/comments?per_page=100&page=${page}`,
			);
			result.push(...items);
			if (items.length < 100) return result;
		}
		throw new Error(
			`GitHub issue comment pagination exceeded ${MAX_PAGINATION_PAGES} pages for issue ${issueNumber}`,
		);
	}

	async createIssueComment(
		issueNumber: number,
		body: string,
	): Promise<IssueComment> {
		return await this.json<IssueComment>(
			`/repos/${repoPath(this.repo)}/issues/${issueNumber}/comments`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ body }),
			},
		);
	}

	async updateIssueComment(
		commentId: number,
		body: string,
	): Promise<IssueComment> {
		return await this.json<IssueComment>(
			`/repos/${repoPath(this.repo)}/issues/comments/${commentId}`,
			{
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ body }),
			},
		);
	}

	async jobLog(jobId: number): Promise<string> {
		return await this.request(
			`/repos/${repoPath(this.repo)}/actions/jobs/${jobId}/logs`,
			{ redirect: "follow" },
			async (response) => await response.text(),
		);
	}
}
