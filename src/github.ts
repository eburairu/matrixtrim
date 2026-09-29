export type WorkflowRun = {
  id: number;
  name: string;
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

  private async json<T>(path: string): Promise<T> {
    const response = await fetch(`https://api.github.com${path}`, {
      headers: this.headers(),
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
