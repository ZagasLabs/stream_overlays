import test from "node:test";
import assert from "node:assert/strict";
import { clearGame, loadGame, saveGame, storageKey } from "../src/persistence.js";

test("persists non-secret game state under a session-independent key", () => {
  const values = new Map();
  const storage = { setItem: (key, value) => values.set(key, value), getItem: (key) => values.get(key), removeItem: (key) => values.delete(key) };
  const key = storageKey("en", 5);
  assert.equal(key.includes("session"), false);
  assert.equal(saveGame(storage, key, { version: 1, answer: "crane" }), true);
  assert.deepEqual(loadGame(storage, key), { version: 1, answer: "crane" });
  assert.equal(clearGame(storage, key), true);
  assert.equal(loadGame(storage, key), null);
});
