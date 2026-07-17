export function buildFragment(params = {}) {
  const fragment = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") fragment.set(key, String(value));
  }
  return fragment.toString();
}

export function buildOverlayUrl({ base = "http://127.0.0.1:8765/", path = "", session, production = false, params = {} } = {}) {
  if (!session && !params.mock) throw new Error("A session is required unless mock=1 is provided.");
  const url = new URL(path.replace(/^\/+/, ""), ensureTrailingSlash(base));
  url.hash = buildFragment({ session, ...params });
  if (production && url.protocol !== "https:") throw new Error("Production URLs must use https.");
  return url.toString();
}

export function ensureTrailingSlash(value) {
  return value.endsWith("/") ? value : `${value}/`;
}
