const ENTITY_MAP = Object.freeze({
  amp: "&",
  lt: "<",
  gt: ">",
  quot: "\"",
  apos: "'",
  nbsp: " "
});

const IMG_TAG_RE = /<img\b[^>]*>/gi;
const ATTR_RE = /([a-zA-Z0-9:-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g;

export function toSafeText(value, maxLength = 1200) {
  const text = decodeEntities(stripTags(String(value ?? ""))).replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trim()}...` : text;
}

export function sanitizeMessageParts(value) {
  const html = String(value ?? "");
  const parts = [];
  const safeEmoteNodes = [];
  let cursor = 0;

  for (const match of html.matchAll(IMG_TAG_RE)) {
    const before = html.slice(cursor, match.index);
    addTextPart(parts, before);

    const attrs = parseAttrs(match[0]);
    const src = validateMediaUrl(attrs.src);
    if (src) {
      const emote = {
        type: "img",
        src,
        alt: toSafeText(attrs.alt || attrs.title || attrs["data-name"] || "emote", 80),
        className: sanitizeTokenList(attrs.class, ["emote", "emoji", "badge", "zero-width-emote"])
      };
      safeEmoteNodes.push(emote);
      parts.push(emote);
    }

    cursor = match.index + match[0].length;
  }

  addTextPart(parts, html.slice(cursor));

  if (parts.length === 0) {
    addTextPart(parts, html);
  }

  return {
    text: parts.filter((part) => part.type === "text").map((part) => part.text).join(" ").replace(/\s+/g, " ").trim(),
    parts,
    safeEmoteNodes
  };
}

export function sanitizeBadgeList(value) {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  return list.map((badge) => {
    if (typeof badge === "string") {
      const src = validateMediaUrl(badge);
      return src ? { src, label: "badge" } : { label: toSafeText(badge, 48) };
    }
    if (!badge || typeof badge !== "object") return null;
    const src = validateMediaUrl(badge.src || badge.url || badge.image || badge.img);
    const label = toSafeText(badge.label || badge.name || badge.title || badge.type || "badge", 48);
    if (!src && /^(badge|img|image|svg|icon)$/i.test(label)) return null;
    if (!src && !label) return null;
    return src ? { src, label } : { label };
  }).filter(Boolean).slice(0, 8);
}

export function validateMediaUrl(value) {
  if (!value) return "";
  try {
    const raw = String(value).trim();
    if (!/^https?:\/\//i.test(raw)) return "";
    const url = new URL(raw);
    const isLocal = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
    if (url.protocol === "https:" || (url.protocol === "http:" && isLocal)) {
      return url.href;
    }
  } catch {
    return "";
  }
  return "";
}

function addTextPart(parts, value) {
  const text = toSafeText(value);
  if (text) parts.push({ type: "text", text });
}

function parseAttrs(tag) {
  const attrs = {};
  for (const match of tag.matchAll(ATTR_RE)) {
    const name = match[1].toLowerCase();
    if (name.startsWith("on") || name === "style") continue;
    attrs[name] = decodeEntities(match[3] ?? match[4] ?? match[5] ?? "");
  }
  return attrs;
}

function sanitizeTokenList(value, allowedTokens) {
  const allowed = new Set(allowedTokens);
  return String(value || "")
    .split(/\s+/)
    .filter((token) => allowed.has(token))
    .join(" ");
}

function stripTags(value) {
  return value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, "")
    .replace(/<[^>]+>/g, " ");
}

function decodeEntities(value) {
  return String(value).replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (_, entity) => {
    if (entity[0] === "#") {
      const radix = entity[1]?.toLowerCase() === "x" ? 16 : 10;
      const raw = entity[1]?.toLowerCase() === "x" ? entity.slice(2) : entity.slice(1);
      const code = Number.parseInt(raw, radix);
      return Number.isFinite(code) ? String.fromCodePoint(code) : "";
    }
    return ENTITY_MAP[entity] ?? "";
  });
}
