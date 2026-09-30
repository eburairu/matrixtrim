import { createHash } from "node:crypto";

export type FailureFingerprint = {
  id: string;
  signature: string[];
  evidence: string[];
};

const interesting = /(error|fail(?:ed|ure)?|exception|panic|assert|fatal|traceback|segmentation|timeout)/i;
const noise = /(process completed with exit code|##\[group\]|##\[endgroup\]|post job cleanup)/i;

const strongRootCausePatterns = [
  /^(?:[A-Za-z_][\w.]*(?:Error|Exception|Failure)): .+/,
  /^error(?:\[[^\]]+\])?:\s+.+/i,
  /^fatal:\s+.+/i,
  /^panic:\s+.+/i,
  /panicked at/i,
  /segmentation fault/i,
];

const summaryRootCausePatterns = [
  /^FAILED\s+.+/,
  /^ERROR\s+.+/,
  /^E\s{2,}.+/,
];

const derivativeRootCausePatterns = [
  /^error: could not compile\b.*\bdue to \d+ previous errors?/i,
  /^error: aborting due to \d+ previous errors?/i,
  /^error: test run failed$/i,
  /^error: test failed\b.*\bto rerun\b/i,
];

const rootCausePatterns = [
  ...strongRootCausePatterns,
  ...summaryRootCausePatterns,
];

export function normalizeLogLine(input: string): string {
  return input
    .replace(/^\uFEFF/, "")
    .replace(/\x1b\[[0-9;]*m/g, "")
    .replace(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\s*/, "")
    .replace(/##\[(?:error|warning)\]/gi, "")
    .replace(/[A-Fa-f0-9]{8}-[A-Fa-f0-9]{4}-[1-5][A-Fa-f0-9]{3}-[89ABab][A-Fa-f0-9]{3}-[A-Fa-f0-9]{12}/g, "<uuid>")
    .replace(/0x[A-Fa-f0-9]+/g, "<hex>")
    .replace(/:\d+:\d+(?=\)?(?:\s|$|:))/g, ":<line>:<col>")
    .replace(/\bline \d+\b/gi, "line <n>")
    .replace(
      /(\bthread\s+'[^']+'\s+)\(\d+\)(?=\s+panicked at)/gi,
      "$1(<thread>)",
    )
    .replace(/\b\d+(?:\.\d+)?\s*(?:ms|s|sec|seconds|minutes|min)\b/gi, "<duration>")
    .replace(/\/home\/runner\/work\/[^\s:]+/g, "<workspace>")
    .replace(/\b[A-Za-z]:\\[^\s)]+/g, "<path>")
    .replace(/\\Users\\[^\\\s]+\\/g, "<user>\\")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeRootCause(line: string): string {
  return line
    .replace(/\s+\((?:[A-Za-z]:\\|\/)[^)]+\)$/, " (<path>)")
    .replace(/\s+\((?:<workspace>|<path>)\)?$/, " (<path>)")
    .replace(/\b(?:py|node|python)\d{2,3}(?:-[\w-]+)?\b/gi, "<runtime>")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizedLog(log: string): string[] {
  return log
    .split(/\r?\n/)
    .map(normalizeLogLine)
    .filter((line) => line && !noise.test(line));
}

function rootCauses(lines: string[]): string[] {
  const causes = lines
    .filter((line) => rootCausePatterns.some((pattern) => pattern.test(line)))
    .map(normalizeRootCause);
  return [...new Set(causes)].slice(-8);
}

function fingerprint(
  signature: string[],
  evidence: string[],
): FailureFingerprint {
  const canonical = signature.join("\n").toLowerCase();
  const id = createHash("sha256").update(canonical).digest("hex").slice(0, 16);
  return { id, signature, evidence };
}

function embeddedSummaryRootCause(line: string): string | null {
  if (!summaryRootCausePatterns.some((pattern) => pattern.test(line))) {
    return null;
  }
  const separator = line.lastIndexOf(" - ");
  if (separator < 0) return null;

  const tail = line.slice(separator + 3).trim();
  if (!tail || !interesting.test(tail)) return null;
  return normalizeRootCause(tail);
}

function eventRoots(
  lines: string[],
  patterns: RegExp[],
): Array<{ signature: string; index: number }> {
  const bySignature = new Map<string, number>();
  lines.forEach((line, index) => {
    if (!patterns.some((pattern) => pattern.test(line))) return;
    bySignature.set(normalizeRootCause(line), index);
  });

  return [...bySignature.entries()]
    .map(([signature, index]) => ({ signature, index }))
    .sort((a, b) => a.index - b.index)
    .slice(-8);
}

function strongEventRoots(
  lines: string[],
): Array<{ signature: string; index: number }> {
  const bySignature = new Map<string, number>();
  lines.forEach((line, index) => {
    const signature = strongRootCausePatterns.some((pattern) =>
        pattern.test(line)
      )
      ? normalizeRootCause(line)
      : embeddedSummaryRootCause(line);
    if (!signature) return;
    bySignature.set(signature, index);
  });

  const roots = [...bySignature.entries()]
    .map(([signature, index]) => ({ signature, index }))
    .sort((a, b) => a.index - b.index);

  const specific = roots.filter(
    (root) =>
      !derivativeRootCausePatterns.some((pattern) =>
        pattern.test(root.signature)
      ),
  );
  return (specific.length ? specific : roots).slice(-8);
}

function eventEvidence(lines: string[], index: number): string[] {
  const start = Math.max(0, index - 3);
  const end = Math.min(lines.length, index + 4);
  const nearby = lines.slice(start, end);
  const interestingNearby = nearby.filter((line) => interesting.test(line));
  return [...new Set(
    interestingNearby.length ? interestingNearby : nearby,
  )].slice(-8);
}

/**
 * Extract independent failure events from one job log.
 *
 * Strong root-cause headlines become separate fingerprints. Summary-only
 * headlines (for example pytest FAILED/ERROR lines) are used only when no
 * strong root cause was found, avoiding duplicate summary events for logs
 * that already contain typed exceptions or panic/fatal headlines.
 *
 * If no root-cause headline can be extracted, this falls back to the legacy
 * single fingerprint heuristic.
 */
export function fingerprintFailures(log: string): FailureFingerprint[] {
  const lines = normalizedLog(log);
  const strong = strongEventRoots(lines);
  const roots = strong.length
    ? strong
    : eventRoots(lines, summaryRootCausePatterns);

  if (roots.length) {
    return roots.map((root) =>
      fingerprint(
        [root.signature],
        eventEvidence(lines, root.index),
      )
    );
  }

  return [fingerprintFailure(log)];
}

/**
 * Legacy one-job/one-fingerprint API.
 *
 * Kept for backwards compatibility. MatrixTrim analysis uses
 * fingerprintFailures() so a failed job can contribute multiple independent
 * failure signals.
 */
export function fingerprintFailure(log: string): FailureFingerprint {
  const normalized = normalizedLog(log);

  const roots = rootCauses(normalized);
  const candidates = normalized.filter((line) => interesting.test(line));
  const evidenceSource = candidates.length ? candidates : normalized.slice(-20);
  const evidence = [...new Set(evidenceSource)].slice(-16);

  const signature = roots.length
    ? roots
    : [...new Set(evidenceSource)].slice(-6);

  return fingerprint(signature, evidence);
}
