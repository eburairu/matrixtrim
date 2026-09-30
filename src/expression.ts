export type MatrixValue =
	| string
	| number
	| boolean
	| null
	| Record<string, unknown>;

function expressionNumber(value: unknown): number {
	if (value === null) return 0;
	if (typeof value === "boolean") return value ? 1 : 0;
	if (typeof value === "number") return value;
	if (typeof value === "string") {
		if (!value.trim()) return 0;
		const parsed = Number(value);
		return Number.isNaN(parsed) ? Number.NaN : parsed;
	}
	return Number.NaN;
}

function expressionEqual(a: unknown, b: unknown): boolean {
	if (typeof a === typeof b) {
		if (typeof a === "string" && typeof b === "string") {
			return a.toLowerCase() === b.toLowerCase();
		}
		if ((typeof a === "object" && a !== null) || Array.isArray(a)) {
			return a === b;
		}
		return Object.is(a, b);
	}

	const left = expressionNumber(a);
	const right = expressionNumber(b);
	return !Number.isNaN(left) && !Number.isNaN(right) && left === right;
}

function expressionCompare(
	a: unknown,
	b: unknown,
	operator: "<" | "<=" | ">" | ">=",
): boolean {
	if (typeof a === "string" && typeof b === "string") {
		const left = a.toLowerCase();
		const right = b.toLowerCase();
		if (operator === "<") return left < right;
		if (operator === "<=") return left <= right;
		if (operator === ">") return left > right;
		return left >= right;
	}

	const left = expressionNumber(a);
	const right = expressionNumber(b);
	if (Number.isNaN(left) || Number.isNaN(right)) return false;
	if (operator === "<") return left < right;
	if (operator === "<=") return left <= right;
	if (operator === ">") return left > right;
	return left >= right;
}

function githubString(value: unknown): string | undefined {
	if (value === null) return "";
	if (["string", "number", "boolean"].includes(typeof value)) {
		return String(value);
	}
	return undefined;
}

function getPath(row: Record<string, MatrixValue>, path: string): unknown {
	const parts = path.split(".");

	function descend(value: unknown, index: number): unknown {
		if (index >= parts.length) return value;
		const part = parts[index]!;

		if (part === "*") {
			// GitHub permits object filters over arrays and objects, but object
			// property order is explicitly unspecified. Only arrays are replayed
			// here so rendered-name reconstruction stays deterministic.
			if (!Array.isArray(value)) return undefined;
			return value
				.flatMap((item) => {
					const resolved = descend(item, index + 1);
					return Array.isArray(resolved) ? resolved : [resolved];
				})
				.filter((item) => item !== undefined);
		}

		if (!value || typeof value !== "object") return undefined;
		return descend((value as Record<string, unknown>)[part], index + 1);
	}

	return descend(row, 0);
}

function splitArgs(text: string): string[] {
	const result: string[] = [];
	let start = 0;
	let depth = 0;
	let quote: "'" | '"' | null = null;

	for (let index = 0; index < text.length; index++) {
		const char = text[index]!;
		if (quote) {
			if (char === quote && text[index - 1] !== "\\") quote = null;
			continue;
		}
		if (char === "'" || char === '"') {
			quote = char;
			continue;
		}
		if (char === "(") depth++;
		if (char === ")") depth--;
		if (char === "," && depth === 0) {
			result.push(text.slice(start, index).trim());
			start = index + 1;
		}
	}
	result.push(text.slice(start).trim());
	return result;
}

function hasWrappingParentheses(text: string): boolean {
	if (!text.startsWith("(") || !text.endsWith(")")) return false;
	let depth = 0;
	let quote: "'" | '"' | null = null;

	for (let index = 0; index < text.length; index++) {
		const char = text[index]!;
		if (quote) {
			if (char === quote && text[index - 1] !== "\\") quote = null;
			continue;
		}
		if (char === "'" || char === '"') {
			quote = char;
			continue;
		}
		if (char === "(") depth++;
		if (char === ")") depth--;
		if (depth === 0 && index < text.length - 1) return false;
	}
	return depth === 0;
}

