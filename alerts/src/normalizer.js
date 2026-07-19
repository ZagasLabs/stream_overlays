import { stableHash } from "../../shared/hash.js";
import { platformPresentation } from "../../shared/platform.js";
import { toSafeText, validateMediaUrl } from "../../shared/security/sanitizer.js";
import { flattenPayloads } from "../../shared/ssn/client.js";

const TYPES = new Set(["follow", "subscription", "resubscription", "membership", "gift", "raid", "donation", "bits", "superchat", "hype-train", "milestone", "generic-event"]);
const KNOWN_SOURCES = new Set(["facebook", "instagram", "kick", "kofi", "rumble", "streamlabs", "streamplace", "tiktok", "twitch", "whatnot", "x", "youtube", "youtubeshorts"]);
const COUNT_EVENTS = new Set(["viewer_update", "viewer_updates", "follower_update", "subscriber_update", "view_update", "stream_status", "stream_online", "stream_offline", "ad_break", "ad_break_begin", "ad_break_end"]);
const GENERIC_EVENTS = new Set(["true", "event", "notification", "system"]);
const LEGACY_EVENTS = Object.freeze({
  subscription: "new_subscriber", subscriber: "new_subscriber", "new-subscriber": "new_subscriber",
  channel_subscription_new: "new_subscriber", channel_subscription_start: "new_subscriber", channel_subscription: "new_subscriber",
  subgift: "subscription_gift", gifted: "subscription_gift", channel_subscription_gifts: "subscription_gift",
  channel_subscription_gift: "subscription_gift", subscription_gifts: "subscription_gift",
  membership: "sponsorship", sponsor: "sponsorship", new_member: "sponsorship", new_membership: "sponsorship",
  newmember: "sponsorship", "new-membership": "sponsorship", upgraded_membership: "resub",
  "upgraded-membership": "resub", membership_upgrade: "resub", subscription_renewal: "resub",
  membership_milestone: "membermilestone", member_milestone: "membermilestone",
  gift_membership: "giftpurchase", membership_gift: "giftpurchase", giftmemberships: "giftpurchase",
  gifted_membership: "giftredemption", gifted_memberships: "giftpurchase", community_gift: "giftpurchase",
  followed: "new_follower", channel_followed: "new_follower", follower_added: "new_follower",
  channel_cheer: "cheer", channel_raid: "raid", super_chat: "donation", superchat: "donation",
  super_sticker: "supersticker", gift_send: "gift", gift_sent: "gift", gift_message: "gift",
  live_gift: "gift", tiktok_gift: "gift", tip: "donation", support: "donation"
});

export function normalizeAlert(raw, config = {}) {
  return analyzeAlertPayload(raw, config).alert;
}

export function analyzeAlertPayload(raw, config = {}) {
  const payload = unwrap(raw);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return diagnosticResult("ignored", "malformed-payload");
  }
  if (payload.private === true) return diagnosticResult("ignored", "private-payload", payload);

  const platform = platformPresentation(payload.platform || payload.type || payload.meta?.sourcePlatform || payload.meta?.platform);
  const event = pickEvent(payload);
  const classification = classifyAlert({ payload, platform: platform.type, event });
  if (!classification) {
    const reason = rejectionReason(payload, platform.type, event);
    return diagnosticResult(reason === "regular-chat" ? "chat" : "ignored", reason, payload, platform.type, event);
  }

  const metadata = safeMetadata(payload.meta);
  const timestamp = safeTimestamp(payload.timestamp ?? payload.time);
  const amount = toSafeText(
    payload.hasDonation || payload.amount || payload.donation || metadata.hasDonation || metadata.donation || metadata.amount || "",
    80
  );
  const currency = inferCurrency(amount, toSafeText(payload.currency || metadata.currency || "", 12).toUpperCase());
  const count = extractCount(payload, metadata, classification.type, amount);
  const numericAmount = extractNumber(payload.donoValue ?? payload.donationValue ?? metadata.donoValue ?? metadata.donationValue ?? metadata.amount ?? amount);
  const tier = chooseTier(classification.type, { count, numericAmount, currency });
  const priority = priorityForTier(tier, config);
  const user = toSafeText(
    payload.chatname || payload.name || payload.username || payload.gifter || metadata.supporter || metadata.gifter || metadata.fromLogin || metadata.displayName || metadata.broadcasterUserName || "Community",
    80
  );
  const message = toSafeText(payload.chatmessage || payload.message || payload.subtitle || payload.title || metadata.message || hypeTrainMessage(metadata, classification.type), 280);
  const nativeId = toSafeText(payload.id || payload.mid || metadata.messageId || metadata.eventId || metadata.id || "", 160);
  const fingerprint = [platform.type, classification.type, user, amount, count || "", message, Math.floor(timestamp / 10_000)].join("|");
  const alertMetadata = { sourceEvent: event || "derived-field", platformLabel: platform.label };
  if (classification.type === "hype-train") {
    alertMetadata.phase = toSafeText(metadata.phase || "", 24);
    alertMetadata.level = boundedNumber(metadata.level, 0, 100);
    alertMetadata.progress = boundedNumber(metadata.progress, 0, 1_000_000_000);
    alertMetadata.goal = boundedNumber(metadata.goal, 0, 1_000_000_000);
  }
  const alert = {
    id: nativeId || stableHash(fingerprint), timestamp, platform: platform.type, type: classification.type,
    priority, tier, user,
    avatar: validateMediaUrl(payload.chatimg || payload.avatar || metadata.avatar || metadata.avatarUrl || ""),
    amount, currency, count, message,
    metadata: alertMetadata
  };
  return { kind: "event", reason: "accepted", payload, platform: platform.type, event, alert };
}

