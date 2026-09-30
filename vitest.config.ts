import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		coverage: {
			provider: "v8",
			include: ["src/**/*.ts"],
			reporter: ["text-summary", "json-summary"],
			thresholds: {
				statements: 60,
				branches: 50,
				functions: 70,
				lines: 60,
			},
		},
	},
});
