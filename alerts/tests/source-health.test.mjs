import test from "node:test";
import assert from "node:assert/strict";
import { TwitchFollowHealth } from "../src/source-health.js";

function analysis(event, payload = {}, alert = null) {
  return { platform: "twitch", event, payload: { type: "twitch", event, ...payload }, alert };
}

test("distinguishes a Helix follower baseline from EventSub confirmation", () => {
  const health = new TwitchFollowHealth();
  const baseline = health.observe(analysis("follower_update", { meta: 41 }), 1_000);
  const named = health.observe(analysis("new_follower", { chatname: "Viewer" }, { type: "follow" }), 2_000);
  const correlated = health.observe(analysis("follower_update", { meta: 42 }), 2_100);

  assert.equal(baseline.state, "count-baseline");
  assert.match(baseline.message, /not EventSub/);
  assert.equal(named.state, "eventsub-confirmed");
  assert.equal(correlated.state, "eventsub-correlated");
});

test("reports a count increase when the named follow payload is missing", () => {
  const health = new TwitchFollowHealth();
  health.observe(analysis("follower_update", { meta: { total: 70 } }), 1_000);
  const result = health.observe(analysis("follower_update", { meta: { total: 72 } }), 20_000);

  assert.equal(result.state, "count-only-increase");
  assert.match(result.message, /count \+2/);
  assert.match(result.message, /did not deliver/);
});

test("ignores other platforms and resets stored correlation state", () => {
  const health = new TwitchFollowHealth();
  assert.equal(health.observe({ platform: "kick", event: "new_follower", alert: { type: "follow" } }, 1_000), null);
  health.observe(analysis("new_follower", {}, { type: "follow" }), 2_000);
  health.observe(analysis("follower_update", { meta: 10 }), 2_100);
  health.reset();
  assert.equal(health.observe(analysis("follower_update", { meta: 11 }), 2_200).state, "count-baseline");
});
