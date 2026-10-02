import { describe, expect, it } from "vitest";
import {
	applyCapturedMatrixEvidence,
	isSkippedUnexpandedMatrixPlaceholder,
	type MatrixJobObservation,
	summarizeCells,
} from "../src/analyze.js";

describe("matrix job classification", () => {
	it("ignores skipped GitHub placeholders whose matrix name never expanded", () => {
		expect(
			isSkippedUnexpandedMatrixPlaceholder({
				name: "check (${{ matrix.os }})",
				conclusion: "skipped",
				labels: [],
			}),
		).toBe(true);
		expect(
			isSkippedUnexpandedMatrixPlaceholder({
				name: "check (ubuntu-latest)",
				conclusion: "success",
				labels: ["ubuntu-latest"],
			}),
		).toBe(false);
	});
});

describe("cell history summarization", () => {
	it("uses captured axes to create a stable unique cell identity", () => {
		const observation: MatrixJobObservation = {
			runId: 1,
			runNumber: 1,
			jobId: 11,
			cell: "opaque runtime cell",
			baseJob: "runtime-test",
			axes: null,
			axisSource: "unavailable",
			conclusion: "success",
			runtimeSeconds: 5,
		};

		applyCapturedMatrixEvidence(observation, {
			version: 1,
			jobId: "runtime-test",
			matrix: { runtime: "node22", os: "ubuntu" },
		});

		expect(observation).toMatchObject({
			baseJob: "runtime-test",
			axes: { os: "ubuntu", runtime: "node22" },
			axisSource: "capture-evidence",
			cell: "opaque runtime cell [os=ubuntu, runtime=node22]",
		});
	});

	it("keeps cells that only ever succeeded in the analysis universe", () => {
		const matrixJobs: MatrixJobObservation[] = [
			{
				runId: 1,
				runNumber: 1,
				jobId: 11,
				cell: "test (20)",
				baseJob: "test",
				axes: { node: "20" },
				axisSource: "workflow-job-name",
				conclusion: "success",
				runtimeSeconds: 12,
			},
			{
				runId: 2,
				runNumber: 2,
				jobId: 21,
				cell: "test (20)",
				baseJob: "test",
				axes: { node: "20" },
				axisSource: "workflow-job-name",
				conclusion: "success",
				runtimeSeconds: 14,
			},
			{
				runId: 1,
				runNumber: 1,
				jobId: 12,
				cell: "test (22)",
				baseJob: "test",
				axes: { node: "22" },
				axisSource: "workflow-job-name",
				conclusion: "failure",
				runtimeSeconds: 20,
			},
		];

		const cells = summarizeCells(matrixJobs, [
			{
				runId: 1,
				runNumber: 1,
				jobId: 12,
				cell: "test (22)",
				baseJob: "test",
				fingerprint: "f1",
				signature: ["Error: boom"],
				evidence: ["Error: boom"],
			},
		]);

		expect(cells.find((cell) => cell.cell === "test (20)")).toMatchObject({
			runsObserved: 2,
			successRuns: 2,
			failureRuns: 0,
			distinctFailures: 0,
			medianRuntimeSeconds: 13,
			axes: { node: "20" },
		});

		expect(cells.find((cell) => cell.cell === "test (22)")).toMatchObject({
			runsObserved: 1,
			successRuns: 0,
			failureRuns: 1,
			distinctFailures: 1,
		});
	});

	it("counts multiple failure events in one failed job without inflating failure runs", () => {
		const matrixJobs: MatrixJobObservation[] = [
			{
				runId: 1,
				runNumber: 1,
				jobId: 11,
				cell: "test (20)",
				baseJob: "test",
				axes: { node: "20" },
				axisSource: "workflow-job-name",
				conclusion: "failure",
				runtimeSeconds: 12,
			},
		];

		const cells = summarizeCells(matrixJobs, [
			{
				runId: 1,
				runNumber: 1,
				jobId: 11,
				cell: "test (20)",
				baseJob: "test",
				fingerprint: "f1",
				signature: ["TypeError: x"],
				evidence: ["TypeError: x"],
			},
			{
				runId: 1,
				runNumber: 1,
				jobId: 11,
				cell: "test (20)",
				baseJob: "test",
				fingerprint: "f2",
				signature: ["AssertionError: y"],
				evidence: ["AssertionError: y"],
			},
		]);

		expect(cells[0]).toMatchObject({
			runsObserved: 1,
			failureRuns: 1,
			observations: 2,
			distinctFailures: 2,
			uniqueFailures: 2,
		});
	});
});
