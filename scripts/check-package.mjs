import { execFileSync } from "node:child_process";

const output = execFileSync(
	process.platform === "win32" ? "npm.cmd" : "npm",
	["pack", "--dry-run", "--json"],
	{ encoding: "utf8", env: { ...process.env, npm_config_loglevel: "silent" } },
);
const parsed = JSON.parse(output);
const pack = Array.isArray(parsed)
	? parsed[0]
	: parsed?.name
		? parsed
		: Object.values(parsed ?? {})[0];
if (!pack) throw new Error("npm pack returned no package metadata");

const paths = pack.files.map((file) => file.path);
const allowed = paths.filter(
	(path) =>
		path === "package.json" ||
		path === "README.md" ||
		path === "LICENSE" ||
		path.startsWith("dist/"),
);
const forbidden = paths.filter((path) => !allowed.includes(path));
if (forbidden.length) {
	throw new Error(`unexpected npm package files: ${forbidden.join(", ")}`);
}

for (const required of [
	"dist/cli.js",
	"package.json",
	"README.md",
	"LICENSE",
]) {
	if (!paths.includes(required))
		throw new Error(`npm package missing ${required}`);
}
if (paths.some((path) => path.startsWith("dist/src/"))) {
	throw new Error("npm package contains stale dist/src artifacts");
}
const totalFiles = pack.totalFiles ?? paths.length;
if (totalFiles > 50) {
	throw new Error(`npm package unexpectedly contains ${totalFiles} files`);
}

console.log(
	`npm package ok: ${pack.name}@${pack.version}, ${totalFiles} files, ${pack.unpackedSize} bytes unpacked`,
);
