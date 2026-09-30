import { describe, expect, it } from "vitest";
import {
	actionInput,
	actionInputEnvName,
	boolActionInput,
	intActionInput,
} from "../src/action-input.js";

describe("GitHub Action inputs", () => {
	it("preserves hyphens in GitHub's INPUT_ environment variable names", () => {
		expect(actionInputEnvName("create-pr")).toBe("INPUT_CREATE-PR");
		expect(actionInputEnvName("exact-max-nodes")).toBe("INPUT_EXACT-MAX-NODES");
	});

	it("reads hyphenated inputs from the environment", () => {
		const env = {
			"INPUT_CREATE-PR": " true ",
			"INPUT_EXACT-MAX-NODES": "1234",
		};
		expect(actionInput("create-pr", env)).toBe("true");
		expect(boolActionInput("create-pr", false, env)).toBe(true);
		expect(intActionInput("exact-max-nodes", 250_000, 1, 10_000_000, env)).toBe(
			1234,
		);
	});

	it("does not silently accept the old underscore spelling", () => {
		const env = { INPUT_CREATE_PR: "true" };
		expect(actionInput("create-pr", env)).toBe("");
		expect(boolActionInput("create-pr", false, env)).toBe(false);
	});
});
