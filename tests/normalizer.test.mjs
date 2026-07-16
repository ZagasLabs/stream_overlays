import test from "node:test";
import assert from "node:assert/strict";
import { normalizeIncoming, summarizePayloadShape, unwrapPayload } from "../src/message-normalizer.js";

test("unwraps official iframe bridge payload", () => {
  const raw = { dataReceived: { overlayNinja: { chatname: "A", chatmessage: "B" } } };
  assert.equal(unwrapPayload(raw).chatname, "A");
});

test("normalizes a regular message", () => {
  const message = normalizeIncoming({
    id: "m1",
    type: "youtube",
    sourceName: "YouTube",
    chatname: "Viewer",
    chatmessage: "Hello <b>chat</b> 😄",
    chatimg: "https://example.com/avatar.png"
  });

  assert.equal(message.id, "m1");
  assert.equal(message.kind, "message");
  assert.equal(message.author.name, "Viewer");
  assert.equal(message.platform.label, "YouTube");
  assert.equal(message.content.text, "Hello chat 😄");
  assert.equal(message.author.avatarUrl, "https://example.com/avatar.png");
});

test("classifies moderator and subscriber roles without inventing events", () => {
  const moderator = normalizeIncoming({ chatname: "Mod", chatmessage: "Stop", moderator: true });
  const subscriber = normalizeIncoming({ chatname: "Sub", chatmessage: "Renewed", membership: "subscriber" });

  assert.equal(moderator.kind, "privileged");
  assert.deepEqual(moderator.author.roles, ["moderator"]);
  assert.equal(subscriber.kind, "privileged");
  assert.deepEqual(subscriber.author.roles, ["subscriber"]);
  assert.equal(subscriber.event, null);
});

test("classifies an explicit subscription event", () => {
  const subscription = normalizeIncoming({
    chatname: "Sub",
    chatmessage: "Renewed for 12 months",
    membership: "subscriber",
    event: "subscription"
  });

  assert.equal(subscription.kind, "event");
  assert.equal(subscription.event.type, "subscription");
});

test("infers a boolean event from its message without scanning normal chat", () => {
  const follow = normalizeIncoming({ event: true, chatname: "NewViewer", chatmessage: "followed the channel" });
  const ordinary = normalizeIncoming({ chatname: "Viewer", chatmessage: "I followed that tutorial" });

  assert.equal(follow.kind, "event");
  assert.equal(follow.event.type, "follow");
  assert.equal(ordinary.kind, "message");
  assert.equal(ordinary.event, null);
});

test("does not infer reactions from ordinary words in boolean event payloads", () => {
  const message = normalizeIncoming({
    event: true,
    chatname: "JokeBot",
    chatmessage: "I cannot fit in like this bundle. It keeps getting tighter.",
    type: "twitch"
  });

  assert.equal(message.kind, "system");
  assert.equal(message.event.recognized, false);
});

test("classifies donation and raid major event", () => {
  const donation = normalizeIncoming({ chatname: "Donor", chatmessage: "Take this", hasDonation: "$5.00" });
  const raid = normalizeIncoming({ chatname: "Raider", chatmessage: "42 viewers", event: "raid" });

  assert.equal(donation.kind, "donation");
  assert.equal(donation.donation.amount, "$5.00");
  assert.equal(raid.kind, "major-event");
  assert.equal(raid.event.type, "raid");
});

test("unsafe html degrades safely", () => {
  const message = normalizeIncoming({ chatname: "<img onerror=x>", chatmessage: '<img src="javascript:bad" onerror="x">Hi' });
  assert.equal(message.author.name, "");
  assert.equal(message.content.text, "Hi");
  assert.equal(message.content.safeEmoteNodes.length, 0);
});

test("drops empty bridge and named empty payloads", () => {
  assert.equal(normalizeIncoming({ event: true, type: "event" }), null);
  assert.equal(normalizeIncoming({ chatname: "Lucy", chatimg: "https://example.com/lucy.png", type: "youtube" }), null);
});

test("drops private messages", () => {
  assert.equal(normalizeIncoming({ private: true, chatname: "DirectUser", chatmessage: "private text" }), null);
});

test("unknown events with content degrade to system messages", () => {
  const message = normalizeIncoming({ event: "custom-control", chatmessage: "Stream state changed", type: "system" });

  assert.equal(message.kind, "system");
  assert.equal(message.author.name, "");
  assert.equal(message.content.text, "Stream state changed");
});

test("debug summary exposes field names but not values", () => {
  const summary = summarizePayloadShape({ chatname: "Private Name", event: true, secretToken: "do-not-show" });

  assert.match(summary, /chatname/);
  assert.match(summary, /secretToken/);
  assert.doesNotMatch(summary, /Private Name|do-not-show/);
});
