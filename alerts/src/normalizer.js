import { stableHash } from "../../shared/hash.js";
import { platformPresentation } from "../../shared/platform.js";
import { toSafeText, validateMediaUrl } from "../../shared/security/sanitizer.js";

const TYPES = new Set(["follow", "subscription", "resubscription", "membership", "gift", "raid", "donation", "bits", "superchat", "milestone", "generic-event"]);
const LEGACY_EVENTS = Object.freeze({ subscription: "new_subscriber", subgift: "subscription_gift", membership: "sponsorship", new_member: "sponsorship", new_membership: "sponsorship", newmember: "sponsorship", "new-membership": "sponsorship", upgraded_membership: "resub", "upgraded-membership": "resub", membership_upgrade: "resub", membership_milestone: "membermilestone", member_milestone: "membermilestone", gift_membership: "giftpurchase", membership_gift: "giftpurchase", giftmemberships: "giftpurchase", gifted_membership: "giftredemption", gifted_memberships: "giftpurchase", community_gift: "giftpurchase", followed: "new_follower" });

export function normalizeAlert(raw, config = {}) {
  const payload = unwrap(raw);
  if (!payload || typeof payload !== "object" || Array.isArray(payload) || payload.private) return null;
  const platform = platformPresentation(payload.type || payload.platform || payload.sourceName);
  const event = canonicalEvent(payload.event);
  const classification = classifyAlert({ payload, platform: platform.type, event });
  if (!classification) return null;
  const metadata = safeMetadata(payload.meta);
  const timestamp = safeTimestamp(payload.timestamp ?? payload.time);
  const amount = toSafeText(payload.hasDonation || payload.amount || payload.donation || metadata.amount || "", 80);
  const currency = inferCurrency(amount, toSafeText(payload.currency || metadata.currency || "", 12).toUpperCase());
  const count = extractCount(payload, metadata, classification.type, amount);
  const numericAmount = extractNumber(payload.donoValue ?? metadata.amount ?? amount);
  const tier = chooseTier(classification.type, { count, numericAmount, currency });
  const priority = priorityForTier(tier, config);
  const user = toSafeText(payload.chatname || payload.name || payload.username || metadata.supporter || metadata.gifter || "Community", 80);
  const message = toSafeText(payload.chatmessage || payload.message || payload.subtitle || payload.title || metadata.message || "", 280);
  const nativeId = toSafeText(payload.id || payload.mid || metadata.messageId || metadata.id || "", 160);
  const fingerprint = [platform.type, classification.type, user, amount, count || "", message, Math.floor(timestamp / 10_000)].join("|");
  return {
    id: nativeId || stableHash(fingerprint), timestamp, platform: platform.type, type: classification.type,
    priority, tier, user, avatar: validateMediaUrl(payload.chatimg || payload.avatar || metadata.avatar || ""),
    amount, currency, count, message, metadata: { sourceEvent: event || "donation-field", platformLabel: platform.label }
  };
}

export function classifyAlert({ payload, platform, event }) {
  const donationText = toSafeText(payload.hasDonation || payload.amount || payload.donation || "", 80).toLowerCase();
  if (platform === "streamplace") return null;
  if (platform === "twitch" && (event === "cheer" || /\bbits?\b/.test(donationText))) return { type: "bits" };
  if (platform === "youtube" && ["donation", "supersticker"].includes(event)) return { type: "superchat" };
  if (event === "new_follower" || event === "follow") return { type: "follow" };
  if (event === "new_subscriber") return { type: "subscription" };
  if (event === "resub") return { type: "resubscription" };
  if (event === "sponsorship") return { type: "membership" };
  if (["subscription_gift", "giftpurchase", "giftredemption", "gift", "jeweldonation"].includes(event)) return { type: "gift" };
  if (["raid", "redirect"].includes(event)) return { type: "raid" };
  if (event === "membermilestone") return { type: "milestone" };
  if (event === "donation" || (!event && donationText)) return { type: "donation" };
  if (["reward", "hype_train"].includes(event)) return { type: "generic-event" };
  return null;
}

export function chooseTier(type, { count = 0, numericAmount = 0, currency = "" } = {}) {
  const threshold = type === "bits" ? 1000 : majorAmountThreshold(currency);
  if (type === "raid" || (type === "gift" && count >= 5) || (["donation", "superchat", "bits"].includes(type) && numericAmount >= threshold)) return "major";
  if (["subscription", "resubscription", "membership", "gift", "donation", "bits", "superchat"].includes(type)) return "standard";
  return "minor";
}

export function alertDuration(alert, config) {
  return config[`${alert.tier}Duration`];
}

export function isKnownAlertType(value) { return TYPES.has(value); }

function canonicalEvent(value) {
  if (typeof value !== "string") return "";
  const event = toSafeText(value, 64).toLowerCase().replace(/\s+/g, "_");
  return LEGACY_EVENTS[event] || event;
}

function priorityForTier(tier, config) {
  return Number(config[`${tier}Priority`]) || ({ minor: 100, standard: 200, major: 300 }[tier]);
}

function extractCount(payload, meta, type, amount) {
  const candidates = type === "bits" ? [meta.bits, payload.donoValue] : [payload.count, meta.totalGifted, meta.count, meta.viewers, meta.numRaiders, meta.tokens?.amount];
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

function unwrap(raw) {
  return raw?.dataReceived?.overlayNinja ?? raw?.overlayNinja ?? raw;
}
