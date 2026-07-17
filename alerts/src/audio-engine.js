import { MAX_CUSTOM_SOUND_BYTES, parseSoundManifest, soundManifestEntries } from "./sound-manifest.js";

const DEFAULT_MANIFEST_URL = typeof window === "object" ? new URL("../assets/sounds/manifest.json", import.meta.url).href : "";

export function clampVolume(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : fallback;
}

export function createSoundSamples(tier, sampleRate = 48_000) {
  const duration = { minor: .24, standard: .5, major: .85 }[tier] || .18;
  const samples = new Float32Array(Math.floor(sampleRate * duration));
  const notes = { minor: [660, 880], standard: [440, 554, 659], major: [220, 440, 660, 880] }[tier] || [220];
  for (let index = 0; index < samples.length; index += 1) {
    const time = index / sampleRate;
    const attack = Math.min(1, time / .012);
    const release = Math.min(1, (duration - time) / .12);
    const envelope = Math.max(0, attack * release);
    let value = 0;
    notes.forEach((frequency, noteIndex) => {
      const start = noteIndex * duration / (notes.length + 1);
      const noteEnvelope = time >= start ? Math.exp(-(time - start) * (tier === "major" ? 4.2 : 7)) : 0;
      value += Math.sin(2 * Math.PI * frequency * time) * noteEnvelope / notes.length;
    });
    samples[index] = Math.tanh(value * 1.3) * envelope * .62;
  }
  return samples;
}

export class AlertAudioEngine {
  constructor({ enabled = true, volume = .24, minorVolume = .42, standardVolume = .62, majorVolume = .8, contextFactory, fetchImpl, soundManifestUrl } = {}) {
    this.enabled = enabled;
    this.masterVolume = clampVolume(volume, .24);
    this.tierVolume = { minor: clampVolume(minorVolume, .42), standard: clampVolume(standardVolume, .62), major: clampVolume(majorVolume, .8) };
    this.contextFactory = contextFactory;
    this.fetchImpl = fetchImpl || globalThis.fetch?.bind(globalThis);
    this.soundManifestUrl = soundManifestUrl === undefined ? DEFAULT_MANIFEST_URL : soundManifestUrl;
    this.context = null;
    this.master = null;
    this.buffers = new Map();
    this.customBuffers = new Map();
    this.customUrls = new Map();
    this.sources = new Set();
    this.fallbackUrls = new Map();
    this.loading = null;
    this.status = enabled ? "idle" : "muted";
    this.packStatus = "procedural";
  }

