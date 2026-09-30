import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const workflowPath = new URL(
	"../.github/workflows/publish-npm.yml",
	import.meta.url,
);

describe("npm publish workflow", () => {
	const source = readFileSync(workflowPath, "utf8");
	const workflow = parse(source) as {
		permissions: Record<string, string>;
		jobs: {
			publish: {
				if: string;
				steps: Array<{
					run?: string;
					uses?: string;
					with?: Record<string, unknown>;
				}>;
			};
		};
	};
	const job = workflow.jobs.publish;
	const scripts = job.steps
		.map((step) => step.run)
		.filter(Boolean)
		.join("\n");

	it("uses short-lived OIDC credentials instead of an npm token", () => {
		expect(workflow.permissions).toEqual({
			contents: "read",
			"id-token": "write",
		});
		expect(source).not.toContain("NPM_TOKEN");
		expect(source).not.toContain("NODE_AUTH_TOKEN");
	});

	it("publishes only a release whose tag matches package.json", () => {
		expect(job.if).toContain("github.repository == 'eburairu/matrixtrim'");
		expect(scripts).toContain('test "$RELEASE_TAG" = "v$VERSION"');
		expect(scripts).toContain("npm run quality");
		expect(scripts).toContain("npm publish --access public --provenance");
	});
});
