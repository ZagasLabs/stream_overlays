import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const root = resolve(process.cwd());
const required = [
  "index.html",
  "src/app.js",
  "src/config.js",
  "src/ssn-client.js",
  "src/message-normalizer.js",
  "src/message-renderer.js",
  "src/layout-manager.js",
  "src/sanitizer.js",
  "src/styles.css",
  "scripts/dev-server.mjs",
  "scripts/print-url.mjs",
  "tests/config.test.mjs",
  "tests/normalizer.test.mjs",
  "tests/sanitizer.test.mjs",
  "tests/layout.test.mjs",
  "docs/ssn-integration.md",
  "docs/security.md",
  "docs/obs-setup.md",
  "docs/customization.md",
  "README.md",
  ".github/workflows/pages.yml",
  ".nojekyll"
];

const failures = [];
for (const file of required) {
  try {
    if (!statSync(join(root, file)).isFile()) failures.push(`Missing required file: ${file}`);
  } catch {
    failures.push(`Missing required file: ${file}`);
  }
}

for (const file of listFiles(root)) {
  const rel = relative(root, file);
  if (rel.startsWith(".git/") || rel === "image.png") continue;
  const content = readFileSync(file, "utf8");
  scanSessionLeaks(rel, content);
  if (/\.(html|css|js|mjs)$/.test(rel) && rel !== "scripts/preflight.mjs") {
    scanDisallowedBrowserStorage(rel, content);
    scanRemoteRuntimeDependencies(rel, content);
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Preflight passed.");

function scanSessionLeaks(file, content) {
  const sessionMatches = content.match(/[?#&]session=([^&\s"'`<>)]{12,})/gi) || [];
  for (const match of sessionMatches) {
    if (/session=(SESSION_ID|SESSION_ID\}|SESSION_ID\]|SESSION_ID\.)/i.test(match)) continue;
    if (/session=\$\{/.test(match)) continue;
    failures.push(`Possible hard-coded session in ${file}: ${match}`);
  }
}

function scanDisallowedBrowserStorage(file, content) {
  if (/\b(localStorage|sessionStorage)\b/.test(content)) {
    failures.push(`Disallowed browser storage reference in ${file}`);
  }
}

function scanRemoteRuntimeDependencies(file, content) {
  if (file === "src/ssn-client.js") return;
  if (/(<script[^>]+https?:|<link[^>]+https?:|fonts\.googleapis|googletagmanager|analytics)/i.test(content)) {
    failures.push(`Remote runtime dependency or tracker found in ${file}`);
  }
}

function listFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (["node_modules", ".git"].includes(entry)) continue;
    const path = join(dir, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) out.push(...listFiles(path));
    else out.push(path);
  }
  return out;
}
