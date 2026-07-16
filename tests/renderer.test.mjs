import test from "node:test";
import assert from "node:assert/strict";
import { punctuationForText } from "../src/message-renderer.js";

test("selects punctuation impacts from message text", () => {
  assert.equal(punctuationForText("That was incredible!"), "!");
  assert.equal(punctuationForText("Is that live?"), "?");
  assert.equal(punctuationForText("Really?!"), "?!");
  assert.equal(punctuationForText("Calm message"), "");
});

test("supports full-width international punctuation", () => {
  assert.equal(punctuationForText("本当ですか？"), "?");
  assert.equal(punctuationForText("すごい！"), "!");
});
