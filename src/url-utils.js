const DEFAULT_LOCAL_BASE = "http://127.0.0.1:8765/";

export function buildFragment(params = {}) {
  const fragment = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    fragment.set(key, String(value));
  }
  return fragment.toString();
}

export function buildOverlayUrl({ base = DEFAULT_LOCAL_BASE, session, production = false, params = {} } = {}) {
  if (!session && !params.mock) {
    throw new Error("A session is required unless mock=1 is provided.");
  }

  const url = new URL(base);
  const fragment = buildFragment({ session, ...params });
  url.hash = fragment;

  if (production && url.protocol !== "https:") {
    throw new Error("Production URLs must use https.");
  }

  return url.toString();
}
