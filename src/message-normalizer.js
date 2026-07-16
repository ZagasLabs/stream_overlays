import { sanitizeBadgeList, sanitizeMessageParts, toSafeText, validateMediaUrl } from "./sanitizer.js";

const EVENT_DEFINITIONS = Object.freeze([
  { pattern: /\b(raid|raided|host|hosted)\b/, type: "raid", label: "Raid", major: true },
  { pattern: /\b(gift|gifted|gifting)\b/, type: "gift", label: "Gift", major: true },
  { pattern: /\b(sub|resub|subscription|subscribed|membership|joined as a member)\b/, type: "subscription", label: "Subscription", major: false },
  { pattern: /\b(follow|followed|follower)\b/, type: "follow", label: "Follow", major: false },
  { pattern: /\b(like|liked|heart|hearts)\b/, type: "reaction", label: "Reaction", major: false }
]);

const EVENT_MESSAGE_DEFINITIONS = Object.freeze([
  { pattern: /\b(?:raided|hosted)(?:\s+(?:with|the channel))?\b/, type: "raid", label: "Raid", major: true },
  { pattern: /\b(?:gifted|sent)\s+(?:a\s+)?(?:sub|subscription|membership|gift)\b/, type: "gift", label: "Gift", major: true },
  { pattern: /\b(?:subscribed|resubscribed|renewed (?:their )?membership|became a member|joined as a member)\b/, type: "subscription", label: "Subscription", major: false },
  { pattern: /\b(?:started following|is now following|followed (?:the|your|this) (?:channel|stream|account))\b/, type: "follow", label: "Follow", major: false },
  { pattern: /\b(?:(?:sent|gave) \d*\s*(?:likes?|hearts?)|liked (?:the|your|this) (?:stream|video))\b/, type: "reaction", label: "Reaction", major: false }
]);

export function normalizeIncoming(raw) {
  const payload = unwrapPayload(raw);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  if (payload.private) return null;

  const timestamp = normalizeTimestamp(payload.timestamp ?? payload.time);
  const content = sanitizeMessageParts(payload.chatmessage ?? payload.message ?? payload.text ?? "");
  const badges = sanitizeBadgeList(payload.chatbadges ?? payload.badges);
  const roles = detectRoles(payload, badges);
  const event = detectEvent(payload);
  const donation = detectDonation(payload);
  const authorName = toSafeText(payload.chatname || payload.name || payload.username || payload.displayName || "", 80);

  if (!isPresentable({ payload, authorName, content, event, donation })) return null;

  const platformType = toSafeText(payload.type || payload.platform || "unknown", 40).toLowerCase() || "unknown";
  const idSeed = payload.id || payload.mid || payload.userid || `${timestamp}:${authorName || content.text || event?.type || platformType}`;

  return {
    id: toSafeText(String(idSeed), 160) || stableHash(JSON.stringify(payload)),
    timestamp,
    author: {
      name: authorName,
      avatarUrl: validateMediaUrl(payload.chatimg || payload.avatar || payload.profileImage || ""),
      badges,
      roles
    },
    platform: {
      type: platformType,
      label: labelForPlatform(payload.sourceName || payload.type || payload.platform || "Chat"),
      icon: validateMediaUrl(payload.sourceImg || payload.platformIcon || "")
    },
    content,
    kind: classifyKind(payload, roles, event, donation),
    event,
    donation,
    metadata: {
      rawType: toSafeText(payload.type || "", 40),
      private: Boolean(payload.private),
      textOnly: Boolean(payload.textonly),
      contentImage: validateMediaUrl(payload.contentimg || ""),
      color: toSafeText(payload.nameColor || "", 40),
      featured: Boolean(payload.featured || payload.question)
    }
  };
}

export function unwrapPayload(raw) {
  if (raw?.dataReceived?.overlayNinja) return raw.dataReceived.overlayNinja;
  if (raw?.overlayNinja) return raw.overlayNinja;
  return raw;
}

export function summarizePayloadShape(raw) {
  const payload = unwrapPayload(raw);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "non-object payload";
  const keys = Object.keys(payload)
    .filter((key) => /^[a-zA-Z][a-zA-Z0-9_]{0,39}$/.test(key))
    .sort()
    .slice(0, 24);
  return keys.length ? `fields: ${keys.join(", ")}` : "empty object";
}

function classifyKind(payload, roles, event, donation) {
  if (donation) return "donation";
  if (event?.recognized && event.major) return "major-event";
  if (event?.recognized) return "event";
  if (event || payload.event === "system" || payload.type === "system" || payload.admin || payload.bot) return "system";
  if (roles.length > 0) return "privileged";
  return "message";
}

