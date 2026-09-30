import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const ciPath = new URL("../.github/workflows/ci.yml", import.meta.url);

type Job = {
	if?: string;
	needs?: string[];
	steps?: Array<{
		run?: string;
		uses?: string;
		with?: Record<string, unknown>;
	}>;
};

describe("CI workflow quality gate", () => {
	const workflow = parse(readFileSync(ciPath, "utf8")) as {
		jobs: Record<string, Job>;
	};

	it("has one aggregate ci-gate over every required quality signal", () => {
		const gate = workflow.jobs["ci-gate"];
		expect(gate).toBeDefined();
		expect(gate?.if).toBe("always()");
		expect(gate?.needs).toEqual(
			expect.arrayContaining([
				"capture-smoke",
				"test",
				"action-smoke",
				"quality",
				"dependency-review",
			]),
		);
	});

	it("runs the full quality command and verifies the committed Action bundle", () => {
		const scripts = (workflow.jobs.quality?.steps ?? [])
			.map((step) => step.run)
			.filter((run): run is string => Boolean(run))
			.join("\n");
		expect(scripts).toContain("npm run quality");
		expect(scripts).toContain("npm run build:action");
		expect(scripts).toContain("git diff --exit-code -- action-dist/index.cjs");
	});
	it("reviews pull-request dependency changes at moderate severity or above", () => {
		const review = workflow.jobs["dependency-review"];
		expect(review?.if).toBe("github.event_name == 'pull_request'");
		const action = review?.steps?.find((step) => step.uses);
		expect(action?.uses).toMatch(
			/^actions\/dependency-review-action@[0-9a-f]{40}$/,
		);
		expect(action?.with?.["fail-on-severity"]).toBe("moderate");
	});
});
