import test from "node:test";
import assert from "node:assert/strict";
import { AlertAudioEngine, clampVolume, createSoundSamples } from "../src/audio-engine.js";
import { parseAlertsConfig } from "../src/config.js";

test("clamps alert durations and volumes", () => {
  const config = parseAlertsConfig({ hash: "#mock=1&position=bottom&side=left&minorDuration=1&standardDuration=99999&majorDuration=9000&volume=4&minorVolume=-1&sound=0&scale=9&reduceMotion=1&server=1" });
  assert.equal(config.position, "bottom");
  assert.equal(config.side, "left");
  assert.equal(config.minorDuration, 3000);
  assert.equal(config.standardDuration, 12000);
  assert.equal(config.volume, .65);
  assert.equal(config.minorVolume, 0);
  assert.equal(config.sound, false);
  assert.equal(config.server, true);
  assert.equal(config.scale, 1.5);
});

test("server transport defaults on, can be disabled, and ignores unsafe non-boolean values", () => {
  assert.equal(parseAlertsConfig({ hash: "#mock=1" }).server, true);
  assert.equal(parseAlertsConfig({ hash: "#mock=1&server=0" }).server, false);
  assert.equal(parseAlertsConfig({ hash: "#mock=1&server=wss://attacker.invalid" }).server, true);
});

test("procedural sounds are finite, bounded, and tiered", () => {
  const minor = createSoundSamples("minor", 8000);
  const major = createSoundSamples("major", 8000);
  assert.ok(major.length > minor.length);
  assert.ok([...major].every((sample) => Number.isFinite(sample) && Math.abs(sample) <= 1));
  assert.equal(clampVolume(5), 1);
  assert.equal(clampVolume(-1), 0);
});

test("sound-disabled engine creates no audio context", () => {
  let created = 0;
  const engine = new AlertAudioEngine({ enabled: false, contextFactory: class { constructor() { created += 1; } } });
  assert.equal(engine.prepare(), "muted");
  assert.equal(engine.play("minor").played, false);
  assert.equal(created, 0);
});

test("audio engine reuses one context and cleans source nodes", async () => {
  const fake = makeFakeContext();
  const engine = new AlertAudioEngine({ enabled: true, contextFactory: class { constructor() { return fake; } } });
  engine.prepare();
  engine.prepare();
  assert.equal(fake.createdContexts, 1);
  assert.equal(engine.play("standard").played, true);
  assert.equal(engine.sources.size, 1);
  fake.lastSource.onended();
  assert.equal(engine.sources.size, 0);
  await engine.destroy();
  assert.equal(fake.closed, true);
});

function makeFakeContext() {
  const context = {
    createdContexts: 1, state: "running", sampleRate: 8000, currentTime: 0, destination: {}, closed: false, lastSource: null,
    createGain: () => ({ gain: automation(), connect() { return this; }, disconnect() {} }),
    createDynamicsCompressor: () => ({ threshold: {}, knee: {}, ratio: {}, attack: {}, release: {}, connect() { return this; } }),
    createBuffer: (_channels, length, rate) => ({ duration: length / rate, copyToChannel() {} }),
    createBufferSource() { const source = { buffer: null, onended: null, connect() { return this; }, disconnect() {}, start() {}, stop() {} }; this.lastSource = source; return source; },
    close: async () => { context.state = "closed"; context.closed = true; }
  };
  return context;
}

function automation() { return { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} }; }
