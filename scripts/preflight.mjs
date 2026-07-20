import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { scanSecrets } from "../shared/security/secret-scan.js";
import { MAX_CUSTOM_SOUND_BYTES, parseSoundManifest, soundManifestEntries } from "../alerts/src/sound-manifest.js";

const root = resolve(process.cwd());
const required = [
  "index.html", "chat/index.html", "src/app.js", "src/config.js", "src/ssn-client.js", "src/sanitizer.js",
  "shared/ssn/client.js", "shared/security/sanitizer.js", "shared/security/secret-scan.js",
  "words/index.html", "words/src/app.js", "words/src/game.js", "words/data/en.js", "words/data/es.js", "words/data/NOTICE.md", "words/README.md",
  "alerts/index.html", "alerts/src/app.js", "alerts/src/normalizer.js", "alerts/src/queue.js", "alerts/src/audio-engine.js", "alerts/src/sound-manifest.js", "alerts/assets/sounds/manifest.json", "alerts/README.md",
  "scripts/dev-server.mjs", "scripts/print-url.mjs", "scripts/build-pages.mjs", "scripts/check.mjs",
  "docs/ssn-integration.md", "docs/alerts-capability-matrix.md", "docs/obs-words.md", "docs/obs-alerts.md", "docs/security.md", "docs/licenses.md",
  "README.md", ".github/workflows/pages.yml", ".nojekyll"
];
const failures = [];

for (const file of required) {
  try { if (!statSync(join(root, file)).isFile()) failures.push(`Missing required file: ${file}`); }
  catch { failures.push(`Missing required file: ${file}`); }
}

for (const file of listFiles(root)) {
  const rel = relative(root, file).replaceAll("\\", "/");
  if (rel.startsWith(".git/") || /(^|\/)node_modules\//.test(rel) || /\.(?:png|jpe?g|webp|gif|ico|wav|ogg)$/i.test(rel)) continue;
  const content = readFileSync(file, "utf8");
  for (const finding of scanSecrets(rel, content)) failures.push(`${rel}: ${finding}`);
  if ([".html", ".css", ".js", ".mjs"].includes(extname(rel)) && rel !== "scripts/preflight.mjs") {
    scanBrowserStorage(rel, content);
    scanRemoteRuntimeDependencies(rel, content);
    scanUnsafeDom(rel, content);
  }
}

validateCustomSounds();

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("Preflight passed: required files, secrets, storage, runtime dependencies, and unsafe DOM checks.");

function scanBrowserStorage(file, content) {
  if (!/\b(localStorage|sessionStorage)\b/.test(content)) return;
  const allowed = new Set(["words/src/app.js", "words/src/persistence.js", "words/README.md", "docs/obs-words.md", "README.md"]);
  if (!allowed.has(file)) failures.push(`Disallowed browser storage reference in ${file}`);
  if (/setItem\([^)]*session/i.test(content)) failures.push(`Possible session persistence in ${file}`);
}

function scanRemoteRuntimeDependencies(file, content) {
  if (["shared/ssn/client.js", "src/ssn-client.js"].includes(file)) return;
  if (/(<script[^>]+https?:|<link[^>]+https?:|fonts\.googleapis|googletagmanager|google-analytics|analytics\.js)/i.test(content)) {
    failures.push(`Remote runtime dependency or tracker found in ${file}`);
  }
}

function scanUnsafeDom(file, content) {
  if (/\.innerHTML\s*=|insertAdjacentHTML\s*\(/.test(content)) failures.push(`Unsafe HTML sink found in ${file}`);
}

function validateCustomSounds() {
  const manifestPath = join(root, "alerts/assets/sounds/manifest.json");
  try {
    const manifest = parseSoundManifest(JSON.parse(readFileSync(manifestPath, "utf8")));
    for (const { key, path } of soundManifestEntries(manifest)) {
      const file = join(root, "alerts/assets/sounds", path);
      try {
        const size = statSync(file).size;
        if (!statSync(file).isFile()) failures.push(`Custom sound is not a file: ${key}`);
        if (size > MAX_CUSTOM_SOUND_BYTES) failures.push(`Custom sound exceeds 4 MiB: ${path}`);
      } catch { failures.push(`Custom sound file is missing: ${path}`); }
    }
  } catch (error) {
    failures.push(`Invalid custom sound manifest: ${error.message}`);
  }
}

function listFiles(directory) {
  const out = [];
  for (const entry of readdirSync(directory)) {
    if (["node_modules", ".git", "dist"].includes(entry)) continue;
    const path = join(directory, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) out.push(...listFiles(path));
    else out.push(path);
  }
  return out;
}
