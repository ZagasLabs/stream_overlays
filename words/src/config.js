import { cleanSession, fragmentParams, normalizeIdentityToken, parseBool, parseColor, parseEnum, parseFloatRange, parseIntRange, parseMotion, prefersReducedMotion } from "../../shared/config.js";

export const DEFAULT_WORDS_CONFIG = Object.freeze({
  lang: "en", commands: ["!words", "!w", "!word"], maxAttempts: 6, wordLength: 5,
  userCooldown: 10_000, globalCooldown: 1_500, maxQueue: 20, accents: "fold",
  sound: false, volume: 0.15, accent: "#f20d69", scale: 1,
  debug: false, mock: false, server: true, reduceMotion: false, showPlatform: true, showParticipant: true
});

export function parseWordsConfig({ hash = "", search = "", hostname = "", mediaReduceMotion = false, allowQueryFallback } = {}) {
  const params = fragmentParams({ hash, search, hostname, allowQueryFallback });
  const get = (name) => params.get(name);
  const mock = parseBool(get("mock"), false);
  const commands = parseCommands(get("command"));
  const session = cleanSession(get("session"));
  return {
    session,
    lang: parseEnum(get("lang"), ["en", "es"], DEFAULT_WORDS_CONFIG.lang),
    commands,
    maxAttempts: parseIntRange(get("maxAttempts"), DEFAULT_WORDS_CONFIG.maxAttempts, 3, 10),
    wordLength: parseIntRange(get("wordLength"), DEFAULT_WORDS_CONFIG.wordLength, 4, 8),
    userCooldown: Math.round(parseFloatRange(get("userCooldown"), DEFAULT_WORDS_CONFIG.userCooldown / 1000, 1, 120) * 1000),
    globalCooldown: Math.round(parseFloatRange(get("globalCooldown"), DEFAULT_WORDS_CONFIG.globalCooldown / 1000, 0, 30) * 1000),
    maxQueue: DEFAULT_WORDS_CONFIG.maxQueue,
    accents: parseEnum(get("accents"), ["fold", "preserve"], DEFAULT_WORDS_CONFIG.accents),
    admins: parseAdmins(get("admins")),
    sound: parseBool(get("sound"), DEFAULT_WORDS_CONFIG.sound),
    volume: parseFloatRange(get("volume"), DEFAULT_WORDS_CONFIG.volume, 0, 0.5),
    accent: parseColor(get("accent"), DEFAULT_WORDS_CONFIG.accent),
    scale: parseFloatRange(get("scale"), DEFAULT_WORDS_CONFIG.scale, 0.7, 1.4),
    debug: parseBool(get("debug"), false),
    mock,
    server: parseBool(get("server"), DEFAULT_WORDS_CONFIG.server),
    reduceMotion: parseMotion(get("reduceMotion"), mediaReduceMotion),
    showPlatform: parseBool(get("showPlatform"), true),
    showParticipant: parseBool(get("showParticipant"), true),
    valid: mock || Boolean(session)
  };
}

export function parseWordsConfigFromLocation(location = window.location) {
  return parseWordsConfig({ hash: location.hash, search: location.search, hostname: location.hostname, mediaReduceMotion: prefersReducedMotion() });
}

export function parseCommands(value) {
  if (!value) return [...DEFAULT_WORDS_CONFIG.commands];
  const commands = String(value).split(",").map((item) => normalizeIdentityToken(item, 16).replace(/\s+/g, ""))
    .filter((item) => /^[!/.][a-z0-9]{1,12}$/.test(item));
  return [...new Set(commands)].slice(0, 4).length ? [...new Set(commands)].slice(0, 4) : [...DEFAULT_WORDS_CONFIG.commands];
}

export function parseAdmins(value) {
  if (!value) return [];
  return [...new Set(String(value).split(",").map((entry) => {
    const [platform, ...identityParts] = normalizeIdentityToken(entry, 140).split(":");
    const identity = identityParts.join(":").replace(/\s+/g, "_");
    return ["twitch", "kick", "youtube", "streamplace"].includes(platform) && /^[\p{L}\p{N}_.:-]{1,120}$/u.test(identity) ? `${platform}:${identity}` : "";
  }).filter(Boolean))].slice(0, 24);
}
