import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { validatePages } from "./validate-pages.mjs";

const root = resolve(process.cwd());
const output = join(root, "dist");
rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });

for (const path of [
  "index.html", "chat/index.html", ".nojekyll", "assets",
  "src/app.js", "src/config.js", "src/ssn-client.js", "src/message-normalizer.js", "src/message-renderer.js", "src/layout-manager.js", "src/sanitizer.js", "src/styles.css",
  "shared/config.js", "shared/hash.js", "shared/platform.js", "shared/security/sanitizer.js", "shared/ssn/client.js", "shared/design/tokens.css",
  "wordlestream/index.html", "wordlestream/src", "wordlestream/assets", "wordlestream/data",
  "alerts/index.html", "alerts/src", "alerts/assets/mark.svg", "alerts/assets/sounds/manifest.json"
]) copy(path);

copyCustomSounds();
stampStaticReferences();

console.log("GitHub Pages artifact built in dist/ (chat, wordlestream, alerts).");
validatePages(output);

function copy(relativePath) {
  cpSync(join(root, relativePath), join(output, relativePath), { recursive: true });
}

function copyCustomSounds() {
  const source = join(root, "alerts/assets/sounds/custom");
  if (!existsSync(source)) return;
  cpSync(source, join(output, "alerts/assets/sounds/custom"), {
    recursive: true,
    filter: (path) => statSync(path).isDirectory() || [".ogg", ".wav"].includes(extname(path).toLowerCase())
  });
}

function stampStaticReferences() {
  const files = walk(output);
  const hash = createHash("sha256");
  for (const file of files.sort()) {
    hash.update(file.slice(output.length));
    hash.update(readFileSync(file));
  }
  const version = hash.digest("hex").slice(0, 12);
  for (const file of files) {
    const extension = extname(file).toLowerCase();
    if (![".html", ".js", ".mjs", ".css"].includes(extension)) continue;
    const source = readFileSync(file, "utf8");
    let stamped = source;
    if (extension === ".html") {
      stamped = stamped.replace(/((?:src|href)=["'])(\.{1,2}\/[^"'?#]+\.(?:js|mjs|css))(["'])/g, `$1$2?v=${version}$3`);
    } else if (extension === ".js" || extension === ".mjs") {
      stamped = stamped
        .replace(/((?:from\s+|import\s*)["'])(\.{1,2}\/[^"'?#]+\.(?:js|mjs))(["'])/g, `$1$2?v=${version}$3`)
        .replace(/(import\(\s*["'])(\.{1,2}\/[^"'?#]+\.(?:js|mjs))(["']\s*\))/g, `$1$2?v=${version}$3`);
    } else {
      stamped = stamped.replace(/(@import\s+(?:url\()?\s*["'])(\.{1,2}\/[^"'?#]+\.css)(["'])/g, `$1$2?v=${version}$3`);
    }
    if (stamped !== source) writeFileSync(file, stamped);
  }
  console.log(`Static module cache key: ${version}.`);
}

function walk(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}
