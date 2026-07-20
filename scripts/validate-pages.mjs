import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { scanSecrets } from "../shared/security/secret-scan.js";

export function validatePages(output = resolve(process.cwd(), "dist")) {
  const failures = [];
  const files = walk(output);
  const relativeFiles = new Set(files.map((file) => relative(output, file).replaceAll("\\", "/")));
  for (const required of ["index.html", "chat/index.html", "words/index.html", "alerts/index.html", "shared/ssn/client.js"]) {
    if (!relativeFiles.has(required)) failures.push(`Artifact missing ${required}`);
  }
  for (const file of files) {
    const rel = relative(output, file).replaceAll("\\", "/");
    if (/(^|\/)(?:tests?|fixtures?|docs?|scripts?|node_modules)(\/|$)/.test(rel)) failures.push(`Development-only path in artifact: ${rel}`);
    if (/\.(?:html|css|js|mjs|json|svg)$/i.test(rel)) {
      const content = readFileSync(file, "utf8");
      for (const finding of scanSecrets(rel, content)) failures.push(`${rel}: ${finding}`);
      for (const reference of localReferences(content, extname(rel))) {
        const target = resolve(dirname(file), reference.split(/[?#]/)[0]);
        if (!existsSync(target)) failures.push(`${rel}: missing local reference ${reference}`);
        if (/\.(?:js|mjs|css)(?:[?#]|$)/i.test(reference) && !/[?&]v=[a-f0-9]{12}(?:[&#]|$)/i.test(reference)) {
          failures.push(`${rel}: unstamped cacheable reference ${reference}`);
        }
      }
    }
  }
  if (failures.length) throw new Error(failures.join("\n"));
  console.log(`Pages artifact validated (${files.length} files, no secrets or development-only paths).`);
  return { files: files.length };
}

function localReferences(content, extension) {
  const matches = [];
  const patterns = extension === ".html"
    ? [/(?:src|href)=["']([^"']+)["']/g]
    : extension === ".js" || extension === ".mjs"
      ? [/(?:from\s+|import\s*)["']([^"']+)["']/g]
      : extension === ".css" ? [/@import\s+["']([^"']+)["']/g] : [];
  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) if (/^\.{1,2}\//.test(match[1])) matches.push(match[1]);
  }
  return matches;
}

function walk(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

if (process.argv[1] && resolve(process.argv[1]) === new URL(import.meta.url).pathname) validatePages();
