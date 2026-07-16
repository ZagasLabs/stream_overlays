export const DEFAULT_CONFIG = Object.freeze({
  side: "right",
  max: 6,
  duration: 18000,
  eventDuration: 26000,
  accent: "#ffffff",
  scale: 1,
  debug: false,
  mock: false,
  reduceMotion: "auto",
  showPlatform: true,
  showBadges: true,
  showAvatar: true
});

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1", ""]);

export function parseConfigFromLocation(location = window.location, options = {}) {
  const mediaReduceMotion = options.mediaReduceMotion ?? matchReduceMotion();
  const allowQueryFallback = options.allowQueryFallback ?? LOCAL_HOSTS.has(location.hostname);
  return parseConfig({
    hash: location.hash,
    search: location.search,
    mediaReduceMotion,
    allowQueryFallback
  });
}

export function parseConfig({ hash = "", search = "", mediaReduceMotion = false, allowQueryFallback = false } = {}) {
  const fragment = new URLSearchParams(stripPrefix(hash, "#"));
  const query = allowQueryFallback ? new URLSearchParams(stripPrefix(search, "?")) : new URLSearchParams();
  const get = (name) => fragment.get(name) ?? query.get(name);
  const reduceMotionRaw = get("reduceMotion");
  const mock = parseBool(get("mock"), DEFAULT_CONFIG.mock);

  return {
    session: cleanSession(get("session")),
    side: parseEnum(get("side"), ["left", "right"], DEFAULT_CONFIG.side),
    max: parseIntRange(get("max"), DEFAULT_CONFIG.max, 1, 10),
    duration: parseIntRange(get("duration"), DEFAULT_CONFIG.duration, 5000, 60000),
    eventDuration: parseIntRange(get("eventDuration"), DEFAULT_CONFIG.eventDuration, 8000, 90000),
    accent: parseColor(get("accent"), DEFAULT_CONFIG.accent),
    scale: parseFloatRange(get("scale"), DEFAULT_CONFIG.scale, 0.75, 1.35),
    debug: parseBool(get("debug"), DEFAULT_CONFIG.debug),
    mock,
    reduceMotion: reduceMotionRaw === "0" || reduceMotionRaw === "1" ? reduceMotionRaw === "1" : mediaReduceMotion,
    showPlatform: parseBool(get("showPlatform"), DEFAULT_CONFIG.showPlatform),
    showBadges: parseBool(get("showBadges"), DEFAULT_CONFIG.showBadges),
    showAvatar: parseBool(get("showAvatar"), DEFAULT_CONFIG.showAvatar),
    valid: mock || Boolean(cleanSession(get("session")))
  };
}

function stripPrefix(value, prefix) {
  return String(value || "").startsWith(prefix) ? String(value).slice(1) : String(value || "");
}

function cleanSession(value) {
  if (!value) return "";
  const trimmed = String(value).trim();
  if (trimmed.length > 160) return "";
  return /^[A-Za-z0-9_-]+$/.test(trimmed) ? trimmed : "";
}

function parseEnum(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function parseBool(value, fallback) {
  if (value === "1" || value === "true") return true;
  if (value === "0" || value === "false") return false;
  return fallback;
}

function parseIntRange(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function parseFloatRange(value, fallback, min, max) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function parseColor(value, fallback) {
  if (!value) return fallback;
  const color = String(value).trim();
  if (/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?([0-9a-fA-F]{2})?$/.test(color)) return color;
  if (/^(black|white|silver|gray|red|maroon|yellow|olive|lime|green|aqua|teal|blue|navy|fuchsia|purple)$/i.test(color)) return color.toLowerCase();
  if (/^rgba?\(\s*(\d{1,3}\s*,\s*){2}\d{1,3}(\s*,\s*(0|1|0?\.\d+))?\s*\)$/.test(color)) return color;
  return fallback;
}

function matchReduceMotion() {
  return typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
