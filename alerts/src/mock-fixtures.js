export const ALERT_FIXTURES = Object.freeze([
  fixture("Twitch follow", { id: "tw-follow", type: "twitch", event: "new_follower", chatname: "PixelPilot" }),
  fixture("Kick follow", { id: "kick-follow", type: "kick", event: "new_follower", chatname: "KickStarter" }),
  fixture("YouTube membership", { id: "yt-member", type: "youtube", event: "sponsorship", membership: "new_member", chatname: "Luna Studio", chatmessage: "Joined the signal crew" }),
  fixture("Twitch subscription", { id: "tw-sub", type: "twitch", event: "new_subscriber", chatname: "NightCircuit" }),
  fixture("Resubscription", { id: "tw-resub", type: "twitch", event: "resub", chatname: "TapeDeck", subtitle: "13 months", chatmessage: "Still here!" }),
  fixture("Gift bundle", { id: "kick-gift", type: "kick", event: "subscription_gift", chatname: "GoodVibes", meta: { totalGifted: 10 }, chatmessage: "Gifted 10 subscriptions" }),
  fixture("Raid", { id: "tw-raid", type: "twitch", event: "raid", chatname: "RaidLeader", meta: { viewers: 148 }, chatmessage: "Arrived with the whole crew" }),
  fixture("Donation", { id: "tip", type: "kofi", event: "donation", chatname: "Anonymous", hasDonation: "$25.00", currency: "USD", donoValue: 25, chatmessage: "For the next adventure!" }),
  fixture("Bits", { id: "bits", type: "twitch", event: "cheer", chatname: "BitRunner", hasDonation: "500 bits", donoValue: 500, meta: { bits: 500 } }),
  fixture("Super Chat", { id: "superchat", type: "youtube", event: "donation", chatname: "Sol y Mar", hasDonation: "MX$100.00", currency: "MXN", donoValue: 100, chatmessage: "Saludos desde México ✨" }),
  fixture("Missing avatar", { id: "no-avatar", type: "twitch", event: "new_follower", chatname: "NoAvatarNeeded" }),
  fixture("Long content", { id: "long", type: "youtube", event: "sponsorship", chatname: "A_very_long_channel_name_that_needs_a_clean_ellipsis_without_breaking_the_alert", chatmessage: "This is a deliberately long friendly message with Unicode ✨🎙️ and enough words to verify that the panel stays compact instead of taking over the entire gameplay scene." })
]);

export const STREAMPLACE_MOCK_ALERT = Object.freeze({
  id: "streamplace-mock", timestamp: 1, platform: "streamplace", type: "generic-event", priority: 100, tier: "minor",
  user: "Streamplace Viewer", avatar: "", amount: "", currency: "", count: null,
  message: "MOCK ONLY · production event support is currently unknown", metadata: { sourceEvent: "mock-only", platformLabel: "Streamplace" }
});

function fixture(name, payload) { return Object.freeze({ fixtureName: name, payload: Object.freeze(payload) }); }
