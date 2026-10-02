import { describe, expect, it } from "vitest";
import {
	captureEvidenceDiagnostic,
	captureRemediation,
	compactDiagnostics,
} from "../src/diagnostics.js";

describe("analysis diagnostics", () => {
	it("compacts repeated diagnostics and keeps a stable occurrence count", () => {
		const diagnostics = compactDiagnostics([
			{
				code: "axis-names-unavailable",
				severity: "warning",
				scope: "cell",
				jobId: "test",
				cell: "test (ubuntu, 22)",
				message: "missing axis names",
			},
			{
				code: "axis-names-unavailable",
				severity: "warning",
				scope: "cell",
				jobId: "test",
				cell: "test (ubuntu, 22)",
				message: "missing axis names",
			},
		]);
		expect(diagnostics).toHaveLength(1);
		expect(diagnostics[0]?.occurrences).toBe(2);
	});

	it("provides capture setup with the permissions needed for later analysis", () => {
		const remediation = captureRemediation("test");
		expect(remediation.permissions).toEqual([
			"actions: read",
			"checks: read",
			"contents: read",
		]);
		expect(remediation.snippet).toContain("mode: capture");
		expect(remediation.snippet).toContain("${{ toJSON(matrix) }}");
	});

	it("distinguishes missing and conflicting capture evidence", () => {
		expect(
			captureEvidenceDiagnostic("missing", "test", "opaque runtime cell"),
		).toMatchObject({
			code: "capture-evidence-missing",
			jobId: "test",
			cell: "opaque runtime cell",
		});
		expect(
			captureEvidenceDiagnostic("conflict", "test", "opaque runtime cell"),
		).toMatchObject({
			code: "capture-evidence-conflict",
			jobId: "test",
			cell: "opaque runtime cell",
		});
	});
});
