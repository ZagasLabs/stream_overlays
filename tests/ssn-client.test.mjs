import test from "node:test";
import assert from "node:assert/strict";
import { extractBridgePayload } from "../src/ssn-client.js";

test("accepts official overlayNinja bridge envelopes", () => {
  const nested = { dataReceived: { overlayNinja: { chatname: "A", chatmessage: "Hello" } } };
  const direct = { overlayNinja: { chatname: "B", chatmessage: "Hi" } };

  assert.equal(extractBridgePayload(nested).chatname, "A");
  assert.equal(extractBridgePayload(direct).chatname, "B");
});

test("rejects generic VDO.Ninja content traffic", () => {
  assert.equal(extractBridgePayload({ content: { event: true } }), null);
  assert.equal(extractBridgePayload({ action: "joined" }), null);
});
