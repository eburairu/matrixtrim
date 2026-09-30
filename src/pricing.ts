import type { AnalysisReport, MatrixJobObservation } from "./analyze.js";

export type RunnerPrice = {
	sku:
		| "actions_linux_slim"
		| "actions_linux"
		| "actions_linux_arm"
		| "actions_windows"
		| "actions_windows_arm"
		| "actions_macos";
	usdPerMinute: number;
	label: string;
};

export type RunnerClassification =
	| { kind: "standard"; price: RunnerPrice }
	| { kind: "self-hosted" }
	| { kind: "unknown" };

export type PricingEstimate = {
	repositoryVisibility: string | null;
	currentCells: number;
	pricedCells: number;
	selectedCells: number;
	selectedPricedCells: number;
	unpricedCells: string[];
	currentRateCardUsdPerRun: number | null;
	selectedRateCardUsdPerRun: number | null;
	rateCardSavingsUsdPerRun: number | null;
	rateCardReductionPercent: number | null;
	currentEstimatedChargeUsdPerRun: number | null;
	selectedEstimatedChargeUsdPerRun: number | null;
	estimatedChargeSavingsUsdPerRun: number | null;
	estimatedChargeReductionPercent: number | null;
	projectedRunsPer30Days: number | null;
	currentRateCardUsdPer30Days: number | null;
	selectedRateCardUsdPer30Days: number | null;
	currentEstimatedChargeUsdPer30Days: number | null;
	selectedEstimatedChargeUsdPer30Days: number | null;
	note: string;
};

// GitHub Actions runner pricing, verified against GitHub Docs on 2026-09-30.
// These are standard GitHub-hosted runner overage rates, not larger-runner rates.
const STANDARD_LABEL_PRICES: Array<{
	test: (label: string) => boolean;
	price: RunnerPrice;
}> = [
	{
		test: (label) => label === "ubuntu-slim",
		price: {
			sku: "actions_linux_slim",
			usdPerMinute: 0.002,
			label: "Linux 1-core x64",
		},
	},
	{
		test: (label) => /^ubuntu-(?:22\.04|24\.04|26\.04)-arm$/.test(label),
		price: {
			sku: "actions_linux_arm",
			usdPerMinute: 0.005,
			label: "Linux 2-core arm64",
		},
	},
	{
		test: (label) =>
			label === "ubuntu-latest" ||
			/^ubuntu-(?:22\.04|24\.04|26\.04)$/.test(label),
		price: {
			sku: "actions_linux",
			usdPerMinute: 0.006,
			label: "Linux 2-core x64",
		},
	},
	{
		test: (label) => /^windows-11-(?:arm|vs2026-arm)$/.test(label),
		price: {
			sku: "actions_windows_arm",
			usdPerMinute: 0.01,
			label: "Windows 2-core arm64",
		},
	},
	{
		test: (label) =>
			label === "windows-latest" ||
			/^windows-(?:2022|2025(?:-vs2026)?)$/.test(label),
		price: {
			sku: "actions_windows",
			usdPerMinute: 0.01,
			label: "Windows 2-core x64",
		},
	},
	{
		test: (label) =>
			label === "macos-latest" ||
			/^macos-(?:14|15|26)(?:-intel)?$/.test(label) ||
			label === "xcode-27",
		price: {
			sku: "actions_macos",
			usdPerMinute: 0.062,
			label: "macOS standard",
		},
	},
];

export function inferStandardRunnerPrice(
	labels: string[] | undefined,
): RunnerPrice | null {
	const classification = classifyRunner(labels);
	return classification.kind === "standard" ? classification.price : null;
}

export function classifyRunner(
	labels: string[] | undefined,
): RunnerClassification {
	if (!labels?.length) return { kind: "unknown" };
	const normalized = labels.map((label) => label.trim().toLowerCase());

	if (normalized.includes("self-hosted")) {
		return { kind: "self-hosted" };
	}

	for (const label of normalized) {
		for (const candidate of STANDARD_LABEL_PRICES) {
			if (candidate.test(label)) {
				return { kind: "standard", price: candidate.price };
			}
		}
	}
	return { kind: "unknown" };
}

