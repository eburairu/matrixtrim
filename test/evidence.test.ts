import { describe, expect, it } from "vitest";
import { axesFromMatrixEvidence } from "../src/axes.js";
import {
	decodeMatrixEvidence,
	encodeMatrixEvidence,
	MATRIX_EVIDENCE_PREFIX,
} from "../src/evidence.js";

describe("runtime matrix evidence", () => {
	it("round-trips a matrix payload through an annotation-safe encoding", () => {
		const encoded = encodeMatrixEvidence(
			"test",
			JSON.stringify({ os: "ubuntu-latest", node: 22, flags: ["a", "b"] }),
		);

		expect(encoded.startsWith(MATRIX_EVIDENCE_PREFIX)).toBe(true);
		expect(encoded).not.toContain("\n");
		expect(decodeMatrixEvidence(`prefix ${encoded}`)).toEqual({
			version: 1,
			jobId: "test",
			matrix: { os: "ubuntu-latest", node: 22, flags: ["a", "b"] },
		});
	});

	it("rejects malformed or non-object evidence", () => {
		expect(() => encodeMatrixEvidence("test", "not-json")).toThrow(
			"matrix input must be valid JSON",
		);
		expect(() => encodeMatrixEvidence("test", "[1,2]")).toThrow(
			"matrix input must decode to a JSON object",
		);
		expect(
			decodeMatrixEvidence("matrixtrim-evidence:v1:not-base64"),
		).toBeNull();
	});
	it("turns nested runtime values into deterministic axis strings", () => {
		expect(
			axesFromMatrixEvidence({
				node: 22,
				platform: { os: "ubuntu", arch: "x64" },
				flags: ["fast", "unit"],
			}),
		).toEqual({
			flags: "[fast,unit]",
			node: "22",
			platform: '{"arch":x64,"os":ubuntu}',
		});
	});
});