function evalExpression(
	expression: string,
	row: Record<string, MatrixValue>,
): unknown {
	let expr = expression.trim();
	while (hasWrappingParentheses(expr)) {
		expr = expr.slice(1, -1).trim();
	}

	const fallback = splitTopLevel(expr, "||");
	if (fallback.length > 1) {
		let last: unknown = "";
		for (const part of fallback) {
			const value = evalExpression(part, row);
			last = value;
			if (value) return value;
		}
		return last;
	}

	const andParts = splitTopLevel(expr, "&&");
	if (andParts.length > 1) {
		let last: unknown = true;
		for (const part of andParts) {
			const value = evalExpression(part, row);
			last = value;
			if (!value) return value;
		}
		return last;
	}

	for (const operator of ["<=", ">=", "<", ">"] as const) {
		const comparison = splitTopLevel(expr, operator);
		if (comparison.length === 2) {
			return expressionCompare(
				evalExpression(comparison[0]!, row),
				evalExpression(comparison[1]!, row),
				operator,
			);
		}
	}

	const notEqual = splitTopLevel(expr, "!=");
	if (notEqual.length === 2) {
		return !expressionEqual(
			evalExpression(notEqual[0]!, row),
			evalExpression(notEqual[1]!, row),
		);
	}

	const equal = splitTopLevel(expr, "==");
	if (equal.length === 2) {
		return expressionEqual(
			evalExpression(equal[0]!, row),
			evalExpression(equal[1]!, row),
		);
	}

	if (expr.startsWith("!")) {
		return !evalExpression(expr.slice(1), row);
	}

	const caseMatch = expr.match(/^case\((.*)\)$/s);
	if (caseMatch) {
		const args = splitArgs(caseMatch[1]!);
		if (args.length < 3 || args.length % 2 === 0) return undefined;
		for (let index = 0; index < args.length - 1; index += 2) {
			if (evalExpression(args[index]!, row)) {
				return evalExpression(args[index + 1]!, row);
			}
		}
		return evalExpression(args.at(-1)!, row);
	}

	const containsMatch = expr.match(/^contains\((.*)\)$/s);
	if (containsMatch) {
		const args = splitArgs(containsMatch[1]!);
		if (args.length !== 2) return undefined;
		const search = evalExpression(args[0]!, row);
		const item = evalExpression(args[1]!, row);
		if (Array.isArray(search)) {
			return search.some((value) => expressionEqual(value, item));
		}
		const searchText = githubString(search);
		const itemText = githubString(item);
		if (searchText === undefined || itemText === undefined) return undefined;
		return searchText.toLowerCase().includes(itemText.toLowerCase());
	}

	const startsWithMatch = expr.match(/^startsWith\((.*)\)$/s);
	if (startsWithMatch) {
		const args = splitArgs(startsWithMatch[1]!);
		if (args.length !== 2) return undefined;
		const search = githubString(evalExpression(args[0]!, row));
		const prefix = githubString(evalExpression(args[1]!, row));
		if (search === undefined || prefix === undefined) return undefined;
		return search.toLowerCase().startsWith(prefix.toLowerCase());
	}

	const endsWithMatch = expr.match(/^endsWith\((.*)\)$/s);
	if (endsWithMatch) {
		const args = splitArgs(endsWithMatch[1]!);
		if (args.length !== 2) return undefined;
		const search = githubString(evalExpression(args[0]!, row));
		const suffix = githubString(evalExpression(args[1]!, row));
		if (search === undefined || suffix === undefined) return undefined;
		return search.toLowerCase().endsWith(suffix.toLowerCase());
	}

	const joinMatch = expr.match(/^join\((.*)\)$/s);
	if (joinMatch) {
		const args = splitArgs(joinMatch[1]!);
		if (args.length < 1 || args.length > 2) return undefined;
		const value = evalExpression(args[0]!, row);
		const separator =
			args.length === 2 ? githubString(evalExpression(args[1]!, row)) : ",";
		if (separator === undefined) return undefined;
		if (Array.isArray(value)) {
			const values = value.map(githubString);
			if (values.some((item) => item === undefined)) return undefined;
			return values.join(separator);
		}
		return githubString(value);
	}

	const fromJsonMatch = expr.match(/^fromJSON\((.*)\)$/s);
	if (fromJsonMatch) {
		const args = splitArgs(fromJsonMatch[1]!);
		if (args.length !== 1) return undefined;
		const value = evalExpression(args[0]!, row);
		if (typeof value !== "string") return undefined;
		try {
			return JSON.parse(value);
		} catch {
			return undefined;
		}
	}

	const toJsonMatch = expr.match(/^toJSON\((.*)\)$/s);
	if (toJsonMatch) {
		const args = splitArgs(toJsonMatch[1]!);
		if (args.length !== 1) return undefined;
		const value = evalExpression(args[0]!, row);
		if (value === undefined) return undefined;
		return JSON.stringify(value, null, 2);
	}

	const formatMatch = expr.match(/^format\((.*)\)$/s);
	if (formatMatch) {
		const args = splitArgs(formatMatch[1]!);
		if (!args.length) return undefined;
		const template = evalExpression(args[0]!, row);
		if (typeof template !== "string") return undefined;
		const values = args.slice(1).map((arg) => evalExpression(arg, row));
		if (values.some((value) => value === undefined)) return undefined;
		return template.replace(/\{(\d+)\}/g, (_, index) =>
			String(values[Number(index)] ?? ""),
		);
	}

	const matrixPath = matrixReferencePath(expr);
	if (matrixPath) {
		return getPath(row, matrixPath);
	}

	if (expr.startsWith("'") && expr.endsWith("'")) {
		return expr.slice(1, -1).replace(/''/g, "'");
	}
	if (expr.startsWith('"') && expr.endsWith('"')) {
		return expr.slice(1, -1);
	}
	if (expr === "true") return true;
	if (expr === "false") return false;
	if (expr === "null") return null;
	if (/^-?0x[0-9a-f]+$/i.test(expr)) return Number(expr);
	if (/^-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(expr)) {
		return Number(expr);
	}

	return undefined;
}