  prepare() {
    if (!this.enabled) return this.status = "muted";
    if (!this.loading && this.soundManifestUrl && this.fetchImpl) this.loading = this.loadCustomSounds();
    if (this.context) return this.status;
    const Context = this.contextFactory || globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Context) { this.status = "fallback"; return this.status; }
    try {
      this.context = new Context();
      this.master = this.context.createGain();
      const compressor = this.context.createDynamicsCompressor();
      compressor.threshold.value = -12;
      compressor.knee.value = 8;
      compressor.ratio.value = 8;
      compressor.attack.value = .003;
      compressor.release.value = .18;
      this.master.gain.value = this.masterVolume;
      this.master.connect(compressor).connect(this.context.destination);
      for (const tier of ["minor", "standard", "major"]) {
        const samples = createSoundSamples(tier, this.context.sampleRate);
        const buffer = this.context.createBuffer(1, samples.length, this.context.sampleRate);
        buffer.copyToChannel(samples, 0);
        this.buffers.set(tier, buffer);
      }
      this.status = this.context.state === "running" ? "ready" : "suspended";
    } catch { this.status = "fallback"; }
    return this.status;
  }

  async whenReady() {
    this.prepare();
    await this.loading?.catch(() => {});
    return this.status;
  }

  async enable() {
    this.enabled = true;
    this.prepare();
    await this.whenReady();
    if (this.context?.state === "suspended") {
      try { await this.context.resume(); } catch { /* Debug status reports the block. */ }
    }
    this.status = this.context?.state === "running" ? "ready" : this.context ? "suspended" : "fallback";
    return this.status;
  }

  play(tier = "minor", eventType = "") {
    if (!this.enabled || this.masterVolume === 0 || this.tierVolume[tier] === 0) return { played: false, reason: "muted" };
    this.prepare();
    if (!this.context || !this.master || this.context.state !== "running") return this.playFallback(tier, eventType);
    const buffer = this.customBuffers.get(`event:${eventType}`) || this.customBuffers.get(`tier:${tier}`) || this.buffers.get(tier);
    if (!buffer) return { played: false, reason: "missing-buffer" };
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    const now = this.context.currentTime;
    const duration = buffer.duration;
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0001, this.tierVolume[tier]), now + .012);
    gain.gain.setValueAtTime(Math.max(.0001, this.tierVolume[tier]), now + Math.max(.02, duration - .09));
    gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    source.buffer = buffer;
    source.connect(gain).connect(this.master);
    source.onended = () => { source.disconnect(); gain.disconnect(); this.sources.delete(source); };
    this.sources.add(source);
    source.start(now);
    return { played: true, custom: this.customBuffers.has(`event:${eventType}`) || this.customBuffers.has(`tier:${tier}`) };
  }

  setMasterVolume(value) {
    this.masterVolume = clampVolume(value, this.masterVolume);
    if (this.master && this.context) this.master.gain.setTargetAtTime(this.masterVolume, this.context.currentTime, .02);
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    if (!this.enabled) {
      this.stopAll();
      this.status = "muted";
    } else {
      this.status = this.context?.state === "running" ? "ready" : this.context ? "suspended" : "idle";
    }
  }

  stopAll() {
    for (const source of [...this.sources]) { try { source.stop(); } catch { /* already stopped */ } }
    this.sources.clear();
  }

  playFallback(tier, eventType = "") {
    if (typeof Audio !== "function" || typeof URL?.createObjectURL !== "function") return { played: false, reason: this.status };
    try {
      const customUrl = this.customUrls.get(`event:${eventType}`) || this.customUrls.get(`tier:${tier}`);
      if (!customUrl && !this.fallbackUrls.has(tier)) this.fallbackUrls.set(tier, URL.createObjectURL(samplesToWavBlob(createSoundSamples(tier))));
      const audio = new Audio(customUrl || this.fallbackUrls.get(tier));
      audio.volume = clampVolume(this.masterVolume * this.tierVolume[tier]);
      audio.addEventListener("ended", () => { audio.src = ""; }, { once: true });
      const promise = audio.play();
      promise?.catch(() => {});
      return { played: true, fallback: true, custom: Boolean(customUrl) };
    } catch { return { played: false, reason: "fallback-failed" }; }
  }

  async destroy() {
    this.stopAll();
    for (const url of this.fallbackUrls.values()) URL.revokeObjectURL(url);
    this.fallbackUrls.clear();
    if (this.context && this.context.state !== "closed") await this.context.close().catch(() => {});
    this.context = null;
    this.master = null;
    this.buffers.clear();
    this.customBuffers.clear();
    this.customUrls.clear();
  }

  async loadCustomSounds() {
    try {
      const response = await this.fetchImpl(this.soundManifestUrl, { cache: "no-store", credentials: "same-origin" });
      if (!response?.ok) return;
      const manifest = parseSoundManifest(await response.json());
      const base = new URL("./", this.soundManifestUrl);
      const jobs = soundManifestEntries(manifest).map(async ({ kind, key, path }) => {
        const url = new URL(path, base);
        if (url.origin !== base.origin || !url.href.startsWith(base.href)) return;
        const mapKey = `${kind}:${key}`;
        this.customUrls.set(mapKey, url.href);
        if (!this.context?.decodeAudioData) return;
        try {
          const soundResponse = await this.fetchImpl(url.href, { cache: "no-store", credentials: "same-origin" });
          const declaredSize = Number(soundResponse?.headers?.get?.("content-length") || 0);
          if (!soundResponse?.ok || declaredSize > MAX_CUSTOM_SOUND_BYTES) return this.customUrls.delete(mapKey);
          const bytes = await soundResponse.arrayBuffer();
          if (bytes.byteLength > MAX_CUSTOM_SOUND_BYTES) return this.customUrls.delete(mapKey);
          const buffer = await this.context.decodeAudioData(bytes.slice(0));
          if (buffer?.duration > 0 && buffer.duration <= 20) this.customBuffers.set(mapKey, buffer);
          else this.customUrls.delete(mapKey);
        } catch { this.customUrls.delete(mapKey); }
      });
      await Promise.all(jobs);
      if (this.customUrls.size) this.packStatus = this.customBuffers.size ? "custom decoded" : "custom fallback";
    } catch { this.packStatus = "procedural"; }
  }
}

function samplesToWavBlob(samples, sampleRate = 48_000) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  writeText(view, 0, "RIFF"); view.setUint32(4, 36 + samples.length * 2, true); writeText(view, 8, "WAVEfmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); writeText(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((sample, index) => view.setInt16(44 + index * 2, Math.round(Math.max(-1, Math.min(1, sample)) * 32767), true));
  return new Blob([buffer], { type: "audio/wav" });
}

function writeText(view, offset, text) { [...text].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0))); }
