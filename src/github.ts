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
};

export type IssueComment = {
  id: number;
  body: string | null;
  user: { login: string } | null;
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

function repoPath(repo: string): string {
  const parts = repo.split("/");
  if (parts.length !== 2 || parts.some((part) => !part)) {
    throw new Error("repository must be in owner/repo form");
  }
  return parts.map(encodeURIComponent).join("/");
}

export class GitHubClient {
  constructor(
    private readonly repo: string,
    private readonly token?: string,
  ) {}

  private headers(): Record<string, string> {
    return {
      Accept: "application/vnd.github+json",
      "User-Agent": "matrixtrim",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
    };
  }

  private async json<T>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const response = await fetch(`https://api.github.com${path}`, {
      ...init,
      headers: {
        ...this.headers(),
        ...(init.headers ?? {}),
      },
    });
    if (!response.ok) {
      throw new GitHubHttpError(
        response.status,
        `GitHub API ${response.status}: ${await response.text()}`,
      );
    }
    return await response.json() as T;
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
    for (let page = 1; page <= 3; page++) {
      const data = await this.json<{ jobs: WorkflowJob[] }>(
        `/repos/${repoPath(this.repo)}/actions/runs/${runId}/jobs?filter=all&per_page=100&page=${page}`,
      );
      result.push(...data.jobs);
      if (data.jobs.length < 100) break;
    }
    return result;
  }

  async fileText(path: string, ref: string): Promise<string> {
    const encodedPath = path
      .split("/")
      .filter(Boolean)
      .map(encodeURIComponent)
      .join("/");
    const data = await this.json<{ content: string; encoding: string }>(
      `/repos/${repoPath(this.repo)}/contents/${encodedPath}?ref=${encodeURIComponent(ref)}`,
    );
    if (data.encoding !== "base64") {
      throw new Error(`unsupported GitHub content encoding: ${data.encoding}`);
    }
    return Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf8");
  }

  async listIssueComments(issueNumber: number): Promise<IssueComment[]> {
    const result: IssueComment[] = [];
    for (let page = 1; page <= 10; page++) {
      const items = await this.json<IssueComment[]>(
        `/repos/${repoPath(this.repo)}/issues/${issueNumber}/comments?per_page=100&page=${page}`,
      );
      result.push(...items);
      if (items.length < 100) break;
    }
    return result;
  }

  async createIssueComment(issueNumber: number, body: string): Promise<IssueComment> {
    return await this.json<IssueComment>(
      `/repos/${repoPath(this.repo)}/issues/${issueNumber}/comments`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      },
    );
  }

  async updateIssueComment(commentId: number, body: string): Promise<IssueComment> {
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
    const response = await fetch(
      `https://api.github.com/repos/${repoPath(this.repo)}/actions/jobs/${jobId}/logs`,
      { headers: this.headers(), redirect: "follow" },
    );
    if (!response.ok) {
      throw new GitHubHttpError(response.status, `job log ${response.status}`);
    }
    return await response.text();
  }
}
