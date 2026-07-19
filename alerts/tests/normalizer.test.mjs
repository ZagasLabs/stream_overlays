import test from "node:test";
import assert from "node:assert/strict";
import { alertDuration, analyzeAlertPayload, chooseTier, normalizeAlert } from "../src/normalizer.js";

const config = { minorPriority: 10, standardPriority: 20, majorPriority: 30, minorDuration: 5000, standardDuration: 7000, majorDuration: 11000 };

test("normalizes canonical platform events", () => {
  assert.equal(normalizeAlert({ id: "f", type: "twitch", event: "new_follower", chatname: "A" }, config).type, "follow");
  assert.equal(normalizeAlert({ id: "s", type: "kick", event: "new_subscriber", chatname: "B" }, config).type, "subscription");
  assert.equal(normalizeAlert({ id: "m", type: "youtube", event: "sponsorship", chatname: "C" }, config).type, "membership");
  assert.equal(normalizeAlert({ id: "r", type: "twitch", event: "resub", chatname: "D" }, config).type, "resubscription");
});

test("classifies paid events by platform without inventing unsupported events", () => {
  const bits = normalizeAlert({ type: "twitch", event: "cheer", chatname: "Bits", hasDonation: "500 bits", meta: { bits: 500 } }, config);
  const superchat = normalizeAlert({ type: "youtube", event: "donation", chatname: "YT", hasDonation: "$5" }, config);
  const kick = normalizeAlert({ type: "kick", event: "donation", chatname: "K", hasDonation: "$10" }, config);
  assert.equal(bits.type, "bits");
  assert.equal(bits.count, 500);
  assert.equal(superchat.type, "superchat");
  assert.equal(kick.type, "donation");
  assert.equal(normalizeAlert({ type: "streamplace", event: "new_follower", chatname: "Mock" }, config), null);
  assert.equal(normalizeAlert({ type: "twitch", event: "made_up", chatname: "X", chatmessage: "hello" }, config), null);
});

test("uses stable native IDs and safe bounded fields", () => {
  const alert = normalizeAlert({ id: "native-7", type: "twitch", event: "raid", chatname: "<b>Raid</b>", chatimg: "javascript:bad", chatmessage: "<script>x</script>Hello", meta: { viewers: 42 } }, config);
  assert.equal(alert.id, "native-7");
  assert.equal(alert.user, "Raid");
  assert.equal(alert.avatar, "");
  assert.equal(alert.message, "Hello");
  assert.equal(alert.count, 42);
  assert.equal(alert.tier, "major");
});

test("selects tier, priority, and duration", () => {
  assert.equal(chooseTier("follow"), "minor");
  assert.equal(chooseTier("gift", { count: 2 }), "standard");
  assert.equal(chooseTier("gift", { count: 10 }), "major");
  assert.equal(chooseTier("donation", { numericAmount: 50 }), "major");
  assert.equal(chooseTier("superchat", { numericAmount: 100, currency: "MXN" }), "standard");
  const alert = normalizeAlert({ type: "twitch", event: "raid", chatname: "R" }, config);
  assert.equal(alert.priority, 30);
  assert.equal(alertDuration(alert, config), 11000);
});

test("accepts current official aliases and API Sandbox eventType fields", () => {
  assert.equal(normalizeAlert({ type: "twitch", eventType: "channel_followed", chatname: "A" }, config).type, "follow");
  assert.equal(normalizeAlert({ type: "twitch", event: "gifted", chatname: "B" }, config).type, "gift");
  assert.equal(normalizeAlert({ type: "twitch", event: "subscriber", chatname: "C" }, config).type, "subscription");
  assert.equal(normalizeAlert({ type: "streamlabs", event: "sponsor", chatname: "D" }, config).type, "subscription");
  assert.equal(normalizeAlert({ type: "twitch", event: "host", chatname: "E", meta: { viewers: 20 } }, config).type, "raid");
  assert.equal(normalizeAlert({ type: "youtube", event: "thankyou", hasDonation: "$5", chatname: "F" }, config).type, "superchat");
  assert.equal(normalizeAlert({ type: "kick", meta: { eventType: "channel.followed" }, chatname: "G" }, config).type, "follow");
  assert.equal(normalizeAlert({ platform: "twitch", type: "channel.raid", chatname: "H", meta: { viewers: 12 } }, config).type, "raid");
});

test("derives an event only from safe documented signals", () => {
  assert.equal(normalizeAlert({ type: "youtube", membership: "MEMBERSHIP", chatname: "A", chatmessage: "" }, config).type, "membership");
  assert.equal(normalizeAlert({ type: "youtube", membership: "MEMBERSHIP", chatname: "A", chatmessage: "normal member chat" }, config), null);
  assert.equal(normalizeAlert({ type: "kick", event: true, chatname: "B", chatmessage: "B followed" }, config).type, "follow");
});

test("explains SSN's randomized generic test-message donation branches", () => {
  const gold = normalizeAlert({ type: "youtube", chatname: "Bob", hasDonation: "2500 gold" }, config);
  const hearts = normalizeAlert({ type: "youtubeshorts", chatname: "Lucy", hasDonation: "3 hearts", chatmessage: "" }, config);
  assert.equal(gold.type, "donation");
  assert.equal(gold.tier, "major");
  assert.equal(hearts.type, "donation");
  assert.equal(hearts.platform, "youtubeshorts");
  assert.equal(hearts.amount, "3 hearts");
});

test("returns deterministic debug classification and rejection reasons", () => {
  const chat = analyzeAlertPayload({ type: "twitch", chatname: "A", chatmessage: "hello" }, config);
  const count = analyzeAlertPayload({ type: "twitch", event: "viewer_update", meta: 42 }, config);
  const unknown = analyzeAlertPayload({ type: "kick", event: "made_up", chatname: "B" }, config);
  assert.deepEqual([chat.kind, chat.reason], ["chat", "regular-chat"]);
  assert.deepEqual([count.kind, count.reason], ["ignored", "count-or-status-event"]);
  assert.deepEqual([unknown.kind, unknown.reason], ["ignored", "unknown-event:made_up"]);
});

test("unwraps endpoint content commands and bounded batches", () => {
  const wrapped = {
    action: "content",
    value: JSON.stringify({ type: "twitch", eventType: "new_follower", chatname: "Endpoint" })
  };
  assert.equal(normalizeAlert(wrapped, config).type, "follow");
  assert.equal(normalizeAlert({ messages: [{ type: "kick", event: "new_subscriber", chatname: "Batch" }] }, config).type, "subscription");
});