export function billedMinutes(runtimeSeconds: number): number {
	if (!Number.isFinite(runtimeSeconds) || runtimeSeconds < 0) {
		throw new Error("runtimeSeconds must be a finite non-negative number");
	}
	return Math.max(1, Math.ceil(runtimeSeconds / 60));
}

export function standardRunnerListPriceUsd(
	runtimeSeconds: number | null,
	labels: string[] | undefined,
): number | null {
	if (runtimeSeconds === null) return null;
	const runner = inferStandardRunnerPrice(labels);
	if (!runner) return null;
	return billedMinutes(runtimeSeconds) * runner.usdPerMinute;
}

function median(values: number[]): number | null {
	if (!values.length) return null;
	const sorted = [...values].sort((a, b) => a - b);
	const middle = Math.floor(sorted.length / 2);
	return sorted.length % 2
		? sorted[middle]!
		: (sorted[middle - 1]! + sorted[middle]!) / 2;
}

function isConclusiveJob(job: MatrixJobObservation): boolean {
	return ["success", "failure", "timed_out", "neutral"].includes(
		job.conclusion ?? "",
	);
}

function estimateJob(
	job: MatrixJobObservation,
	visibility: string | null,
): { rateCard: number | null; estimatedCharge: number | null } | null {
	if (job.runtimeSeconds === null || !isConclusiveJob(job)) return null;

	const classification = classifyRunner(job.runnerLabels);
	if (classification.kind === "unknown") {
		return { rateCard: null, estimatedCharge: null };
	}
	if (classification.kind === "self-hosted") {
		return { rateCard: null, estimatedCharge: 0 };
	}

	const rateCard =
		billedMinutes(job.runtimeSeconds) * classification.price.usdPerMinute;

	if (visibility === "public") {
		return { rateCard, estimatedCharge: 0 };
	}
	if (visibility === "private" || visibility === "internal") {
		return { rateCard, estimatedCharge: rateCard };
	}
	return { rateCard, estimatedCharge: null };
}

type CellPrice = {
	rateCard: number | null;
	estimatedCharge: number | null;
};

function cellPrices(report: AnalysisReport): Map<string, CellPrice> {
	const jobsByCell = new Map<string, MatrixJobObservation[]>();
	for (const job of report.matrixJobs ?? []) {
		const items = jobsByCell.get(job.cell) ?? [];
		items.push(job);
		jobsByCell.set(job.cell, items);
	}

	const visibility = report.repositoryVisibility ?? null;
	const result = new Map<string, CellPrice>();

	for (const cell of report.cells) {
		const samples = (jobsByCell.get(cell.cell) ?? [])
			.map((job) => estimateJob(job, visibility))
			.filter((value): value is NonNullable<typeof value> => value !== null);

		if (!samples.length) {
			result.set(cell.cell, { rateCard: null, estimatedCharge: null });
			continue;
		}

		const rateCardKnown = samples.every((sample) => sample.rateCard !== null);
		const chargeKnown = samples.every(
			(sample) => sample.estimatedCharge !== null,
		);

		result.set(cell.cell, {
			rateCard: rateCardKnown
				? median(samples.map((sample) => sample.rateCard!))
				: null,
			estimatedCharge: chargeKnown
				? median(samples.map((sample) => sample.estimatedCharge!))
				: null,
		});
	}

	return result;
}

function totalFor(
	names: string[],
	prices: Map<string, CellPrice>,
	field: keyof CellPrice,
): number | null {
	const values = names.map((name) => prices.get(name)?.[field] ?? null);
	const known = values.filter((value): value is number => value !== null);
	if (known.length !== values.length) return null;
	return known.reduce((sum, value) => sum + value, 0);
}

function savings(
	current: number | null,
	selected: number | null,
): { amount: number | null; percent: number | null } {
	if (current === null || selected === null) {
		return { amount: null, percent: null };
	}
	const amount = current - selected;
	return {
		amount,
		percent: current > 0 ? (amount / current) * 100 : null,
	};
}

