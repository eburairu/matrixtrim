export function actionInputEnvName(name: string): string {
	// Match @actions/core getInput(): uppercase and replace spaces only.
	// Hyphens are intentionally preserved (for example create-pr -> INPUT_CREATE-PR).
	return `INPUT_${name.replace(/ /g, "_").toUpperCase()}`;
}

export function actionInput(
	name: string,
	env: NodeJS.ProcessEnv = process.env,
): string {
	return env[actionInputEnvName(name)]?.trim() ?? "";
}

export function intActionInput(
	name: string,
	fallback: number,
	min: number,
	max: number,
	env: NodeJS.ProcessEnv = process.env,
): number {
	const raw = actionInput(name, env);
	if (!raw) return fallback;
	const value = Number.parseInt(raw, 10);
	if (!Number.isInteger(value) || value < min || value > max) {
		throw new Error(`${name} must be an integer from ${min} to ${max}`);
	}
	return value;
}

export function boolActionInput(
	name: string,
	fallback: boolean,
	env: NodeJS.ProcessEnv = process.env,
): boolean {
	const raw = actionInput(name, env).toLowerCase();
	if (!raw) return fallback;
	if (["true", "1", "yes", "on"].includes(raw)) return true;
	if (["false", "0", "no", "off"].includes(raw)) return false;
	throw new Error(`${name} must be true or false`);
}
