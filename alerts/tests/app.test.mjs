import test from "node:test";
import assert from "node:assert/strict";

test("sound=0 starts the overlay without initializing audio", async (t) => {
  const window = new EventTarget();
  window.location = { hash: "#sound=0", search: "", hostname: "localhost" };
  const elements = new Map(["#stage", "#debug-panel", "#diagnostic"].map((id) => [id, {}]));
  const document = {
    documentElement: { dataset: {}, style: { setProperty() {} } },
    querySelector: (selector) => elements.get(selector) || null
  };
  let contextsCreated = 0;
  let requests = 0;
  const replacements = {
    window,
    document,
    AudioContext: class {
      constructor() {
        contextsCreated += 1;
        throw new Error("Audio unavailable in this test environment");
      }
    },
    fetch: async () => {
      requests += 1;
      return { ok: true, json: async () => ({ version: 1, tiers: {}, events: {} }) };
    }
  };
  for (const [key, value] of Object.entries(replacements)) {
    const original = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    t.after(() => {
      if (original) Object.defineProperty(globalThis, key, original);
      else delete globalThis[key];
    });
  }
  t.after(() => window.dispatchEvent(new Event("pagehide")));

  await import("../src/app.js");

  assert.match(elements.get("#diagnostic").textContent, /Missing #session/);
  assert.equal(contextsCreated, 0, "sound=0 must not create an AudioContext");
  assert.equal(requests, 0, "sound=0 must not load the sound pack");
});
