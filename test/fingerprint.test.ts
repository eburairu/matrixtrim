import { describe, expect, it } from "vitest";
import { fingerprintFailure, normalizeLogLine } from "../src/fingerprint.js";

describe("failure fingerprints", () => {
  it("normalizes timestamps, workspace paths, and volatile values", () => {
    const a = "2026-09-29T10:00:01.123Z ##[error]Error at /home/runner/work/foo/foo/src/a.ts:42:7 after 123ms";
    const b = "2026-09-29T10:01:09.999Z ##[error]Error at /home/runner/work/bar/bar/src/a.ts:99:3 after 950ms";

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
    const windows = "ImportError: cannot import name '_resolve_args_directness' from partially initialized module '_pytest.fixtures' (most likely due to a circular import) (D:\\a\\pytest\\pytest\\.tox\\py311\\Lib\\site-packages\\_pytest\\fixtures.py)";
    const linux = "ImportError: cannot import name '_resolve_args_directness' from partially initialized module '_pytest.fixtures' (most likely due to a circular import) (/home/runner/work/pytest/pytest/.tox/py311/lib/python3.11/site-packages/_pytest/fixtures.py)";

    expect(fingerprintFailure(windows).id).toBe(fingerprintFailure(linux).id);
  });

  it("separates materially different failures", () => {
    expect(fingerprintFailure("TypeError: x is not a function").id)
      .not.toBe(fingerprintFailure("AssertionError: expected 1 to equal 2").id);
  });
});
