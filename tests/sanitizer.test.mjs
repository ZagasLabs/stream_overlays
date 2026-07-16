import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeBadgeList, sanitizeMessageParts, toSafeText, validateMediaUrl } from "../src/sanitizer.js";

test("plain text strips unsafe markup and preserves emoji", () => {
  assert.equal(toSafeText("<script>alert(1)</script>Hello 😄 <b>world</b>"), "Hello 😄 world");
});

test("sanitizes emote img with narrow allowlist", () => {
  const result = sanitizeMessageParts('Hi <img src="https://cdn.example/emote.png" onerror="bad()" style="x" alt="Kappa" class="emote unknown"> there <iframe></iframe>');

  assert.equal(result.text, "Hi there");
  assert.equal(result.safeEmoteNodes.length, 1);
  assert.equal(result.parts[1].src, "https://cdn.example/emote.png");
  assert.equal(result.parts[1].alt, "Kappa");
  assert.equal(result.parts[1].className, "emote");
});

test("rejects unsafe media urls", () => {
  assert.equal(validateMediaUrl("javascript:alert(1)"), "");
  assert.equal(validateMediaUrl("/relative/avatar.png"), "");
  assert.equal(validateMediaUrl("http://example.com/avatar.png"), "");
  assert.equal(validateMediaUrl("https://example.com/avatar.png"), "https://example.com/avatar.png");
});

test("badge list rejects unsafe image urls but keeps labels", () => {
  const badges = sanitizeBadgeList([{ src: "javascript:bad", label: "mod" }, "https://example.com/vip.png"]);
  assert.deepEqual(badges, [
    { label: "mod" },
    { src: "https://example.com/vip.png", label: "badge" }
  ]);
});

test("drops technical badge placeholders without a safe image", () => {
  const badges = sanitizeBadgeList([
    { type: "svg", html: "<svg onload=alert(1)></svg>" },
    { type: "img", src: "data:image/png;base64,unsafe" },
    { label: "subscriber" }
  ]);

  assert.deepEqual(badges, [{ label: "subscriber" }]);
});
