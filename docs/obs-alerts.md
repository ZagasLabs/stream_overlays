# Alerts OBS and Audio Setup

1. Generate the private URL with `npm run url:alerts -- --session SESSION_ID --production`.
2. Add a Browser Source using `https://zagaslabs.github.io/stream_overlays/alerts/#session=SESSION_ID`.
3. Use the full canvas: **2560×1440** or **1920×1080**. Position with `position=top|center|bottom` and `side=left|center|right`; avoid cropping the source.
4. Enable **Control audio via OBS** for this Browser Source.
5. Leave **Shutdown source when not visible** and **Refresh browser when scene becomes active** disabled so queued alerts and the audio context survive scene changes.

The generated URL needs only `session`. P2P and SSN channel 4 are both enabled by default, so it continues working whether **Send chat messages to API server** is on or off. `server=0` exists only for deliberate P2P-only troubleshooting.

```sh
npm run url:alerts -- --session SESSION_ID --production
```

For a temporary diagnostic source, add `--debug 1 --sound 0`. The panel distinguishes P2P from server payloads and reports `EVENT`, `CHAT`, or `IGNORED` with the exact reason. Remove those temporary options after testing.

## Mixer and tracks

In Advanced Audio Properties, route the Alerts Browser Source to the main stream track. To keep alerts out of the Twitch VOD, deselect the VOD track for Alerts while leaving the live stream track selected. Choose **Monitor Off** for stream-only playback, **Monitor Only** for local checking without output, or **Monitor and Output** when you need both—verify routing carefully.

Do not capture the same alert through Desktop Audio and Browser Source audio at once; that causes doubled or echoed sound. Adjust normal live volume from the OBS mixer. Fragment `volume` is the engine ceiling and per-tier volumes provide relative balance.

Before going live, open mock mode, click **Enable / test audio**, inject minor/standard/major fixtures, watch the OBS mixer meter, and verify the intended stream/VOD tracks in a short local recording:

```text
http://127.0.0.1:8765/alerts/#mock=1&debug=1
```

Custom WAV/OGG files live in `alerts/assets/sounds/custom/` and are assigned in `alerts/assets/sounds/manifest.json`. Event assignments override tier assignments. Run `npm run preflight` and `npm run build:pages` after adding them, then reload the Browser Source and test all three tiers. Keep custom files short and conservatively normalized; the engine still applies its master gain, tier gain, envelopes, and compressor.

If sound is silent, confirm `sound` is not `0`, Control audio via OBS is enabled, the source is not muted, the correct tracks are selected, and OBS has allowed the Browser Source to initialize audio. The debug panel reports `ready`, `suspended`, `fallback`, or `muted`. If styling/audio remains stale after deployment, clear OBS Browser cache, restart OBS, reload the source, then test before streaming.

If alerts are silent visually, first use `debug=1`. Click **LOCAL · render follow**: if it appears, the renderer and queue are working, but this local fixture does not test SSN. `P2P · RAW` proves the bridge delivered data, `SERVER · RAW` proves channel 4 delivered data, and the following classification line explains any filter. Prefer SSN's built-in alert tests. For a direct endpoint test, select channel 4 in the Sandbox's Advanced Message Generator and provide a documented `eventType`; its separate main connection showing channel 1 is expected because channel 1 sends commands to the extension. Do not use `sendChat` as an incoming-alert test.

SSN's generic **Test Message** is randomized. Its `2500 gold` and YouTube Shorts `3 hearts` variants carry `hasDonation`, so they appear as alerts; they are not follow tests. For live platform alerts, enable that platform's WebSocket/EventSub/bridge mode inside SSN. A Twitch follow requires an active `channel.follow` EventSub subscription and the `moderator:read:followers` OAuth scope; re-authorize the Twitch WebSocket source if necessary and test with a fresh account. A YouTube follow test is unsuitable for immediate validation: Standard/DOM mode cannot emit it, the Data API source must be authenticated as the channel owner, the follower's subscriptions must be public, polling runs every five minutes, and YouTube may delay visibility by up to four hours.

Never expose a complete production URL containing the Session ID.
