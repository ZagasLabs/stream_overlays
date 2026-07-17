const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1", ""]);

export function fragmentParams({ hash = "", search = "", hostname = "", allowQueryFallback } = {}) {
  const fragment = new URLSearchParams(stripPrefix(hash, "#"));
  const mayUseQuery = allowQueryFallback ?? LOCAL_HOSTS.has(hostname);
  const query = mayUseQuery ? new URLSearchParams(stripPrefix(search, "?")) : new URLSearchParams();
  return {
    get(name) {
      return fragment.get(name) ?? query.get(name);
    }
  };
}

export function cleanSession(value) {
  if (!value) return "";
  const trimmed = String(value).trim();
  return trimmed.length <= 160 && /^[A-Za-z0-9_-]+$/.test(trimmed) ? trimmed : "";
}

export function parseBool(value, fallback = false) {
  if (value === "1" || value === "true") return true;
  if (value === "0" || value === "false") return false;
  return fallback;
}

export function parseEnum(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

export function parseIntRange(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

export function parseFloatRange(value, fallback, min, max) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

export function parseColor(value, fallback = "#ffffff") {
  if (!value) return fallback;
  const color = String(value).trim();
  if (/^#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?(?:[0-9a-fA-F]{2})?$/.test(color)) return color;
  if (/^(black|white|silver|gray|red|maroon|yellow|olive|lime|green|aqua|teal|blue|navy|fuchsia|purple)$/i.test(color)) return color.toLowerCase();
  return fallback;
}

export function parseMotion(value, mediaReduced = false) {
  return value === "0" || value === "1" ? value === "1" : mediaReduced;
}

export function prefersReducedMotion() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function normalizeIdentityToken(value, maxLength = 120) {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

function stripPrefix(value, prefix) {
  const text = String(value || "");
  return text.startsWith(prefix) ? text.slice(1) : text;
}
