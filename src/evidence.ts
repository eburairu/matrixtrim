export const MATRIX_EVIDENCE_PREFIX = "matrixtrim-evidence:v1:";

export type MatrixEvidence = {
  version: 1;
  jobId: string;
  matrix: Record<string, unknown>;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function encodeMatrixEvidence(
  jobId: string,
  matrixJson: string,
): string {
  if (!jobId.trim()) throw new Error("GITHUB_JOB is required in capture mode");

  let matrix: unknown;
  try {
    matrix = JSON.parse(matrixJson);
  } catch {
    throw new Error("matrix input must be valid JSON from toJSON(matrix)");
  }
  if (!isObject(matrix)) {
    throw new Error("matrix input must decode to a JSON object");
  }

  const payload: MatrixEvidence = {
    version: 1,
    jobId: jobId.trim(),
    matrix,
  };
  const serialized = JSON.stringify(payload);
  if (Buffer.byteLength(serialized, "utf8") > 24 * 1024) {
    throw new Error("matrix evidence exceeds the 24 KiB capture limit");
  }
  return MATRIX_EVIDENCE_PREFIX +
    Buffer.from(serialized, "utf8").toString("base64url");
}
export function decodeMatrixEvidence(message: string): MatrixEvidence | null {
  const index = message.indexOf(MATRIX_EVIDENCE_PREFIX);
  if (index < 0) return null;
  const encoded = message
    .slice(index + MATRIX_EVIDENCE_PREFIX.length)
    .trim()
    .match(/^[A-Za-z0-9_-]+/)?.[0];
  if (!encoded) return null;

  try {
    const value = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as unknown;
    if (!isObject(value)) return null;
    if (value.version !== 1 || typeof value.jobId !== "string") return null;
    if (!isObject(value.matrix)) return null;
    return {
      version: 1,
      jobId: value.jobId,
      matrix: value.matrix,
    };
  } catch {
    return null;
  }
}