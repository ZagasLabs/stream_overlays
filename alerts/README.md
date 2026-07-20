# Unified Alerts

A static, sequential multi-platform alert overlay powered by Social Stream Ninja. Production classification follows SSN's canonical event reference. Unknown events are ignored with a debug-only reason; Streamplace mock events are clearly marked and never generated from production payloads.

## Local use

Run `npm run mock:alerts` and open `http://127.0.0.1:8765/alerts/#mock=1&debug=1`. The panel provides individual fixtures, burst/priority and duplicate tests, mute, live master volume, and an explicit audio enable/test action. Alt+1 through Alt+9 trigger the first nine fixtures.

## Live transport and endpoint tests

Normal SSN platform traffic uses hidden, view-only VDO.Ninja P2P bridges. Labels are SSN routing addresses: Chat and WordleStream use `dock`; Alerts listens to `alerts`, the compatible `dock` event path, and the `meta` path used for metadata-only events such as Hype Train, then suppresses duplicates. Arbitrary per-app labels do not receive general traffic.

The channel-4 receiver is also enabled by default because SSN's **Send chat messages to API server** switch moves general traffic away from P2P. No extra production parameter is needed:

```sh
npm run url:alerts -- --session SESSION_ID --debug 1 --sound 0
npm run url:alerts -- --session SESSION_ID --production --debug 1 --sound 0
```

The server address is fixed in source to SSN's official WebSocket service; fragment values cannot select another host. The client subscribes with inbound channel 4, reconnects with bounded backoff, understands `content` action envelopes and official payload batches, and suppresses duplicates seen over both transports. `server=0` explicitly disables this fallback for P2P-only troubleshooting.

The official SSN Multi-Alert panel broadcasts its follow, sub, donation, bits, and raid test fixtures externally. Its **Hype** button currently previews only SSN's embedded iframe because the upstream external fixture builder has no Hype case. Test Hype externally with SSN's separate **Fake Hype Train** metadata button or the API Sandbox's Hype Train preset on channel **4**. The Sandbox's main connection defaults to channel 1 because that direction sends commands to the extension; this is expected. The form uses `eventType` for ordinary custom events and the Hype preset uses canonical `event` plus `meta`. `sendChat` is an outgoing chat command and does not create an alert.

With `debug=1`, the diagnostic log records every trusted raw P2P/server envelope before classification, followed by `EVENT`, `CHAT`, or `IGNORED` and the rejection reason. **LOCAL · render follow/Bits/Hype Train** verifies only this app's renderer and queue, making it easy to distinguish a visual bug from missing upstream traffic. A transported Hype event should show `P2P:META · RAW` or `SERVER · RAW`; the log then shows `EVENT · twitch/hype_train → hype-train/major · accepted`. The Twitch follow status distinguishes a count-only `follower_update` (Helix polling) from a named `new_follower` (EventSub). A count increase without a preceding named payload proves that Twitch recorded a change but SSN did not deliver the EventSub follow. The log keeps at most 60 entries, uses text-only rendering, stores nothing, and redacts session, room, API ID, password, secret, key, and token fields. Remove `debug=1` after validation.

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
    "raid": "custom/raid.wav",
    "hype-train": "custom/hype-train.ogg"
  }
}
```

Only relative paths beginning with `custom/` are accepted. Files are limited to WAV/OGG, 4 MiB and 20 decoded seconds. They are loaded once, decoded before the SSN connection starts, and never selected through URL fragments. Run `npm run preflight` after changing the manifest, record each asset's origin and license in `docs/licenses.md`, then use **Enable / test audio** in mock mode.

Platform color identifies the source: Twitch is purple, Kick green, YouTube red, and Streamplace soft pink. `#F20D69` is the common red-pink accent. Minor, standard, and major alerts progressively increase in size, shadow, motion, value emphasis, and brief glitch pulses. Reduced-motion mode removes entrance impacts, staggered content, and glitches.

See `docs/obs-alerts.md` and `docs/alerts-capability-matrix.md` for routing and platform support.
