const DEFAULT_CORRELATION_WINDOW = 15_000;

export class TwitchFollowHealth {
  constructor({ correlationWindow = DEFAULT_CORRELATION_WINDOW } = {}) {
    this.correlationWindow = Math.max(1_000, Math.min(60_000, Number(correlationWindow) || DEFAULT_CORRELATION_WINDOW));
    this.reset();
  }

  reset() {
    this.lastFollowerTotal = null;
    this.lastNamedFollowAt = 0;
  }

  observe(analysis, now = Date.now()) {
    if (!analysis || analysis.platform !== "twitch") return null;

    if (analysis.alert?.type === "follow" || ["new_follower", "follow"].includes(analysis.event)) {
      this.lastNamedFollowAt = safeNow(now);
      return {
        state: "eventsub-confirmed",
        message: "Twitch follow path: named new_follower received; EventSub is reaching this overlay."
      };
    }

    if (analysis.event !== "follower_update") return null;
    const total = followerTotal(analysis.payload);
    if (total === null) {
      return {
        state: "invalid-count",
        message: "Twitch follow path: follower_update arrived without a usable total."
      };
    }

    if (this.lastFollowerTotal === null) {
      this.lastFollowerTotal = total;
      return {
        state: "count-baseline",
        message: `Twitch follow path: count baseline ${total}; this proves Helix polling, not EventSub.`
      };
    }

    const previous = this.lastFollowerTotal;
    const delta = total - previous;
    this.lastFollowerTotal = total;
    if (delta === 0) return null;

    if (delta < 0) {
      return {
        state: "count-decrease",
        message: `Twitch follow path: count ${previous} → ${total}; no follow alert is expected for an unfollow.`
      };
    }

    const timestamp = safeNow(now);
    const correlated = this.lastNamedFollowAt > 0 && timestamp - this.lastNamedFollowAt <= this.correlationWindow;
    return {
      state: correlated ? "eventsub-correlated" : "count-only-increase",
      message: correlated
        ? `Twitch follow path: named EventSub follow correlated with count ${previous} → ${total}.`
        : `Twitch follow path: count +${delta} (${previous} → ${total}) without new_follower; Twitch registered a change but SSN did not deliver the named EventSub event.`
    };
  }
}

function followerTotal(payload) {
  if (!payload || typeof payload !== "object") return null;
  const meta = payload.meta;
  const candidates = [
    typeof meta === "number" || typeof meta === "string" ? meta : null,
    meta && typeof meta === "object" ? meta.total : null,
    payload.total,
    payload.count
  ];
  for (const value of candidates) {
    if (value === null || value === undefined || value === "") continue;
    const number = Number(value);
    if (Number.isFinite(number) && number >= 0) return Math.min(1_000_000_000, Math.round(number));
  }
  return null;
}

function safeNow(value) {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && timestamp >= 0 ? timestamp : Date.now();
}
