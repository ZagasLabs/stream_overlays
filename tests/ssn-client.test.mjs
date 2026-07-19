import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { SocialStreamClient, buildBridgeUrl, decodeSocketFrame, extractBridgePayload, extractBridgePayloads, flattenPayloads, payloadFingerprint } from "../src/ssn-client.js";

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

test("builds a targeted alerts bridge with a unique publisher instead of the literal false ID", () => {
  const url = new URL(buildBridgeUrl("NON_SECRET_TEST", { label: "Alerts !!" }));
  assert.equal(url.searchParams.get("push"), "");
  assert.equal(url.searchParams.get("label"), "alerts");
  assert.equal(url.searchParams.get("view"), "NON_SECRET_TEST");
  assert.equal(url.searchParams.get("room"), "NON_SECRET_TEST");
  assert.equal(url.searchParams.has("novideo"), true);
  assert.equal(url.searchParams.has("noaudio"), true);
});

test("uses the official dock label for general chat and game traffic", () => {
  const url = new URL(buildBridgeUrl("NON_SECRET_TEST"));
  assert.equal(url.searchParams.get("label"), "dock");
  assert.equal(new SocialStreamClient({ session: "NON_SECRET_TEST" }).label, "dock");
  assert.equal(new SocialStreamClient({ session: "NON_SECRET_TEST" }).server, true);
  assert.equal(new SocialStreamClient({ session: "NON_SECRET_TEST", label: " !!! " }).label, "dock");
});

test("deduplicates the same payload arriving over P2P and channel 4", () => {
  const client = new SocialStreamClient({ session: "NON_SECRET_TEST", debug: true });
  const payload = { id: "message-1", type: "twitch", chatname: "Viewer", chatmessage: "Hello" };
  const received = [];
  const diagnostics = [];
  client.addEventListener("payload", (event) => received.push(event.detail));
  client.addEventListener("diagnostic", (event) => diagnostics.push(event.detail));

  assert.equal(client.emitPayload("p2p", payload), true);
  assert.equal(client.emitPayload("server", { ...payload }), false);
  assert.equal(received.length, 1);
  assert.equal(diagnostics[0].reason, "cross-transport-duplicate");
  assert.equal(payloadFingerprint({ b: 2, a: 1 }), payloadFingerprint({ a: 1, b: 2 }));
});

test("entrypoints retain SSN's routed dock and alerts labels", async () => {
  const [chat, wordle, alerts] = await Promise.all([
    readFile(new URL("../src/app.js", import.meta.url), "utf8"),
    readFile(new URL("../wordlestream/src/app.js", import.meta.url), "utf8"),
    readFile(new URL("../alerts/src/app.js", import.meta.url), "utf8")
  ]);
  assert.match(chat, /label:\s*"dock"/);
  assert.match(wordle, /label:\s*"dock"/);
  assert.match(alerts, /label:\s*"alerts"/);
});

test("flattens official batches, wrappers, and content endpoint envelopes", () => {
  const follow = { type: "twitch", eventType: "new_follower", chatname: "A" };
  const gift = { type: "youtube", event: "giftpurchase", chatname: "B" };
  const endpoint = JSON.stringify({ action: "content", value: JSON.stringify(follow) });
  assert.deepEqual(decodeSocketFrame(endpoint).payloads, [follow]);
  assert.deepEqual(flattenPayloads({ messages: [{ sendData: { overlayNinja: follow } }, { content: gift }] }), [follow, gift]);
  assert.deepEqual(extractBridgePayloads({ dataReceived: { overlayNinja: [follow, gift] } }), [follow, gift]);
  assert.equal(decodeSocketFrame("not json").reason, "invalid-json");
});

test("server transport joins channel 4 and forwards decoded payloads", () => {
  const originalWindow = globalThis.window;
  globalThis.window = { setTimeout, clearTimeout, removeEventListener() {} };
  const socket = new FakeSocket();
  const client = new SocialStreamClient({
    session: "NON_SECRET_TEST",
    server: true,
    webSocketFactory: () => socket
  });
  const received = [];
  client.addEventListener("payload", (event) => received.push(event.detail));
  client.running = true;
  client.startSocket();
  socket.onopen();
  assert.deepEqual(JSON.parse(socket.sent[0]), { join: "NON_SECRET_TEST", out: 3, in: 4 });
  socket.onmessage({ data: JSON.stringify({ action: "content", value: JSON.stringify({ type: "kick", eventType: "new_follower" }) }) });
  assert.equal(received[0].transport, "server");
  assert.equal(received[0].payload.eventType, "new_follower");
  client.stop();
  globalThis.window = originalWindow;
});

class FakeSocket {
  constructor() { this.sent = []; }
  send(value) { this.sent.push(value); }
  close() {}
}
