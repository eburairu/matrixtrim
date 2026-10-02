import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
	failureExtractorOrder,
	fingerprintFailure,
	fingerprintFailures,
	normalizeLogLine,
} from "../src/fingerprint.js";

function fixture(name: string): string {
	return readFileSync(
		new URL(`./fixtures/fingerprints/${name}`, import.meta.url),
		"utf8",
	);
}

describe("failure fingerprints", () => {
	it("uses deterministic extractor precedence with a generic fallback", () => {
		expect(failureExtractorOrder()).toEqual([
			"python-pytest",
			"rust-cargo",
			"node-package-manager",
			"generic",
		]);
	});

	it("normalizes equivalent pytest failures across runner platforms", () => {
		const linux = fingerprintFailures(fixture("pytest-linux.log"));
		const windows = fingerprintFailures(fixture("pytest-windows.log"));

		expect(linux).toHaveLength(1);
		expect(windows).toHaveLength(1);
		expect(linux[0]!.id).toBe(windows[0]!.id);
		expect(linux[0]!.signature[0]).toContain("ImportError:");
	});

	it("normalizes cargo panic volatility and suppresses derivative summaries", () => {
		const a = fingerprintFailures(fixture("cargo-a.log"));
		const b = fingerprintFailures(fixture("cargo-b.log"));

		expect(a).toHaveLength(1);
		expect(b).toHaveLength(1);
		expect(a[0]!.id).toBe(b[0]!.id);
		expect(a[0]!.signature[0]).toContain("(<thread>)");
	});

	it("normalizes npm wrapper noise while separating a different pnpm cause", () => {
		const npmA = fingerprintFailures(fixture("npm-eresolve-a.log"));
		const npmB = fingerprintFailures(fixture("npm-eresolve-b.log"));
		const pnpm = fingerprintFailures(fixture("pnpm-lockfile.log"));

		expect(npmA).toHaveLength(1);
		expect(npmB).toHaveLength(1);
		expect(npmA[0]!.id).toBe(npmB[0]!.id);
		expect(npmA[0]!.signature).toEqual([
			"ERESOLVE unable to resolve dependency tree",
		]);
		expect(pnpm[0]!.id).not.toBe(npmA[0]!.id);
		expect(pnpm[0]!.signature[0]).toContain("ERR_PNPM_OUTDATED_LOCKFILE");
	});

	it("keeps a Node test-runner summary when no stronger cause exists", () => {
		const events = fingerprintFailures(fixture("vitest-summary.log"));
		expect(events).toHaveLength(1);
		expect(events[0]!.signature).toEqual([
			"FAIL src/math.test.ts > math > adds values",
		]);
	});

	it("bounds extracted events per job", () => {
		const events = fingerprintFailures(
			Array.from({ length: 12 }, (_, i) => `TypeError: failure ${i}`).join(
				"\n",
			),
		);
		expect(events).toHaveLength(8);
	});

	it("normalizes timestamps, workspace paths, and volatile values", () => {
		const a =
			"2026-09-29T10:00:01.123Z ##[error]Error at /home/runner/work/foo/foo/src/a.ts:42:7 after 123ms";
		const b =
			"2026-09-29T10:01:09.999Z ##[error]Error at /home/runner/work/bar/bar/src/a.ts:99:3 after 950ms";

		expect(normalizeLogLine(a)).toBe(normalizeLogLine(b));
	});

	it("gives equivalent failures the same fingerprint", () => {
		const a = [
			"2026-09-29T10:00:01Z AssertionError: expected true",
			"2026-09-29T10:00:02Z at /home/runner/work/foo/foo/test.ts:12:4",
		].join("\n");
		const b = [
			"2026-09-29T11:30:01Z AssertionError: expected true",
			"2026-09-29T11:30:02Z at /home/runner/work/bar/bar/test.ts:98:9",
		].join("\n");

		expect(fingerprintFailure(a).id).toBe(fingerprintFailure(b).id);
	});

	it("clusters the same Python root cause across Windows and Linux paths", () => {
		const windows =
			"ImportError: cannot import name '_resolve_args_directness' from partially initialized module '_pytest.fixtures' (most likely due to a circular import) (D:\\a\\pytest\\pytest\\.tox\\py311\\Lib\\site-packages\\_pytest\\fixtures.py)";
		const linux =
			"ImportError: cannot import name '_resolve_args_directness' from partially initialized module '_pytest.fixtures' (most likely due to a circular import) (/home/runner/work/pytest/pytest/.tox/py311/lib/python3.11/site-packages/_pytest/fixtures.py)";

		expect(fingerprintFailure(windows).id).toBe(fingerprintFailure(linux).id);
	});

	it("separates materially different failures", () => {
		expect(fingerprintFailure("TypeError: x is not a function").id).not.toBe(
			fingerprintFailure("AssertionError: expected 1 to equal 2").id,
		);
	});

	it("extracts multiple independent root causes from one job", () => {
		const events = fingerprintFailures(
			[
				"TypeError: x is not a function",
				"some context",
				"AssertionError: expected 1 to equal 2",
			].join("\n"),
		);

		expect(events).toHaveLength(2);
		expect(events.map((event) => event.signature[0])).toEqual([
			"TypeError: x is not a function",
			"AssertionError: expected 1 to equal 2",
		]);
		expect(new Set(events.map((event) => event.id)).size).toBe(2);
	});

	it("does not double-count summary lines when strong root causes exist", () => {
		const events = fingerprintFailures(
			[
				"FAILED tests/test_api.py::test_create",
				"AssertionError: expected 201",
				"FAILED tests/test_api.py::test_update",
			].join("\n"),
		);

		expect(events).toHaveLength(1);
		expect(events[0]!.signature).toEqual(["AssertionError: expected 201"]);
	});

	it("deduplicates repeated copies of the same root cause", () => {
		const events = fingerprintFailures(
			[
				"TypeError: x is not a function",
				"TypeError: x is not a function",
				"TypeError: x is not a function",
			].join("\n"),
		);

		expect(events).toHaveLength(1);
	});

	it("collapses pytest summary lines by their embedded root cause", () => {
		const events = fingerprintFailures(
			[
				"FAILED tests/test_a.py::test_a - ValueError: no types given",
				"FAILED tests/test_b.py::test_b - ValueError: no types given",
				"FAILED tests/test_c.py::test_c - AttributeError: missing field",
			].join("\n"),
		);

		expect(events).toHaveLength(2);
		expect(events.map((event) => event.signature[0]).sort()).toEqual([
			"AttributeError: missing field",
			"ValueError: no types given",
		]);
	});

	it("extracts timeout-like embedded summary causes", () => {
		const events = fingerprintFailures(
			[
				"FAILED testing/test_a.py::test_a - pexpect.exceptions.TIMEOUT: Timeout exceeded.",
				"FAILED testing/test_b.py::test_b - pexpect.exceptions.TIMEOUT: Timeout exceeded.",
			].join("\n"),
		);

		expect(events).toHaveLength(1);
		expect(events[0]!.signature).toEqual([
			"pexpect.exceptions.TIMEOUT: Timeout exceeded.",
		]);
	});

	it("drops derivative Rust compile summaries when a specific error exists", () => {
		const events = fingerprintFailures(
			[
				"error[E0277]: the trait bound X: Y is not satisfied",
				"error: could not compile `demo` due to 1 previous error",
			].join("\n"),
		);

		expect(events).toHaveLength(1);
		expect(events[0]!.signature).toEqual([
			"error[E0277]: the trait bound X: Y is not satisfied",
		]);
	});

	it("keeps a derivative compile summary when it is the only root cause", () => {
		const events = fingerprintFailures(
			"error: could not compile `demo` due to 1 previous error",
		);

		expect(events).toHaveLength(1);
		expect(events[0]!.signature).toEqual([
			"error: could not compile `demo` due to 1 previous error",
		]);
	});

	it("drops derivative Rust test-run summaries when a panic exists", () => {
		const events = fingerprintFailures(
			[
				"thread 'demo' (13108) panicked at tests/demo.rs:835:10:",
				"error: test run failed",
			].join("\n"),
		);

		expect(events).toHaveLength(1);
		expect(events[0]!.signature[0]).toContain("panicked at");
	});

	it("normalizes Rust thread IDs and trailing source locations", () => {
		const a = fingerprintFailures(
			"thread 'demo' (13108) panicked at tests/demo.rs:835:10:",
		)[0]!;
		const b = fingerprintFailures(
			"thread 'demo' (14599) panicked at tests/demo.rs:912:4:",
		)[0]!;

		expect(a.id).toBe(b.id);
		expect(a.signature[0]).toContain("(<thread>)");
		expect(a.signature[0]).toContain(":<line>:<col>:");
	});

	it("uses multiple summary events when no embedded root cause is available", () => {
		const events = fingerprintFailures(
			["FAILED tests/test_a.py::test_a", "FAILED tests/test_b.py::test_b"].join(
				"\n",
			),
		);

		expect(events).toHaveLength(2);
	});
});
