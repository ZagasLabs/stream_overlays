# Social Stream Ninja Integration

Inspection date: **2026-07-17**. Official upstream revision inspected: [`27eafa34a884d1dc5b5ab4048a1ef092c38d0b40`](https://github.com/steveseguin/social_stream/tree/27eafa34a884d1dc5b5ab4048a1ef092c38d0b40), committed 2026-07-07.

## Official references inspected

- [Live Event Reference](https://socialstream.ninja/docs/event-reference.html), the canonical platform/event reference.
- [Official Multi-Stream Alert Box](https://github.com/steveseguin/social_stream/blob/27eafa34a884d1dc5b5ab4048a1ef092c38d0b40/multi-alerts.js), including its P2P bridge, channel-4 socket, payload flattening, aliases, and classifier.
- [Official sample overlay](https://github.com/steveseguin/social_stream/blob/27eafa34a884d1dc5b5ab4048a1ef092c38d0b40/sampleoverlay.html) and [API Sandbox](https://socialstream.ninja/sampleapi.html).
- [SSN server API documentation](https://github.com/steveseguin/social_stream/blob/27eafa34a884d1dc5b5ab4048a1ef092c38d0b40/README.md#server-api-support).
- [VDO.Ninja `push` documentation](https://docs.vdo.ninja/advanced-settings/setup-parameters/push).

## Transport

All overlays use the official hidden VDO.Ninja iframe bridge. `shared/ssn/client.js` joins the fragment Session ID as `room` and `view`, uses an empty `push` flag so VDO.Ninja generates a unique publisher ID, and assigns a non-secret app label. This avoids the collision caused by using the literal publisher ID `false` in several simultaneous Browser Sources.

Trusted iframe messages must match both `https://vdo.socialstream.ninja` and the bridge iframe's `contentWindow`. The client accepts `dataReceived.overlayNinja`, `overlayNinja`, and `sendData.overlayNinja`; generic VDO control traffic is rejected.

Alerts can additionally enable the official server relay with fragment `server=1`. This opens only `wss://io.socialstream.ninja/extension` and joins `{ "out": 3, "in": 4 }`. The server path supports raw channel-4 objects, JSON frames, arrays, `messages`, `message`, `content`, bridge envelopes, and HTTP `action: "content"` frames whose `value` contains JSON. It reconnects with exponential delay capped at 30 seconds and closes on page unload. P2P remains active, and queue IDs/fingerprints suppress likely cross-transport duplicates.

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
- Full Twitch, Kick, and YouTube event coverage requires the corresponding SSN platform WebSocket/EventSub/bridge mode. That source capture setting is different from Alerts `server=1`, which receives SSN API/endpoint channel-4 traffic.

## Endpoint verification

The official API Sandbox custom-message form emits `eventType`, not necessarily `event`. Its default route uses `extContent` to send through the running extension; direct Dock/events tests can target channel 4. `sendChat` sends outgoing chat and is not an alert fixture.

For a direct endpoint test:

1. Generate Alerts with `--server 1 --debug 1 --sound 0`.
2. In the API Sandbox, use the same private session, select channel 4, set platform `twitch`, and set Event Type `new_follower`.
3. Expect one `SERVER · RAW` entry followed by `EVENT · twitch/new_follower → follow/minor · accepted`.
4. A second copy arriving over P2P should be suppressed by queue deduplication when it carries the same native ID or fingerprint.

Never publish or screenshot either full private URL. The exact platform matrix and limitations are in `docs/alerts-capability-matrix.md`.
