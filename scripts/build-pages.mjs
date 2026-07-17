import { cpSync, existsSync, mkdirSync, rmSync, statSync } from "node:fs";
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
