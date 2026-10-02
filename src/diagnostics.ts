export type AnalysisDiagnosticSeverity = "info" | "warning";

export type AnalysisDiagnosticScope =
	| "workflow"
	| "definition"
	| "job"
	| "cell";

export type AnalysisDiagnosticCode =
	| "workflow-definition-fallback"
	| "workflow-definition-unavailable"
	| "static-name-render-incomplete"
	| "static-cell-job-match-incomplete"
	| "dynamic-matrix-capture-not-configured"
	| "axis-ambiguous-rendered-name"
	| "axis-ambiguous-dynamic-name"
	| "axis-job-name-not-matrix-shaped"
	| "axis-definition-not-found"
	| "axis-names-unavailable"
	| "axis-value-count-mismatch"
	| "axis-opaque-dynamic-job-name"
	| "capture-evidence-missing"
	| "capture-evidence-conflict"
	| "capture-evidence-fetch-error"
	| "skipped-unexpanded-matrix-placeholder";

export type DiagnosticRemediation = {
	kind: "capture";
	summary: string;
	permissions: string[];
	snippet: string;
};

export type AnalysisDiagnostic = {
	code: AnalysisDiagnosticCode;
	severity: AnalysisDiagnosticSeverity;
	scope: AnalysisDiagnosticScope;
	message: string;
	jobId?: string;
	cell?: string;
	occurrences?: number;
	details?: Record<string, string | number | boolean | string[]>;
	remediation?: DiagnosticRemediation;
};

export function captureRemediation(jobId: string): DiagnosticRemediation {
	return {
		kind: "capture",
		summary:
			"Capture the exact runtime matrix object from a step that has access to the matrix context. A reusable-workflow caller with uses: cannot add steps directly; place capture in an executable matrix job instead.",
		permissions: ["actions: read", "checks: read", "contents: read"],
		snippet: [
			"- uses: eburairu/matrixtrim@v0",
			"  with:",
			"    mode: capture",
			"    matrix: ${{ toJSON(matrix) }}",
			"",
			`# analysis later maps this evidence back to job: ${jobId}`,
		].join("\n"),
	};
}

export type CaptureEvidenceProblem = "missing" | "conflict" | "fetch-error";

export function captureEvidenceDiagnostic(
	problem: CaptureEvidenceProblem,
	jobId: string,
	cell: string,
): AnalysisDiagnostic {
	const messages: Record<CaptureEvidenceProblem, string> = {
		missing:
			"The workflow opted into runtime matrix capture, but no matching evidence annotation was found for this observed job.",
		conflict:
			"Multiple conflicting runtime matrix evidence payloads were found for this observed job; MatrixTrim refused to choose one.",
		"fetch-error":
			"MatrixTrim could not read runtime matrix evidence annotations for this observed job.",
	};
	return {
		code:
			problem === "missing"
				? "capture-evidence-missing"
				: problem === "conflict"
					? "capture-evidence-conflict"
					: "capture-evidence-fetch-error",
		severity: "warning",
		scope: "cell",
		jobId,
		cell,
		message: messages[problem],
		remediation: captureRemediation(jobId),
	};
}

export function compactDiagnostics(
	items: AnalysisDiagnostic[],
): AnalysisDiagnostic[] {
	const byKey = new Map<string, AnalysisDiagnostic>();

	for (const item of items) {
		const key = [
			item.code,
			item.scope,
			item.jobId ?? "",
			item.scope === "cell" ? "" : (item.cell ?? ""),
			item.message,
		].join("\u0000");
		const current = byKey.get(key);
		if (current) {
			current.occurrences =
				(current.occurrences ?? 1) + (item.occurrences ?? 1);
			if (item.scope === "cell") {
				const affectedCells = new Set<string>([
					...((current.details?.affectedCells as string[] | undefined) ?? []),
					...(current.cell ? [current.cell] : []),
					...(item.cell ? [item.cell] : []),
				]);
				current.details = {
					...current.details,
					affectedCells: [...affectedCells].sort().slice(0, 10),
				};
				if (affectedCells.size > 1) current.cell = undefined;
			}
			continue;
		}
		byKey.set(key, { ...item, occurrences: item.occurrences ?? 1 });
	}

	return [...byKey.values()].sort(
		(a, b) =>
			(a.severity === b.severity ? 0 : a.severity === "warning" ? -1 : 1) ||
			a.code.localeCompare(b.code) ||
			(a.jobId ?? "").localeCompare(b.jobId ?? "") ||
			(a.cell ?? "").localeCompare(b.cell ?? ""),
	);
}
