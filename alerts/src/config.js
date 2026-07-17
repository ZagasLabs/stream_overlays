import { cleanSession, fragmentParams, parseBool, parseColor, parseEnum, parseFloatRange, parseIntRange, parseMotion, prefersReducedMotion } from "../../shared/config.js";

export const DEFAULT_ALERT_CONFIG = Object.freeze({
  position: "top", side: "right", scale: 1, accent: "#f20d69",
  minorDuration: 5000, standardDuration: 7500, majorDuration: 11000,
  minorPriority: 100, standardPriority: 200, majorPriority: 300,
  sound: true, volume: 0.24, minorVolume: 0.42, standardVolume: 0.62, majorVolume: 0.8,
  showAvatar: true, showPlatform: true, debug: false, mock: false, reduceMotion: false,
  maxQueue: 30
});

export function parseAlertsConfig({ hash = "", search = "", hostname = "", mediaReduceMotion = false, allowQueryFallback } = {}) {
  const params = fragmentParams({ hash, search, hostname, allowQueryFallback });
  const get = (name) => params.get(name);
  const session = cleanSession(get("session"));
  const mock = parseBool(get("mock"), false);
  return {
    session,
    position: parseEnum(get("position"), ["top", "center", "bottom"], DEFAULT_ALERT_CONFIG.position),
    side: parseEnum(get("side"), ["left", "center", "right"], DEFAULT_ALERT_CONFIG.side),
    scale: parseFloatRange(get("scale"), DEFAULT_ALERT_CONFIG.scale, .65, 1.5),
    accent: parseColor(get("accent"), DEFAULT_ALERT_CONFIG.accent),
    minorDuration: parseIntRange(get("minorDuration"), DEFAULT_ALERT_CONFIG.minorDuration, 3000, 8000),
    standardDuration: parseIntRange(get("standardDuration"), DEFAULT_ALERT_CONFIG.standardDuration, 4500, 12000),
    majorDuration: parseIntRange(get("majorDuration"), DEFAULT_ALERT_CONFIG.majorDuration, 7000, 18000),
    minorPriority: parseIntRange(get("minorPriority"), DEFAULT_ALERT_CONFIG.minorPriority, 1, 999),
    standardPriority: parseIntRange(get("standardPriority"), DEFAULT_ALERT_CONFIG.standardPriority, 1, 999),
    majorPriority: parseIntRange(get("majorPriority"), DEFAULT_ALERT_CONFIG.majorPriority, 1, 999),
    sound: parseBool(get("sound"), DEFAULT_ALERT_CONFIG.sound),
    volume: parseFloatRange(get("volume"), DEFAULT_ALERT_CONFIG.volume, 0, .65),
    minorVolume: parseFloatRange(get("minorVolume"), DEFAULT_ALERT_CONFIG.minorVolume, 0, 1),
    standardVolume: parseFloatRange(get("standardVolume"), DEFAULT_ALERT_CONFIG.standardVolume, 0, 1),
    majorVolume: parseFloatRange(get("majorVolume"), DEFAULT_ALERT_CONFIG.majorVolume, 0, 1),
    showAvatar: parseBool(get("showAvatar"), true),
    showPlatform: parseBool(get("showPlatform"), true),
    debug: parseBool(get("debug"), false),
    mock,
    reduceMotion: parseMotion(get("reduceMotion"), mediaReduceMotion),
    maxQueue: DEFAULT_ALERT_CONFIG.maxQueue,
    valid: mock || Boolean(session)
  };
}

export function parseAlertsConfigFromLocation(location = window.location) {
  return parseAlertsConfig({ hash: location.hash, search: location.search, hostname: location.hostname, mediaReduceMotion: prefersReducedMotion() });
}
