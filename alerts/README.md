# Unified Alerts

A static, sequential multi-platform alert overlay powered by Social Stream Ninja. Production classification follows SSN's canonical event reference. Unknown events are ignored with a debug-only field-shape diagnostic; Streamplace mock events are clearly marked and never generated from production payloads.

## Local use

Run `npm run mock:alerts` and open `http://127.0.0.1:8765/alerts/#mock=1&debug=1`. The panel provides individual fixtures, burst/priority and duplicate tests, mute, live master volume, and an explicit audio enable/test action. Alt+1 through Alt+9 trigger the first nine fixtures.

## Audio

Minor, standard, and major sounds default to original procedural waveforms generated locally at runtime. They use no samples, platform sounds, game sounds, remote assets, or third-party code. A single Web Audio context owns pre-generated buffers, master gain and compressor; per-tier gains use short envelopes and sources are disconnected on completion. A generated local WAV/HTMLAudio path is used only when Web Audio is unavailable. Audio defaults to a conservative master level and can be disabled with `sound=0`.

### Custom sound pack

Put properly licensed `.ogg` or `.wav` files below `alerts/assets/sounds/custom/` and edit `alerts/assets/sounds/manifest.json`. A tier mapping provides the default for `minor`, `standard`, or `major`; an event mapping overrides its tier. Empty or missing mappings use the procedural fallback.

```json
{
  "version": 1,
  "tiers": {
    "minor": "custom/minor.ogg",
    "standard": "custom/standard.ogg",
    "major": "custom/major.wav"
  },
  "events": {
    "follow": "custom/follow.ogg",
    "raid": "custom/raid.wav"
  }
}
```

Only relative paths beginning with `custom/` are accepted. Files are limited to WAV/OGG, 4 MiB and 20 decoded seconds. They are loaded once, decoded before the SSN connection starts, and never selected through URL fragments. Run `npm run preflight` after changing the manifest, record each asset's origin and license in `docs/licenses.md`, then use **Enable / test audio** in mock mode.

Platform color identifies the source: Twitch is purple, Kick green, YouTube red, and Streamplace soft pink. `#F20D69` is the common red-pink accent. Minor, standard, and major alerts progressively increase in size, shadow, motion, value emphasis, and brief glitch pulses. Reduced-motion mode removes entrance impacts, staggered content, and glitches.

See `docs/obs-alerts.md` and `docs/alerts-capability-matrix.md` for routing and platform support.
