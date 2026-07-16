import test from "node:test";
import assert from "node:assert/strict";
import { parseConfig } from "../src/config.js";
import { buildOverlayUrl } from "../src/url-utils.js";

test("parses production fragment config", () => {
  const config = parseConfig({
    hash: "#session=abc_123&side=left&max=8&duration=22000&eventDuration=30000&accent=%23ff003c&scale=1.2&debug=1&reduceMotion=1&showAvatar=0",
    mediaReduceMotion: false
  });

  assert.equal(config.session, "abc_123");
  assert.equal(config.side, "left");
  assert.equal(config.max, 8);
  assert.equal(config.duration, 22000);
  assert.equal(config.eventDuration, 30000);
  assert.equal(config.accent, "#ff003c");
  assert.equal(config.scale, 1.2);
  assert.equal(config.debug, true);
  assert.equal(config.reduceMotion, true);
  assert.equal(config.showAvatar, false);
  assert.equal(config.valid, true);
});

test("invalid values fall back or clamp safely", () => {
  const config = parseConfig({
    hash: "#session=<script>&side=middle&max=999&duration=1&eventDuration=999999&accent=javascript:bad&scale=10&debug=yes&mock=0",
    mediaReduceMotion: true
  });

  assert.equal(config.session, "");
  assert.equal(config.side, "right");
  assert.equal(config.max, 10);
  assert.equal(config.duration, 5000);
  assert.equal(config.eventDuration, 90000);
  assert.equal(config.accent, "#ffffff");
  assert.equal(config.scale, 1.35);
  assert.equal(config.debug, false);
  assert.equal(config.reduceMotion, true);
  assert.equal(config.valid, false);
});

test("query fallback works only when explicitly allowed", () => {
  assert.equal(parseConfig({ search: "?session=abc", allowQueryFallback: false }).valid, false);
  assert.equal(parseConfig({ search: "?session=abc", allowQueryFallback: true }).valid, true);
});

test("url generator encodes session and fragment params", () => {
  const url = buildOverlayUrl({
    base: "http://127.0.0.1:8765/",
    session: "abc_123",
    params: { side: "right", accent: "#fff", max: 6 }
  });

  assert.equal(url, "http://127.0.0.1:8765/#session=abc_123&side=right&accent=%23fff&max=6");
});

test("production url requires https", () => {
  assert.throws(() => buildOverlayUrl({ base: "http://example.test/", session: "abc", production: true }), /https/);
});
