import test from "node:test";
import assert from "node:assert/strict";
import { parseAdmins, parseWordleConfig } from "../src/config.js";
import { isAdmin, normalizeSubmission } from "../src/input.js";

test("validates and clamps Wordle fragment settings", () => {
  const config = parseWordleConfig({ hash: "#session=abc_123&lang=es&command=!g,!palabra&maxAttempts=99&wordLength=5&userCooldown=0&globalCooldown=99&admins=twitch:Owner,bad:value&sound=1&volume=9&scale=.2&reduceMotion=1" });
  assert.equal(config.session, "abc_123");
  assert.deepEqual(config.commands, ["!g", "!palabra"]);
  assert.equal(config.maxAttempts, 10);
  assert.equal(config.userCooldown, 1000);
  assert.equal(config.globalCooldown, 30000);
  assert.deepEqual(config.admins, ["twitch:owner"]);
  assert.equal(config.volume, .5);
  assert.equal(config.scale, .7);
  assert.equal(config.server, true);
});

test("Wordle channel 4 fallback can be disabled explicitly", () => {
  assert.equal(parseWordleConfig({ hash: "#mock=1&server=0" }).server, false);
});

test("admin list rejects malformed entries", () => {
  assert.deepEqual(parseAdmins("twitch:Name,kick:other,evil:<script>,youtube:"), ["twitch:name", "kick:other"]);
});

test("authorization requires verified role metadata or configured exact identity", () => {
  assert.equal(isAdmin({ moderator: true }, "twitch:mod", []), true);
  assert.equal(isAdmin({ mod: true }, "twitch:broadcaster", []), true);
  assert.equal(isAdmin({ isBroadcaster: true }, "twitch:broadcaster", []), true);
  assert.equal(isAdmin({ mod: "true" }, "twitch:pretend", []), false);
  assert.equal(isAdmin({ role: "moderator" }, "twitch:pretend", []), false);
  assert.equal(isAdmin({}, "kick:owner", ["kick:owner"]), true);
});

test("normalizes guesses and admin commands with strong platform identity", () => {
  const config = parseWordleConfig({ hash: "#mock=1&admins=youtube:channel-7" });
  const guess = normalizeSubmission({ type: "youtube", chatname: "Viewer", userid: "channel-7", chatmessage: "!w CRANE" }, config);
  assert.equal(guess.identity, "youtube:channel-7");
  assert.equal(guess.guess, "crane");
  const admin = normalizeSubmission({ type: "youtube", chatname: "Viewer", userid: "channel-7", chatmessage: "!word pause" }, config);
  assert.equal(admin.authorized, true);

  const twitchBroadcaster = normalizeSubmission({ type: "twitch", chatname: "Owner", mod: true, chatmessage: "!word new" }, config);
  assert.deepEqual({ kind: twitchBroadcaster.kind, action: twitchBroadcaster.action, authorized: twitchBroadcaster.authorized }, { kind: "admin", action: "new", authorized: true });
});
