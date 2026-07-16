import test from "node:test";
import assert from "node:assert/strict";
import {
  chooseEvictionIndex,
  selectLayoutVariant,
  shouldCleanupOffscreen
} from "../src/layout-manager.js";

test("scroll cleanup always starts with the oldest message", () => {
  const messages = [
    { id: "event", kind: "donation" },
    { id: "normal-a", kind: "message" },
    { id: "normal-b", kind: "privileged" }
  ];

  assert.equal(chooseEvictionIndex(messages), 0);
});

test("evicts first item when all messages are important", () => {
  assert.equal(chooseEvictionIndex([{ kind: "donation" }, { kind: "major-event" }]), 0);
});

test("layout selection is deterministic", () => {
  const message = { id: "abc123", kind: "message" };
  assert.deepEqual(selectLayoutVariant(message, 2), selectLayoutVariant(message, 2));
});

test("event messages use event variants", () => {
  const variant = selectLayoutVariant({ id: "raid-1", kind: "major-event" }, 0);
  assert.match(variant.name, /^event-/);
});

test("only cleans normal-buffer items after they leave the viewport", () => {
  assert.equal(shouldCleanupOffscreen({ bottom: 99, viewportTop: 100, expired: true, itemCount: 5, max: 6 }), true);
  assert.equal(shouldCleanupOffscreen({ bottom: 140, viewportTop: 100, expired: true, itemCount: 5, max: 6 }), false);
  assert.equal(shouldCleanupOffscreen({ bottom: 99, viewportTop: 100, expired: false, itemCount: 7, max: 6 }), true);
});

test("hard buffer keeps the DOM bounded even if geometry is unusual", () => {
  assert.equal(shouldCleanupOffscreen({ bottom: 300, viewportTop: 100, itemCount: 11, max: 6 }), true);
  assert.equal(shouldCleanupOffscreen({ bottom: 300, viewportTop: 100, itemCount: 10, max: 6 }), false);
});