function splitTopLevel(text: string, operator: string): string[] {
	const result: string[] = [];
	let start = 0;
	let depth = 0;
	let quote: "'" | '"' | null = null;

	for (let index = 0; index <= text.length - operator.length; index++) {
		const char = text[index]!;
		if (quote) {
			if (char === quote && text[index - 1] !== "\\") quote = null;
			continue;
		}
		if (char === "'" || char === '"') {
			quote = char;
			continue;
		}
		if (char === "(") depth++;
		if (char === ")") depth--;
		if (
			depth === 0 &&
			text.slice(index, index + operator.length) === operator
		) {
			result.push(text.slice(start, index).trim());
			start = index + operator.length;
			index += operator.length - 1;
		}
	}

	if (!result.length) return [text.trim()];
	result.push(text.slice(start).trim());
	return result;
}

export function renderName(
	template: string,
	row: Record<string, MatrixValue>,
): string | null {
	let failed = false;
	const rendered = template.replace(
		/\$\{\{([\s\S]*?)\}\}/g,
		(_, expression) => {
			const value = evalExpression(String(expression), row);
			if (
				value === undefined ||
				(value !== null && typeof value === "object")
			) {
				failed = true;
				return "";
			}
			return String(value ?? "");
		},
	);
	return failed ? null : rendered;
}

