import test from "node:test";
import assert from "node:assert/strict";
import { AlertAudioEngine } from "../src/audio-engine.js";
import { isSafeCustomSoundPath, parseSoundManifest, soundManifestEntries } from "../src/sound-manifest.js";

test("accepts only fixed local custom sound paths and known mappings", () => {
  const manifest = parseSoundManifest({
    version: 1,
    tiers: { minor: "custom/minor.ogg", major: null },
    events: { raid: "custom/events/raid.wav" }
  });
  assert.deepEqual(soundManifestEntries(manifest), [
    { kind: "tier", key: "minor", path: "custom/minor.ogg" },
    { kind: "event", key: "raid", path: "custom/events/raid.wav" }
  ]);
  assert.equal(isSafeCustomSoundPath("custom/soft-alert.ogg"), true);
  assert.equal(isSafeCustomSoundPath("https://example.test/alert.ogg"), false);
  assert.equal(isSafeCustomSoundPath("custom/../secret.wav"), false);
  assert.throws(() => parseSoundManifest({ version: 1, tiers: { loud: "custom/loud.wav" } }));
  assert.throws(() => parseSoundManifest({ version: 2, tiers: {} }));
});

test("event sounds override tier sounds after one-time decoding", async () => {
  const fake = makeFakeContext();
  const manifestUrl = "https://overlay.test/alerts/assets/sounds/manifest.json";
  const requests = [];
  const fetchImpl = async (url) => {
    requests.push(String(url));
    if (String(url) === manifestUrl) return response({ json: { version: 1, tiers: { minor: "custom/minor.ogg" }, events: { follow: "custom/follow.wav" } } });
    if (String(url).endsWith("follow.wav")) return response({ bytes: Uint8Array.of(7).buffer });
    return response({ bytes: Uint8Array.of(3).buffer });
  };
  const engine = new AlertAudioEngine({
    contextFactory: class { constructor() { return fake; } }, fetchImpl, soundManifestUrl: manifestUrl
  });
  engine.prepare();
  await engine.whenReady();
  assert.equal(engine.packStatus, "custom decoded");

  const eventResult = engine.play("minor", "follow");
  assert.equal(eventResult.custom, true);
  assert.equal(fake.lastSource.buffer.marker, 7);
  fake.lastSource.onended();

  engine.play("minor", "subscription");
  assert.equal(fake.lastSource.buffer.marker, 3);
  assert.equal(requests.filter((url) => url === manifestUrl).length, 1);
  fake.lastSource.onended();
  await engine.destroy();
});

function response({ json, bytes } = {}) {
  return {
    ok: true,
    headers: { get: () => String(bytes?.byteLength || 0) },
    json: async () => json,
    arrayBuffer: async () => bytes
  };
}

function makeFakeContext() {
  const context = {
    state: "running", sampleRate: 8000, currentTime: 0, destination: {}, lastSource: null,
    createGain: () => ({ gain: automation(), connect() { return this; }, disconnect() {} }),
    createDynamicsCompressor: () => ({ threshold: {}, knee: {}, ratio: {}, attack: {}, release: {}, connect() { return this; } }),
    createBuffer: (_channels, length, rate) => ({ duration: length / rate, copyToChannel() {} }),
    decodeAudioData: async (bytes) => ({ duration: .5, marker: new Uint8Array(bytes)[0] }),
    createBufferSource() { const source = { buffer: null, onended: null, connect() { return this; }, disconnect() {}, start() {}, stop() {} }; this.lastSource = source; return source; },
    close: async () => { context.state = "closed"; }
  };
  return context;
}

function automation() { return { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} }; }
