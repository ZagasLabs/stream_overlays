# Unified Alerts

A static, sequential multi-platform alert overlay powered by Social Stream Ninja. Production classification follows SSN's canonical event reference. Unknown events are ignored with a debug-only reason; Streamplace mock events are clearly marked and never generated from production payloads.

## Local use

Run `npm run mock:alerts` and open `http://127.0.0.1:8765/alerts/#mock=1&debug=1`. The panel provides individual fixtures, burst/priority and duplicate tests, mute, live master volume, and an explicit audio enable/test action. Alt+1 through Alt+9 trigger the first nine fixtures.

## Live transport and endpoint tests

Normal SSN platform traffic uses the hidden VDO.Ninja P2P bridge. Every Browser Source publishes with a generated unique ID, so several sources can coexist in the same SSN room. Labels are SSN routing addresses: Chat and WordleStream use `dock`, while this app uses the official `alerts` target. Arbitrary per-app labels do not receive general traffic.

To also receive events sent through `io.socialstream.ninja` endpoints or raw channel 4, add `server=1`:

```sh
npm run url:alerts -- --session SESSION_ID --server 1 --debug 1 --sound 0
npm run url:alerts -- --session SESSION_ID --production --server 1 --debug 1 --sound 0
```

The server address is fixed in source to SSN's official WebSocket service; fragment values cannot select another host. The client subscribes with inbound channel 4, reconnects with bounded backoff, understands `content` action envelopes and official payload batches, and relies on the alert queue to suppress duplicates seen over both transports.

In the official SSN API Sandbox, choose channel **4** and set **Event Type** to a documented value such as `new_follower`. The sandbox uses `eventType`; the overlay accepts it alongside canonical `event` and documented metadata aliases. `sendChat` is an outgoing chat command and does not create an alert.

With `debug=1`, the diagnostic log records every trusted raw P2P/server envelope before classification, followed by `EVENT`, `CHAT`, or `IGNORED` and the rejection reason. **LOCAL · render follow** verifies only this app's renderer and queue, making it easy to distinguish a visual bug from missing upstream traffic. The log keeps at most 60 entries, uses text-only rendering, stores nothing, and redacts session, room, API ID, password, secret, key, and token fields. Remove `debug=1` after validation; the panel does not exist in normal production operation.

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