function monthly(
	perRun: number | null,
	projectedRunsPer30Days: number | null | undefined,
): number | null {
	return perRun !== null && projectedRunsPer30Days != null
		? perRun * projectedRunsPer30Days
		: null;
}

export function estimatePricing(
	report: AnalysisReport,
	selectedCells: string[],
): PricingEstimate {
	const prices = cellPrices(report);
	const currentNames = report.cells.map((cell) => cell.cell);
	const currentRateCardUsdPerRun = totalFor(currentNames, prices, "rateCard");
	const selectedRateCardUsdPerRun = totalFor(selectedCells, prices, "rateCard");
	const currentEstimatedChargeUsdPerRun = totalFor(
		currentNames,
		prices,
		"estimatedCharge",
	);
	const selectedEstimatedChargeUsdPerRun = totalFor(
		selectedCells,
		prices,
		"estimatedCharge",
	);

	const rateCardSavings = savings(
		currentRateCardUsdPerRun,
		selectedRateCardUsdPerRun,
	);
	const chargeSavings = savings(
		currentEstimatedChargeUsdPerRun,
		selectedEstimatedChargeUsdPerRun,
	);

	const pricedCells = currentNames.filter(
		(name) => prices.get(name)?.estimatedCharge !== null,
	).length;
	const selectedPricedCells = selectedCells.filter(
		(name) => prices.get(name)?.estimatedCharge !== null,
	).length;
	const unpricedCells = currentNames.filter(
		(name) => prices.get(name)?.estimatedCharge === null,
	);

	const projectedRunsPer30Days =
		report.runWindowDays !== null &&
		report.runWindowDays !== undefined &&
		report.runWindowDays < 7
			? null
			: (report.projectedRunsPer30Days ?? null);
	const visibility = report.repositoryVisibility ?? null;

	let note: string;
	if (visibility === "public") {
		note =
			"Standard GitHub-hosted runners are free in public repositories; rate-card values are comparison-only. Larger/unknown runners are not estimated.";
	} else if (visibility === "private" || visibility === "internal") {
		note =
			"Estimated GitHub charge uses standard-runner overage rates before plan-included minutes. Larger/unknown runners are not estimated.";
	} else {
		note =
			"Repository visibility is unavailable, so GitHub charge cannot be estimated. Standard-runner rate-card values may still be available.";
	}
	if (
		report.runWindowDays !== null &&
		report.runWindowDays !== undefined &&
		report.runWindowDays < 7
	) {
		note += ` 30-day projection is omitted because the observed run window is only ${report.runWindowDays.toFixed(1)} days (<7 days).`;
	}

	return {
		repositoryVisibility: visibility,
		currentCells: currentNames.length,
		pricedCells,
		selectedCells: selectedCells.length,
		selectedPricedCells,
		unpricedCells,
		currentRateCardUsdPerRun,
		selectedRateCardUsdPerRun,
		rateCardSavingsUsdPerRun: rateCardSavings.amount,
		rateCardReductionPercent: rateCardSavings.percent,
		currentEstimatedChargeUsdPerRun,
		selectedEstimatedChargeUsdPerRun,
		estimatedChargeSavingsUsdPerRun: chargeSavings.amount,
		estimatedChargeReductionPercent: chargeSavings.percent,
		projectedRunsPer30Days,
		currentRateCardUsdPer30Days: monthly(
			currentRateCardUsdPerRun,
			projectedRunsPer30Days,
		),
		selectedRateCardUsdPer30Days: monthly(
			selectedRateCardUsdPerRun,
			projectedRunsPer30Days,
		),
		currentEstimatedChargeUsdPer30Days: monthly(
			currentEstimatedChargeUsdPerRun,
			projectedRunsPer30Days,
		),
		selectedEstimatedChargeUsdPer30Days: monthly(
			selectedEstimatedChargeUsdPerRun,
			projectedRunsPer30Days,
		),
		note,
	};
}
