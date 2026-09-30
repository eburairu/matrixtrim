import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const releasePath = new URL("../.github/workflows/release.yml", import.meta.url);

describe("release workflow", () => {
  const source = readFileSync(releasePath, "utf8");
  const workflow = parse(source) as any;
  const job = workflow.jobs.release;
  const runScripts = job.steps
    .map((step: any) => step.run)
    .filter(Boolean)
    .join("\n");

  it("is an explicit main-only promotion workflow", () => {
    expect(workflow.on).toHaveProperty("workflow_dispatch");
    expect(workflow.permissions).toEqual({ contents: "write" });
    expect(job.if).toBe("github.ref == 'refs/heads/main'");
    expect(workflow.concurrency).toMatchObject({
      group: "release",
      "cancel-in-progress": false,
    });
  });

  it("verifies the release inputs before tagging", () => {
    expect(runScripts).toContain("npm run check");
    expect(runScripts).toContain("npm run build:action");
    expect(runScripts).toContain("git diff --exit-code -- action-dist/index.cjs");    expect(runScripts).toContain("package.json");
    expect(runScripts).toContain("package-lock.json");
    expect(runScripts).toContain("test \"$LOCK_VERSION\" = \"$VERSION\"");
    expect(runScripts).toContain("test \"$ROOT_LOCK_VERSION\" = \"$VERSION\"");
  });

  it("keeps exact tags immutable and only moves the major tag", () => {
    expect(runScripts).toContain('git rev-parse "$TAG^{commit}"');
    expect(runScripts).toContain('test "$EXISTING" = "$GITHUB_SHA"');
    expect(runScripts).toContain('git push origin "$TAG"');
    expect(runScripts).not.toContain('git push origin "$TAG" --force');
    expect(runScripts).toContain('git push origin "refs/tags/$MAJOR" --force');
  });

  it("creates a GitHub Release for the exact tag", () => {
    expect(runScripts).toContain("gh release view");
    expect(runScripts).toContain("gh release create");
    expect(runScripts).toContain("--verify-tag");
    expect(runScripts).toContain("--generate-notes");
  });
});