export function classifyAlert({ payload, platform, event }) {
  const metadata = safeMetadata(payload.meta);
  const donationText = toSafeText(
    payload.hasDonation || payload.amount || payload.donation || metadata.hasDonation || metadata.donation || "",
    80
  ).toLowerCase();
  if (platform === "streamplace" || COUNT_EVENTS.has(event)) return null;
  if (["cheer", "bits"].includes(event) || (platform === "twitch" && /\bbits?\b/.test(donationText))) return { type: "bits" };
  if (platform === "youtube" && ["donation", "supersticker", "thankyou"].includes(event)) return { type: "superchat" };
  if (["new_follower", "follow"].includes(event)) return { type: "follow" };
  if (event === "new_subscriber") return { type: "subscription" };
  if (event === "resub") return { type: "resubscription" };
  if (event === "sponsorship") return { type: platform === "youtube" ? "membership" : "subscription" };
  if (["subscription_gift", "giftpurchase", "giftredemption", "gift", "jeweldonation"].includes(event)) return { type: "gift" };
  if (["raid", "host", "hosting", "redirect"].includes(event)) return { type: "raid" };
  if (event === "membermilestone") return { type: "milestone" };
  if (["donation", "thankyou"].includes(event) || (!event && donationText)) return { type: "donation" };
  if (event === "hype_train") return { type: "hype-train" };
  if (event === "reward") return { type: "generic-event" };
  if (GENERIC_EVENTS.has(event)) return classifyGenericText(payload);
  if (!event && toSafeText(payload.membership, 100) && !toSafeText(payload.chatmessage, 280)) {
    return { type: platform === "youtube" ? "membership" : "subscription" };
  }
  return null;
}

export function chooseTier(type, { count = 0, numericAmount = 0, currency = "" } = {}) {
  const threshold = type === "bits" ? 1000 : majorAmountThreshold(currency);
  if (["raid", "hype-train"].includes(type) || (type === "gift" && count >= 5) || (["donation", "superchat", "bits"].includes(type) && numericAmount >= threshold)) return "major";
  if (["subscription", "resubscription", "membership", "gift", "donation", "bits", "superchat"].includes(type)) return "standard";
  return "minor";
}

export function alertDuration(alert, config) {
  return config[`${alert.tier}Duration`];
}

export function isKnownAlertType(value) { return TYPES.has(value); }

function pickEvent(payload) {
  const metadata = safeMetadata(payload.meta);
  for (const candidate of [
    payload.event, payload.eventType, payload.rawType, payload.alertType,
    metadata.event, metadata.eventType, metadata.originalEventType, metadata.rawType, metadata.alertType, metadata.eventName
  ]) {
    const event = canonicalEvent(candidate);
    if (event) return event;
  }
  const typedEvent = canonicalEvent(payload.type);
  if (typedEvent && !KNOWN_SOURCES.has(typedEvent)) return typedEvent;
  return "";
}

function canonicalEvent(value) {
  if (value === true) return "true";
  if (typeof value !== "string") return "";
  const event = toSafeText(value, 64).toLowerCase().replace(/[.\s-]+/g, "_").replace(/_+/g, "_");
  return LEGACY_EVENTS[event] || event;
}

