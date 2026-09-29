import { createHash } from "node:crypto";

export type FailureFingerprint = {
  id: string;
  signature: string[];
  evidence: string[];
};

const interesting = /(error|fail(?:ed|ure)?|exception|panic|assert|fatal|traceback|segmentation|timeout)/i;
const noise = /(process completed with exit code|##\[group\]|##\[endgroup\]|post job cleanup)/i;

const rootCausePatterns = [
  /^(?:[A-Za-z_][\w.]*(?:Error|Exception|Failure)): .+/,
  /^FAILED\s+.+/,
  /^ERROR\s+.+/,
  /^E\s{2,}.+/,
  /^error(?:\[[^\]]+\])?:\s+.+/i,
  /^fatal:\s+.+/i,
  /^panic:\s+.+/i,
  /panicked at/i,
  /segmentation fault/i,
];

export function normalizeLogLine(input: string): string {
  return input
    .replace(/^\uFEFF/, "")
    .replace(/\x1b\[[0-9;]*m/g, "")
    .replace(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\s*/, "")
    .replace(/##\[(?:error|warning)\]/gi, "")
    .replace(/[A-Fa-f0-9]{8}-[A-Fa-f0-9]{4}-[1-5][A-Fa-f0-9]{3}-[89ABab][A-Fa-f0-9]{3}-[A-Fa-f0-9]{12}/g, "<uuid>")
    .replace(/0x[A-Fa-f0-9]+/g, "<hex>")
    .replace(/:\d+:\d+(?=\)?(?:\s|$))/g, ":<line>:<col>")
    .replace(/\bline \d+\b/gi, "line <n>")
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

function rootCauses(lines: string[]): string[] {
  const causes = lines
    .filter((line) => rootCausePatterns.some((pattern) => pattern.test(line)))
    .map(normalizeRootCause);
  return [...new Set(causes)].slice(-8);
}

export function fingerprintFailure(log: string): FailureFingerprint {
  const normalized = log
    .split(/\r?\n/)
    .map(normalizeLogLine)
    .filter((line) => line && !noise.test(line));

  const roots = rootCauses(normalized);
  const candidates = normalized.filter((line) => interesting.test(line));
  const evidenceSource = candidates.length ? candidates : normalized.slice(-20);
  const evidence = [...new Set(evidenceSource)].slice(-16);

  const signature = roots.length
    ? roots
    : [...new Set(evidenceSource)].slice(-6);

  const canonical = signature.join("\n").toLowerCase();
  const id = createHash("sha256").update(canonical).digest("hex").slice(0, 16);
  return { id, signature, evidence };
}
