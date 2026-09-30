import { describe, expect, it } from "vitest";
import { GitHubClient, GitHubHttpError } from "../src/github.js";

function jsonResponse(value: unknown, init: ResponseInit = {}): Response {
	return new Response(JSON.stringify(value), {
		status: init.status ?? 200,
		headers: { "content-type": "application/json", ...(init.headers ?? {}) },
	});
}

describe("GitHubClient", () => {
	it("retries retryable server failures with exponential backoff", async () => {
		let calls = 0;
		const delays: number[] = [];
		const client = new GitHubClient("owner/repo", undefined, {
			fetchImpl: async () => {
				calls++;
				if (calls < 3) return new Response("temporary", { status: 503 });
				return jsonResponse({ private: false });
			},
			sleep: async (ms) => {
				delays.push(ms);
			},
			retryBaseMs: 10,
			maxRetries: 3,
		});

		await expect(client.repositoryInfo()).resolves.toMatchObject({
			private: false,
		});
		expect(calls).toBe(3);
		expect(delays).toEqual([10, 20]);
	});

	it("respects Retry-After for rate limiting", async () => {
		let calls = 0;
		const delays: number[] = [];
		const client = new GitHubClient("owner/repo", undefined, {
			fetchImpl: async () => {
				calls++;
				if (calls === 1) {
					return new Response("slow down", {
						status: 429,
						headers: { "retry-after": "2" },
					});
				}
				return jsonResponse({ private: false });
			},
			sleep: async (ms) => {
				delays.push(ms);
			},
			maxRetries: 1,
			maxRetryDelayMs: 5_000,
		});

		await client.repositoryInfo();
		expect(delays).toEqual([2_000]);
	});
	it("fails fast when a rate-limit reset exceeds the configured wait cap", async () => {
		const client = new GitHubClient("owner/repo", undefined, {
			fetchImpl: async () =>
				new Response("limited", {
					status: 429,
					headers: { "retry-after": "120" },
				}),
			sleep: async () => {},
			maxRetries: 1,
			maxRetryDelayMs: 1_000,
		});

		await expect(client.repositoryInfo()).rejects.toThrow(
			/retry delay .* exceeds/,
		);
	});

	it("times out stalled requests instead of hanging indefinitely", async () => {
		const fetchImpl: typeof fetch = async (_input, init) => {
			return await new Promise<Response>((_resolve, reject) => {
				init?.signal?.addEventListener(
					"abort",
					() => {
						const error = new Error("aborted");
						error.name = "AbortError";
						reject(error);
					},
					{ once: true },
				);
			});
		};
		const client = new GitHubClient("owner/repo", undefined, {
			fetchImpl,
			sleep: async () => {},
			timeoutMs: 5,
			maxRetries: 0,
		});

		await expect(client.repositoryInfo()).rejects.toThrow(
			/timed out after 5ms/,
		);
	});

	it("does not retry ordinary client errors", async () => {
		let calls = 0;
		const client = new GitHubClient("owner/repo", undefined, {
			fetchImpl: async () => {
				calls++;
				return new Response("missing", { status: 404 });
			},
			sleep: async () => {},
		});

		await expect(client.repositoryInfo()).rejects.toBeInstanceOf(
			GitHubHttpError,
		);
		expect(calls).toBe(1);
	});
	it("fetches every workflow job page beyond the old 300-job ceiling", async () => {
		const total = 350;
		const fetchImpl: typeof fetch = async (input) => {
			const url = new URL(String(input));
			const page = Number(url.searchParams.get("page"));
			const start = (page - 1) * 100;
			const count = Math.max(0, Math.min(100, total - start));
			return jsonResponse({
				total_count: total,
				jobs: Array.from({ length: count }, (_, index) => ({
					id: start + index + 1,
					name: `test (${start + index + 1})`,
					conclusion: "success",
					started_at: "2026-01-01T00:00:00Z",
					completed_at: "2026-01-01T00:00:01Z",
				})),
			});
		};
		const client = new GitHubClient("owner/repo", undefined, { fetchImpl });

		const jobs = await client.listJobs(123);
		expect(jobs).toHaveLength(350);
		expect(jobs.at(-1)?.id).toBe(350);
	});

	it("fails closed when GitHub reports more jobs than pagination returns", async () => {
		const fetchImpl: typeof fetch = async (input) => {
			const url = new URL(String(input));
			const page = Number(url.searchParams.get("page"));
			return jsonResponse({
				total_count: 150,
				jobs:
					page === 1
						? Array.from({ length: 100 }, (_, id) => ({
								id,
								name: `job-${id}`,
								conclusion: "success",
								started_at: null,
								completed_at: null,
							}))
						: [],
			});
		};
		const client = new GitHubClient("owner/repo", undefined, { fetchImpl });
		await expect(client.listJobs(123)).rejects.toThrow(/pagination incomplete/);
	});
});
