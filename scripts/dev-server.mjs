import { createServer } from "node:http";
import { createReadStream, statSync } from "node:fs";
import { extname, join, normalize, relative, resolve } from "node:path";

const root = resolve(process.cwd());
const host = "127.0.0.1";
const port = Number(process.env.PORT || 8765);
const mock = process.argv.includes("--mock");
const app = readArg("--app");

const TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"]
]);

const server = createServer((request, response) => {
  const url = new URL(request.url || "/", `http://${host}:${port}`);
  const pathname = decodeURIComponent(url.pathname);
  let target = normalize(join(root, pathname === "/" ? "/index.html" : pathname));

  if (relative(root, target).startsWith("..")) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    let stats = statSync(target);
    if (stats.isDirectory()) {
      target = join(target, "index.html");
      stats = statSync(target);
    }
    if (!stats.isFile()) throw new Error("not file");
    response.writeHead(200, {
      "content-type": TYPES.get(extname(target)) || "application/octet-stream",
      "cache-control": "no-store"
    });
    createReadStream(target).pipe(response);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

server.listen(port, host, () => {
  const base = `http://${host}:${port}/`;
  const appPath = app ? `${app.replace(/^\/+|\/+$/g, "")}/` : "";
  const url = mock ? `${base}${appPath}#mock=1&debug=1` : `${base}${appPath}`;
  console.log(`Serving ${root}`);
  console.log(url);
});

process.on("SIGINT", () => server.close(() => process.exit(0)));
process.on("SIGTERM", () => server.close(() => process.exit(0)));

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || "" : "";
}