function detectEvent(payload) {
  const explicit = normalizeEventValue(payload.event);
  const explicitSignal = hasExplicitEvent(payload.event);
  const membership = toSafeText(payload.membership || "", 120);
  const includeMembership = explicitSignal || !isRoleOnlyMembership(membership) || !hasRawMessage(payload);
  const context = [explicit, includeMembership ? membership : "", payload.title, payload.subtitle]
    .map((value) => String(value || "").toLowerCase())
    .join(" ");

  for (const definition of EVENT_DEFINITIONS) {
    if (definition.pattern.test(context)) {
      return {
        type: definition.type,
        label: definition.label,
        major: definition.major,
        recognized: true,
        detail: eventDetail(payload)
      };
    }
  }

  if (explicitSignal) {
    const eventMessage = String(payload.chatmessage ?? payload.message ?? payload.text ?? "").toLowerCase();
    for (const definition of EVENT_MESSAGE_DEFINITIONS) {
      if (definition.pattern.test(eventMessage)) {
        return {
          type: definition.type,
          label: definition.label,
          major: definition.major,
          recognized: true,
          detail: eventDetail(payload)
        };
      }
    }
  }

  if (hasExplicitEvent(payload.event)) {
    return {
      type: explicit || "event",
      label: toSafeText(payload.title || payload.subtitle || "Update", 40),
      major: false,
      recognized: false,
      detail: eventDetail(payload)
    };
  }

  return null;
}

function detectDonation(payload) {
  const marker = [payload.hasDonation, payload.donation, payload.amount, payload.currency, payload.title, payload.subtitle]
    .map((value) => String(value || "").toLowerCase())
    .join(" ");
  if (!/\b(donation|donate|tip|superchat|super chat|bits|cheer|gift|paid|stars)\b|\$\s?\d|\d+\s?(usd|eur|gbp|bits|stars)/.test(marker)) return null;

  const amount = toSafeText(payload.hasDonation || payload.amount || payload.donation || "", 80);
  const label = toSafeText(payload.title || payload.subtitle || "", 120);
  if (!amount && !label) return null;
  return {
    amount,
    currency: toSafeText(payload.currency || "", 12),
    label
  };
}

function detectRoles(payload, badges) {
  const roles = new Set();
  const haystack = [
    payload.role,
    payload.roles,
    isRoleOnlyMembership(payload.membership) ? payload.membership : "",
    ...badges.map((badge) => badge.label)
  ].map((value) => String(value || "").toLowerCase()).join(" ");

  if (payload.moderator || /\b(mod|moderator)\b/.test(haystack)) roles.add("moderator");
  if (/\bvip\b/.test(haystack)) roles.add("vip");
  if (/\b(member|membership)\b/.test(haystack)) roles.add("member");
  if (/\b(sub|subscriber|subscription)\b/.test(haystack)) roles.add("subscriber");
  return [...roles];
}

function hasRawMessage(payload) {
  return Boolean(toSafeText(payload.chatmessage ?? payload.message ?? payload.text ?? ""));
}

function isRoleOnlyMembership(value) {
  return /^(member|subscriber|subscription|sub)$/i.test(toSafeText(value, 40));
}

function isPresentable({ payload, authorName, content, event, donation }) {
  const hasMessage = Boolean(content.text || content.safeEmoteNodes.length);
  if (donation) return Boolean(authorName || hasMessage || donation.amount || donation.label);
  if (event?.recognized) {
    return Boolean(authorName || hasMessage || event.detail || payload.hasDonation);
  }
  if (event) return Boolean(hasMessage || event.detail);
  return hasMessage;
}

function eventDetail(payload) {
  return toSafeText(payload.subtitle || payload.membership || payload.title || "", 160);
}

function normalizeEventValue(value) {
  if (typeof value !== "string") return "";
  const normalized = toSafeText(value, 40).toLowerCase();
  return normalized === "false" || normalized === "chat" ? "" : normalized;
}

function hasExplicitEvent(value) {
  if (value === true) return true;
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  return Boolean(normalized && normalized !== "false" && normalized !== "chat");
}

function normalizeTimestamp(value) {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : Date.now();
}

function labelForPlatform(value) {
  const text = toSafeText(value, 40);
  if (!text) return "Chat";
  return text.replace(/\b\w/g, (char) => char.toUpperCase());
}

export function stableHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < String(value).length; index += 1) {
    hash ^= String(value).charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `m${(hash >>> 0).toString(36)}`;
}
