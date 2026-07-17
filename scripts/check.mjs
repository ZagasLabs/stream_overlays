import { execFileSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

const root = resolve(process.cwd());
const excluded = new Set(["node_modules", ".git", "dist"]);
const files = walk(root).filter((file) => [".js", ".mjs"].includes(extname(file)));
for (const file of files) execFileSync(process.execPath, ["--check", file], { stdio: "inherit" });
console.log(`Syntax check passed (${files.length} JavaScript files).`);

function walk(directory) {
  return readdirSync(directory).flatMap((entry) => {
    if (excluded.has(entry)) return [];
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? walk(path) : [relative(root, path)];
  });
}
