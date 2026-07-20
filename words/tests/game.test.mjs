import test from "node:test";
import assert from "node:assert/strict";
import { CooperativeWordGame, normalizeWord, parseChatCommand, scoreGuess } from "../src/game.js";

const words = ["crane", "slate", "allee", "apple", "civic", "juego", "noche", "sueño"];
const makeGame = (options = {}) => new CooperativeWordGame({ answers: ["apple"], accepted: words, answer: "apple", wordLength: 5, maxAttempts: 6, userCooldown: 1000, globalCooldown: 100, ...options });

test("parses the primary command and compatible aliases, and safely normalizes language", () => {
  const commands = ["!words", "!w", "!word"];
  assert.deepEqual(parseChatCommand("!words CRANE", commands), { command: "!words", argument: "CRANE" });
  assert.deepEqual(parseChatCommand("!w CRANE", commands), { command: "!w", argument: "CRANE" });
  assert.deepEqual(parseChatCommand("!word CRANE", commands), { command: "!word", argument: "CRANE" });
  assert.equal(parseChatCommand("CRANE", ["!w"]), null);
  assert.equal(normalizeWord(" SUEÑO ", "fold"), "sueño");
  assert.equal(normalizeWord("rápido", "fold"), "rapido");
  assert.equal(normalizeWord("<b>bad</b>"), "");
});

test("scores repeated letters using remaining answer counts", () => {
  assert.deepEqual(scoreGuess("allee", "apple"), ["correct", "present", "absent", "absent", "correct"]);
  assert.deepEqual(scoreGuess("civic", "apple"), ["absent", "absent", "absent", "absent", "absent"]);
});

test("valid queue is FIFO and rejects invalid, duplicate, cooldown, and queued-user guesses", () => {
  const game = makeGame();
  assert.equal(game.submit({ guess: "zzzzz", identity: "twitch:a" }, 0).reason, "dictionary");
  assert.equal(game.submit({ guess: "crane", identity: "twitch:a" }, 0).accepted, true);
  assert.equal(game.submit({ guess: "slate", identity: "twitch:a" }, 10).reason, "queued");
  assert.equal(game.submit({ guess: "crane", identity: "kick:b" }, 10).reason, "duplicate");
  assert.equal(game.submit({ guess: "slate", identity: "kick:b" }, 10).accepted, true);
  assert.equal(game.processNext(0).word, "crane");
  assert.equal(game.processNext(50), null);
  assert.equal(game.processNext(101).word, "slate");
  assert.equal(game.submit({ guess: "civic", identity: "twitch:a" }, 500).reason, "user-cooldown");
});

test("tracks victory and six-attempt loss", () => {
  const win = makeGame();
  win.submit({ guess: "apple", identity: "twitch:w" }, 0);
  win.processNext(0);
  assert.equal(win.status, "won");

  const loss = makeGame({ accepted: ["crane", "slate", "allee", "civic", "juego", "noche", "apple"] });
  ["crane", "slate", "allee", "civic", "juego", "noche"].forEach((guess, index) => {
    const now = index * 101;
    loss.submit({ guess, identity: `youtube:${index}` }, now);
    loss.processNext(now);
  });
  assert.equal(loss.status, "lost");
});

test("admin controls recover paused and completed rounds", () => {
  const game = makeGame({ answers: ["apple", "crane"], random: () => 0 });
  game.submit({ guess: "slate", identity: "twitch:a" }, 0);
  game.processNext(0);

  assert.equal(game.control("pause"), true);
  assert.equal(game.status, "paused");
  assert.equal(game.control("resume"), true);
  assert.equal(game.status, "active");

  assert.equal(game.control("reset"), true);
  assert.equal(game.answer, "apple");
  assert.equal(game.attempts.length, 0);

  game.submit({ guess: "apple", identity: "twitch:w" }, 2_000);
  game.processNext(2_000);
  assert.equal(game.status, "won");
  assert.equal(game.control("new"), true);
  assert.equal(game.status, "active");
  assert.equal(game.answer, "crane");
  assert.equal(game.attempts.length, 0);
});

test("queue is bounded and identities remain platform-separated", () => {
  const game = makeGame({ maxQueue: 1 });
  assert.equal(game.submit({ guess: "crane", identity: "twitch:same" }, 0).accepted, true);
  assert.equal(game.submit({ guess: "slate", identity: "youtube:same" }, 0).reason, "queue-full");
  game.processNext(0);
  assert.equal(game.submit({ guess: "slate", identity: "youtube:same" }, 1).accepted, true);
});

test("serialization restores only safe compatible state", () => {
  const game = makeGame();
  game.submit({ guess: "crane", identity: "twitch:a", displayName: "A", platform: "twitch" }, 1000);
  game.processNext(1000);
  const saved = game.serialize(1000);
  const restored = makeGame();
  assert.equal(restored.restore(saved, 1000), true);
  assert.equal(restored.attempts[0].word, "crane");
  assert.equal(restored.restore({ ...saved, answer: "<script>" }, 1000), false);
});