function classifyGenericText(payload) {
  const metadata = safeMetadata(payload.meta);
  const text = toSafeText([
    payload.chatmessage, payload.title, payload.subtitle, payload.membership,
    metadata.eventType, metadata.rawType, metadata.alertType, metadata.eventName
  ].filter(Boolean).join(" "), 500).toLowerCase();
  if (!text) return null;
  if (/\b(raid|raiding|raided|host|hosting|hosted|redirect)\b/.test(text)) return { type: "raid" };
  if (/\b(cheer|cheered|cheering|bits?)\b/.test(text)) return { type: "bits" };
  if (/\b(donation|donated|tip|tipped|support|super[ _-]?chat|super[ _-]?sticker)\b/.test(text)) return { type: "donation" };
  if (/\b(sub|subs|subscriber|subscribed|subscription|resub|member|membership|sponsor|sponsorship)\b/.test(text)) return { type: "subscription" };
  if (/\bfollow(?:ed|ing)?\b/.test(text)) return { type: "follow" };
  return null;
}

function rejectionReason(payload, platform, event) {
  if (platform === "streamplace") return "unsupported-platform";
  if (COUNT_EVENTS.has(event)) return "count-or-status-event";
  const metadata = safeMetadata(payload.meta);
  const hasDonation = Boolean(toSafeText(payload.hasDonation || payload.amount || payload.donation || metadata.hasDonation || metadata.donation, 80));
  const hasMembership = Boolean(toSafeText(payload.membership, 100));
  const hasChat = Boolean(toSafeText(payload.chatmessage || payload.message, 280));
  if (!event && !hasDonation && !hasMembership && hasChat) return "regular-chat";
  if (event) return `unknown-event:${event}`;
  return "no-alert-signals";
}

function diagnosticResult(kind, reason, payload = null, platform = "unknown", event = "") {
  return { kind, reason, payload, platform, event, alert: null };
}

function priorityForTier(tier, config) {
  return Number(config[`${tier}Priority`]) || ({ minor: 100, standard: 200, major: 300 }[tier]);
}

function extractCount(payload, meta, type, amount) {
  const candidates = type === "bits"
    ? [meta.bits, payload.bits, payload.donoValue]
    : [payload.count, payload.total, meta.totalGifted, meta.giftCount, meta.count, meta.viewers, meta.numRaiders, meta.tokens?.amount];
  const value = candidates.find((candidate) => Number.isFinite(Number(candidate)));
  if (value !== undefined) return Math.max(0, Math.min(1_000_000, Math.round(Number(value))));
  if (type === "gift") {
    const match = String(amount || "").match(/\b(\d{1,6})\s*(?:gift|gifted|subs?|memberships?)\b/i);
    if (match) return Number(match[1]);
  }
  return null;
}

function inferCurrency(amount, explicit) {
  if (explicit) return explicit;
  const text = String(amount || "").toUpperCase();
  if (/MX\$|\bMXN\b/.test(text)) return "MXN";
  if (/CA\$|\bCAD\b/.test(text)) return "CAD";
  if (/A\$|\bAUD\b/.test(text)) return "AUD";
  if (/R\$|\bBRL\b/.test(text)) return "BRL";
  if (/€|\bEUR\b/.test(text)) return "EUR";
  if (/£|\bGBP\b/.test(text)) return "GBP";
  if (/¥|\bJPY\b/.test(text)) return "JPY";
  if (/\bUSD\b|^\s*\$/.test(text)) return "USD";
  return "";
}

function majorAmountThreshold(currency) {
  return ({ CAD: 75, AUD: 75, MXN: 1000, JPY: 7500, BRL: 250 })[currency] || 50;
}

function extractNumber(value) {
  if (Number.isFinite(Number(value))) return Number(value);
  const match = String(value || "").replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function safeMetadata(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function safeTimestamp(value) {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : Date.now();
}

function hypeTrainMessage(metadata, type) {
  if (type !== "hype-train") return "";
  const progress = boundedNumber(metadata.progress, 0, 1_000_000_000);
  const goal = boundedNumber(metadata.goal, 0, 1_000_000_000);
  if (progress !== null && goal !== null && goal > 0) return `${progress.toLocaleString()} / ${goal.toLocaleString()} toward the next level`;
  return "The community hype train is active";
}

function boundedNumber(value, min, max) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : null;
}

function unwrap(raw) {
  return flattenPayloads(raw)[0] ?? null;
}
