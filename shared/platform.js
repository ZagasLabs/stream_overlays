import { normalizeIdentityToken } from "./config.js";
import { toSafeText } from "./security/sanitizer.js";

const PLATFORM_ALIASES = Object.freeze({ yt: "youtube", youtube: "youtube", youtubeshorts: "youtubeshorts", twitch: "twitch", kick: "kick", streamplace: "streamplace", "stream.place": "streamplace" });
const PLATFORM_LABELS = Object.freeze({ youtube: "YouTube", youtubeshorts: "YouTube Shorts", twitch: "Twitch", kick: "Kick", streamplace: "Streamplace", unknown: "Chat" });
const PLATFORM_GLYPHS = Object.freeze({ youtube: "YT", youtubeshorts: "YT", twitch: "TW", kick: "K", streamplace: "SP", unknown: "•" });

export function normalizePlatform(value) {
  const key = normalizeIdentityToken(value, 40).replace(/\s+/g, "");
  return PLATFORM_ALIASES[key] || (/^[a-z0-9_-]{1,40}$/.test(key) ? key : "unknown");
}

export function platformPresentation(value) {
  const type = normalizePlatform(value);
  return { type, label: PLATFORM_LABELS[type] || titleCase(type), glyph: PLATFORM_GLYPHS[type] || type.slice(0, 2).toUpperCase() };
}

export function platformIdentity(payload = {}) {
  const platform = normalizePlatform(payload.type || payload.platform || payload.sourceName);
  const meta = payload.meta && typeof payload.meta === "object" && !Array.isArray(payload.meta) ? payload.meta : {};
  const displayName = toSafeText(payload.chatname || payload.displayName || payload.username || payload.name || "Anonymous", 80);
  const strongId = firstNonEmpty(
    platform === "youtube" ? [meta.channelId, payload.channelId, payload.userid, payload.userId] :
      platform === "streamplace" ? [meta.identity, payload.identity, payload.userid, payload.userId] :
        [payload.userid, payload.userId, meta.userId, meta.channelId]
  );
  const identityPart = normalizeIdentityToken(strongId || displayName, 120).replace(/\s+/g, "_");
  return {
    platform,
    displayName,
    id: `${platform}:${identityPart || "anonymous"}`,
    strong: Boolean(strongId)
  };
}

export function verifiedRoles(payload = {}) {
  const meta = payload.meta && typeof payload.meta === "object" && !Array.isArray(payload.meta) ? payload.meta : {};
  return {
    broadcaster: payload.broadcaster === true || payload.owner === true || meta.broadcaster === true || meta.isBroadcaster === true,
    moderator: payload.moderator === true || meta.moderator === true || meta.isModerator === true
  };
}

function firstNonEmpty(values) {
  return values.find((value) => typeof value === "string" || typeof value === "number") ?? "";
}

function titleCase(value) {
  return value.replace(/\b\w/g, (character) => character.toUpperCase());
}
