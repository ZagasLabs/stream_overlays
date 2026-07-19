# Social Stream Ninja Integration

Inspection date: **2026-07-19**. Official upstream revision inspected: [`27eafa34a884d1dc5b5ab4048a1ef092c38d0b40`](https://github.com/steveseguin/social_stream/tree/27eafa34a884d1dc5b5ab4048a1ef092c38d0b40), committed 2026-07-07.

## Official references inspected

- [Live Event Reference](https://socialstream.ninja/docs/event-reference.html), the canonical platform/event reference.
- [Official Multi-Stream Alert Box](https://github.com/steveseguin/social_stream/blob/27eafa34a884d1dc5b5ab4048a1ef092c38d0b40/multi-alerts.js), including its P2P bridge, channel-4 socket, payload flattening, aliases, and classifier.
- [Background relay routing](https://github.com/steveseguin/social_stream/blob/27eafa34a884d1dc5b5ab4048a1ef092c38d0b40/background.js), specifically `sendDataP2P`, `sendTargetP2P`, alert targeting, and the randomized Test Message payloads.
- [Official overlay-builder rules](https://github.com/steveseguin/social_stream/blob/27eafa34a884d1dc5b5ab4048a1ef092c38d0b40/aiprompt.html), which state that general chat/alert/game overlays use `dock` unless a dedicated target is intentionally required.
- [Official sample overlay](https://github.com/steveseguin/social_stream/blob/27eafa34a884d1dc5b5ab4048a1ef092c38d0b40/sampleoverlay.html) and [API Sandbox](https://socialstream.ninja/sampleapi.html).
- [SSN server API documentation](https://github.com/steveseguin/social_stream/blob/27eafa34a884d1dc5b5ab4048a1ef092c38d0b40/README.md#server-api-support).
- [VDO.Ninja `push` documentation](https://docs.vdo.ninja/advanced-settings/setup-parameters/push).

## Transport

All overlays use the official hidden VDO.Ninja iframe bridge. `shared/ssn/client.js` joins the fragment Session ID as `room` and `view` and uses an empty `push` flag so VDO.Ninja generates a unique publisher ID. This avoids the collision caused by using the literal publisher ID `false` in several simultaneous Browser Sources.

Labels are routing addresses, not harmless application names. Chat and WordleStream use the official `dock` label because SSN's general `sendDataP2P` path forwards chat traffic only to known overlay labels such as `dock`; custom labels receive only explicitly targeted payloads. Alerts uses the official dedicated `alerts` label because the current background relay additionally sends every payload carrying `event` or a donation field to that target. Do not replace these with invented labels such as `chat` or `wordle`: doing so disconnects those apps from the general stream.

Trusted iframe messages must match both `https://vdo.socialstream.ninja` and the bridge iframe's `contentWindow`. The client accepts `dataReceived.overlayNinja`, `overlayNinja`, and `sendData.overlayNinja`; generic VDO control traffic is rejected.

All three overlays keep P2P active and also connect to the official server relay by default. The fixed endpoint is `wss://io.socialstream.ninja/extension`, joined as `{ "out": 3, "in": 4 }`. This is required because SSN's **Send chat messages to API server** switch deliberately diverts general Dock traffic away from P2P and onto channel 4. The dual receiver therefore works with that switch either on or off. `server=0` is an explicit P2P-only escape hatch; it is not recommended for normal operation.

The server path supports raw channel-4 objects, JSON frames, arrays, `messages`, `message`, `content`, bridge envelopes, and HTTP `action: "content"` frames whose `value` contains JSON. It reconnects with exponential delay capped at 30 seconds and closes on page unload. A bounded cross-transport fingerprint cache suppresses the same payload when targeted P2P and channel 4 both deliver it; Alerts also retains its longer event-ID replay protection.

The Session ID comes only from `new URLSearchParams(window.location.hash.slice(1))` through the shared fragment parser. It is not logged or stored. `server` is boolean; no fragment value can become a WebSocket host. SSE is not used.

## Confirmed common fields

Official or adapter-confirmed fields used by the overlays are `id`, `timestamp`, `chatname`, `chatmessage`, `chatimg`, `chatbadges`, `type`, `platform`, `sourceName`, `sourceImg`, `event`, `eventType`, `alertType`, `membership`, `subtitle`, `title`, `hasDonation`, `donoValue`, `currency`, `contentimg`, `userid`, `moderator`, `private`, and `meta`.

`meta` is platform-specific. Confirmed examples include YouTube `channelId`, Twitch `bits`, gift totals and raid viewers, Kick `amount`/`currency`/`supporter`, native `messageId`, and reply metadata. Alert event aliases may also appear under `meta.event`, `meta.eventType`, `meta.originalEventType`, `meta.rawType`, `meta.alertType`, or `meta.eventName`.

Display names are fallback identities only; WordleStream prefers `userid`, YouTube `meta.channelId`, or Streamplace identity metadata when present. Broadcaster/owner/moderator roles are trusted only when delivered as booleans by an adapter. Badge labels and free text never grant admin rights.

## Event handling and diagnostics

- Alerts classify canonical fields plus the documented legacy aliases used by SSN's current alert box.
- Donation fields can create an alert even when `event` is absent. A membership field without an event is accepted only when the payload has no normal chat message, avoiding an alert for every member chat line.
- Periodic counters and status updates do not become cards. Unknown values and Streamplace production alert claims fail closed.
- `debug=1` adds a bounded, text-only log. Every trusted raw envelope is shown before extraction, then each payload is marked `EVENT`, `CHAT`, or `IGNORED` with source, event, target type/tier, and reason. Sensitive keys and private URL parameters are redacted; nothing is persisted or written to console.
- Full Twitch, Kick, and YouTube event coverage requires the corresponding SSN platform WebSocket/EventSub/bridge mode. That source-capture setting is different from the overlay's automatic channel-4 receiver.
- Twitch follows specifically require EventSub `channel.follow` v2, an OAuth token containing `moderator:read:followers`, and an authenticated broadcaster or moderator. SSN's Twitch WebSocket page logs either `Successfully subscribed to channel.follow` or the subscription failure. Twitch does not document repeated follow/unfollow as a supported test mechanism; use a fresh account after confirming the EventSub subscription.
- YouTube DOM/Standard capture does not emit new-subscriber follows. `new_follower` comes only from the authenticated YouTube Data API/WebSocket source, only when monitoring the authenticated owner's own channel. SSN polls `myRecentSubscribers` every five minutes; YouTube exposes only public subscriptions and documents a possible delay of up to four hours.
- SSN's generic **Test Message** is randomized chat test data, not a deterministic alert test. Two branches literally produce `hasDonation: "2500 gold"` and a YouTube Shorts `hasDonation: "3 hearts"`; Alerts must accept those because `hasDonation` is an official alert signal, but seeing them does not prove that a real follow source is configured.

## Endpoint verification

Channels are directional. Channel 1 is the API Sandbox's expected default for commands going **to the SSN extension**. Channel 4 carries captured chat/events **from the extension to listeners**. The overlay listens on channel 4; this does not mean the Sandbox's main connection must default to 4.

The Sandbox custom-message form emits `eventType`, not necessarily `event`. Leaving its message-channel selector at Default sends `extContent` to the extension on channel 1, after which SSN forwards it normally. Selecting channel 4 sends that fixture directly to Dock/event listeners. `sendChat` sends outgoing chat to platforms and is not an alert fixture.

For a direct endpoint test:

1. Generate Alerts with `--debug 1 --sound 0`; channel 4 is already enabled.
2. Prefer SSN's built-in Multi-Stream Alert Box tests. They use the official payload shape and targeted `alerts` route.
3. For a Sandbox test, use the same private session, choose channel 4 in the **Advanced Message Generator** selector, set platform `twitch`, and set Event Type `new_follower`. The separate top-level connection still showing channel 1 is normal.
4. Expect one `SERVER · RAW` entry followed by `EVENT · twitch/new_follower → follow/minor · accepted`.
5. A second copy arriving over P2P is suppressed by the shared cross-transport deduplicator and alert replay cache.

The current SSN built-in Bits test emits `event: "cheer"`; the selected preview platform may still be TikTok, Kick, or YouTube, so the overlay accepts this explicit test signal while real Twitch Bits also work from `hasDonation` without an event. SSN's current Hype Train button only feeds its embedded preview because `buildTestAlertPayload()` has no `hype` branch. That button cannot reach an external overlay. Real `event: "hype_train"` payloads and this project's local Hype Train fixture are supported as major alerts.

With `debug=1`, **LOCAL · render follow** injects a memory-only fixture directly into the renderer. If that card appears but no `P2P · RAW` or `SERVER · RAW` entry appears for a real test, rendering/classification works and the fault is upstream capture or transport. The local button is deliberately labeled so it cannot be mistaken for production evidence.

Never publish or screenshot either full private URL. The exact platform matrix and limitations are in `docs/alerts-capability-matrix.md`.