function escapeRegex(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matrixReferencePath(expression: string): string | null {
	const normalized = expression
		.trim()
		.replace(/\[['"]([^'"]+)['"]\]/g, (_, key) => `.${key}`);
	const match = normalized.match(
		/^matrix\.([A-Za-z0-9_*-]+(?:\.[A-Za-z0-9_*-]+)*)$/,
	);
	return match?.[1] ?? null;
}

function directMatrixAxis(expression: string): string | null {
	const path = matrixReferencePath(expression);
	return path && !path.includes("*") ? path : null;
}

export function matrixAxesInTemplate(template: string): string[] {
	const references =
		template.match(/\bmatrix(?:\.[A-Za-z0-9_*-]+|\[['"][^'"]+['"]\])+/g) ?? [];
	return [
		...new Set(
			references
				.map(directMatrixAxis)
				.filter((axis): axis is string => axis !== null),
		),
	];
}

function dynamicExpressionMatcher(expression: string): {
	pattern: string;
	axes: string[];
	rejectedValues: Array<Set<string> | null>;
} | null {
	const direct = directMatrixAxis(expression);
	if (direct) {
		return { pattern: "(.+?)", axes: [direct], rejectedValues: [null] };
	}

	const fallback = splitTopLevel(expression.trim(), "||");
	if (fallback.length === 2) {
		const axis = directMatrixAxis(fallback[0]!);
		const fallbackValue = evalExpression(fallback[1]!, {});
		const fallbackText = githubString(fallbackValue);
		if (axis && fallbackValue !== undefined && fallbackText !== undefined) {
			return {
				pattern: "(.+?)",
				axes: [axis],
				rejectedValues: [new Set([fallbackText])],
			};
		}
	}

	const formatMatch = expression.trim().match(/^format\((.*)\)$/s);
	if (!formatMatch) return null;

	const args = splitArgs(formatMatch[1]!);
	if (!args.length) return null;
	const template = evalExpression(args[0]!, {});
	if (typeof template !== "string") return null;

	const axisArgs = args.slice(1).map(directMatrixAxis);
	if (axisArgs.some((axis) => axis === null)) return null;

	let pattern = "";
	const axes: string[] = [];
	const rejectedValues: Array<Set<string> | null> = [];
	let start = 0;
	for (const match of template.matchAll(/\{(\d+)\}/g)) {
		const index = match.index ?? 0;
		pattern += escapeRegex(template.slice(start, index));
		const argIndex = Number(match[1]);
		const axis = axisArgs[argIndex];
		if (!axis) return null;
		pattern += "(.+?)";
		axes.push(axis);
		rejectedValues.push(null);
		start = index + match[0].length;
	}
	pattern += escapeRegex(template.slice(start));
	return axes.length ? { pattern, axes, rejectedValues } : null;
}

export function matchDynamicNameTemplate(
	template: string,
	name: string,
): Record<string, string> | null {
	const expressionPattern = /\$\{\{([\s\S]*?)\}\}/g;
	let pattern = "^";
	const axes: string[] = [];
	const rejectedValues: Array<Set<string> | null> = [];
	let start = 0;
	let found = false;

	for (const match of template.matchAll(expressionPattern)) {
		found = true;
		const index = match.index ?? 0;
		pattern += escapeRegex(template.slice(start, index));
		const matcher = dynamicExpressionMatcher(match[1]!);
		if (!matcher) return null;
		pattern += matcher.pattern;
		axes.push(...matcher.axes);
		rejectedValues.push(...matcher.rejectedValues);
		start = index + match[0].length;
	}

	if (!found || !axes.length) return null;
	pattern += escapeRegex(template.slice(start));
	pattern += "(?: / .*)?$";

	const matched = name.match(new RegExp(pattern));
	if (!matched) return null;

	const result: Record<string, string> = {};
	for (let index = 0; index < axes.length; index++) {
		const axis = axes[index]!;
		const value = matched[index + 1] ?? "";
		if (rejectedValues[index]?.has(value)) return null;
		if (axis in result && result[axis] !== value) return null;
		result[axis] = value;
	}
	return result;
}
