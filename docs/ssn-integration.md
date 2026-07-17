# Social Stream Ninja Integration

Inspection date: **2026-07-16**. Upstream manifest version observed: **3.49.1**. A commit SHA could not be obtained from the restricted local network, so the date, public manifest version, and source paths are recorded instead.

## Official references inspected

- [Live Event Reference](https://socialstream.ninja/docs/event-reference.html), the canonical platform/event reference.
- [`steveseguin/social_stream`](https://github.com/steveseguin/social_stream), especially `api.md`, `baretemplate.html`/sample overlay guidance, `sources/youtube.js`, `sources/twitch.js`, `sources/kick.js`, `sources/streamplace.js`, and the matching `sources/websocket/*` adapters.
- [Official API sample](https://socialstream.ninja/sampleapi.html) and official SSE sample for transport comparison.

## Transport

All three overlays use the official hidden VDO.Ninja iframe bridge pattern. `shared/ssn/client.js` loads `https://vdo.socialstream.ninja/` with `view` and `room` set to the fragment Session ID, verifies both `event.origin` and the iframe `contentWindow`, and accepts only `dataReceived.overlayNinja` or `overlayNinja` envelopes. Generic VDO control traffic is ignored.

The Session ID comes only from `new URLSearchParams(window.location.hash.slice(1))` through the shared fragment parser. It is not logged or stored. Direct WSS/SSE APIs are not used because the existing iframe path is already proven in this repository and does not require enabling the separate API relay.

## Confirmed common fields

Official or adapter-confirmed fields used by the overlays are `id`, `timestamp`, `chatname`, `chatmessage`, `chatimg`, `chatbadges`, `type`, `sourceName`, `sourceImg`, `event`, `membership`, `subtitle`, `title`, `hasDonation`, `donoValue`, `currency`, `contentimg`, `userid`, `moderator`, `private`, and `meta`.

`meta` is platform-specific. Confirmed examples include YouTube `channelId`, Twitch `bits`, gift totals and raid viewers, Kick `amount`/`currency`/`supporter`, native `messageId`, and reply metadata. Display names are fallback identities only; WordleStream prefers `userid`, YouTube `meta.channelId`, or Streamplace identity metadata when present.

Fields such as broadcaster/owner flags are treated as verified only when delivered as booleans by the adapter. Badge labels or free text never grant admin rights. Amount strings remain display text; numeric thresholds use `donoValue` or documented numeric metadata where available.

## Event handling policy

- Alerts keys off canonical `event` values and `hasDonation`, with documented deprecated aliases accepted for older SSN versions.
- Unknown values are ignored with debug-only field names, never field values.
- Streamplace chat is accepted by WordleStream, but Streamplace alert events are not synthesized.
- Viewer/follower/subscriber count updates do not automatically become alerts; repeated polling would create noise. Only explicit milestone events are rendered.
- Full Twitch, Kick, and YouTube alert coverage requires SSN WebSocket/bridge mode. DOM capture alone is limited.

The exact platform matrix and limitations are in `docs/alerts-capability-matrix.md`.
