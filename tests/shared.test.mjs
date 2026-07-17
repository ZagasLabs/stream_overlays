import test from "node:test";
import assert from "node:assert/strict";
import { cleanSession, fragmentParams, parseColor } from "../shared/config.js";
import { platformIdentity } from "../shared/platform.js";
import { scanSecrets } from "../shared/security/secret-scan.js";
import { buildOverlayUrl } from "../shared/url-utils.js";

test("shared fragment parsing keeps production configuration in the fragment", () => {
  const params = fragmentParams({ hash: "#session=abc&mock=0", search: "?session=query", hostname: "example.com" });
  assert.equal(params.get("session"), "abc");
  assert.equal(cleanSession("bad/value"), "");
  assert.equal(parseColor("url(javascript:bad)"), "#ffffff");
});

test("shared URL generation supports app subpaths", () => {
  assert.equal(buildOverlayUrl({ base: "https://owner.github.io/repo/", path: "alerts/", session: "abc", production: true }), "https://owner.github.io/repo/alerts/#session=abc");
  assert.equal(buildOverlayUrl({ base: "https://owner.github.io/repo/", path: "chat/", session: "abc", production: true }), "https://owner.github.io/repo/chat/#session=abc");
});

test("platform identity prefers stable IDs and separates platforms", () => {
  const twitch = platformIdentity({ type: "twitch", chatname: "Same", userid: "42" });
  const youtube = platformIdentity({ type: "youtube", chatname: "Same", meta: { channelId: "42" } });
  assert.equal(twitch.id, "twitch:42");
  assert.equal(youtube.id, "youtube:42");
  assert.notEqual(twitch.id, youtube.id);
});

test("secret scanning rejects credentials and allows documented placeholders", () => {
  assert.deepEqual(scanSecrets("README.md", "https://site/#session=SESSION_ID"), []);
  const privateValue = ["realPrivate", "Session987654321"].join("");
  const tokenValue = ["abcdefghijk", "lmnopqrstu"].join("");
  assert.ok(scanSecrets("bad.txt", `https://site/#session=${privateValue}`).length > 0);
  assert.ok(scanSecrets("fixtures/user.json", JSON.stringify({ token: tokenValue })).length > 0);
});
