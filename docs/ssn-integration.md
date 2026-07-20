# Social Stream Ninja Integration

Inspection date: **2026-07-19**. Official upstream revision inspected: [`27eafa34a884d1dc5b5ab4048a1ef092c38d0b40`](https://github.com/steveseguin/social_stream/tree/27eafa34a884d1dc5b5ab4048a1ef092c38d0b40), committed 2026-07-07.

## Official references inspected

- [Live Event Reference](https://socialstream.ninja/docs/event-reference.html), the canonical platform/event reference.
- [Official Multi-Stream Alert Box](https://github.com/steveseguin/social_stream/blob/27eafa34a884d1dc5b5ab4048a1ef092c38d0b40/multi-alerts.js), including its P2P bridge, channel-4 socket, payload flattening, aliases, and classifier.
- [Background relay routing](https://github.com/steveseguin/social_stream/blob/27eafa34a884d1dc5b5ab4048a1ef092c38d0b40/background.js), specifically `sendDataP2P`, `sendTargetP2P`, alert targeting, and the randomized Test Message payloads.
- [Official overlay-builder rules](https://github.com/steveseguin/social_stream/blob/27eafa34a884d1dc5b5ab4048a1ef092c38d0b40/aiprompt.html), which state that general chat/alert/game overlays use `dock` unless a dedicated target is intentionally required.
- [Official sample overlay](https://github.com/steveseguin/social_stream/blob/27eafa34a884d1dc5b5ab4048a1ef092c38d0b40/sampleoverlay.html) and [API Sandbox](https://socialstream.ninja/sampleapi.html).
- [SSN server API documentation](https://github.com/steveseguin/social_stream/blob/27eafa34a884d1dc5b5ab4048a1ef092c38d0b40/README.md#server-api-support).
- [SSN Twitch WebSocket/EventSub source](https://github.com/steveseguin/social_stream/blob/27eafa34a884d1dc5b5ab4048a1ef092c38d0b40/sources/websocket/twitch.js), including OAuth scopes, subscription creation, `409` handling, notification mapping, and Recent Events.
- Twitch's official [`channel.follow` reference](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channel-follow), [WebSocket lifecycle](https://dev.twitch.tv/docs/eventsub/handling-websocket-events/), and [Create EventSub Subscription response codes](https://dev.twitch.tv/docs/api/reference/#create-eventsub-subscription).
- [VDO.Ninja `push` documentation](https://docs.vdo.ninja/advanced-settings/setup-parameters/push).

## Transport

All overlays use a hidden VDO.Ninja iframe bridge. The modern shared client joins the fragment Session ID as `room` and `view` and is intentionally view-only; it does not publish a media/data stream. This follows SSN's current custom-overlay reference and avoids turning every read-only OBS source into an unnecessary publisher.

Chat is isolated from changes to the newer overlays. Its primary receiver keeps the proven `f284ccd` P2P semantics (`push=false`) plus the current `dock` label, while channel 4 remains an additive fallback. The regression appeared after that disabled parameter had been changed into a present-but-empty `push` flag, which enables publishing in VDO.Ninja. Restoring receiver semantics removes that suspect change from the working chat path.

Labels are routing addresses, not harmless application names. Chat and WordleStream use the official `dock` label because SSN's general `sendDataP2P` path forwards chat traffic there. Alerts opens three bounded, view-only receivers: `alerts` for SSN's alert-box route, `dock` for general events, and `meta` for metadata-only updates such as Twitch Hype Train. SSN's background relay explicitly targets every payload containing `meta` to the `meta` label, even when its **Exclude alerts from dock** setting suppresses the general Dock copy. Cross-label duplicates are suppressed. Do not replace these with invented labels such as `chat` or `wordle`.

Trusted iframe messages must match both `https://vdo.socialstream.ninja` and the bridge iframe's `contentWindow`. The client accepts `dataReceived.overlayNinja`, `overlayNinja`, and `sendData.overlayNinja`; generic VDO control traffic is rejected.

All three overlays keep P2P active and also connect to the documented server relay by default. The fixed external endpoint is `wss://io.socialstream.ninja`, joined as `{ "out": 3, "in": 4 }`. SSN's `/dock` and `/extension` endpoint variants were also tested with disposable rooms and currently interoperate on the same channel routing. Channel 4 is required when **Send chat messages to API server** diverts Dock traffic away from P2P. The multi-route receiver therefore works with that switch either on or off. `server=0` is an explicit P2P-only escape hatch.

The server path supports raw channel-4 objects, JSON frames, arrays, `messages`, `message`, `content`, bridge envelopes, and HTTP `action: "content"` frames whose `value` contains JSON. It reconnects with exponential delay capped at 30 seconds and closes on page unload. A bounded cross-transport fingerprint cache suppresses the same payload when targeted P2P and channel 4 both deliver it; Alerts also retains its longer event-ID replay protection.

The Session ID comes only from `new URLSearchParams(window.location.hash.slice(1))` through the shared fragment parser. It is not logged or stored. `server` is boolean; no fragment value can become a WebSocket host. SSE is not used.

## Confirmed common fields

Official or adapter-confirmed fields used by the overlays are `id`, `timestamp`, `chatname`, `chatmessage`, `chatimg`, `chatbadges`, `type`, `platform`, `sourceName`, `sourceImg`, `event`, `eventType`, `eventSubType`, `alertType`, `membership`, `subtitle`, `title`, `hasDonation`, `bits`, `donoValue`, `currency`, `contentimg`, `userid`, `moderator`, `private`, and `meta`.

`meta` is platform-specific. Confirmed examples include YouTube `channelId`, Twitch `bits`, gift totals and raid viewers, Kick `amount`/`currency`/`supporter`, native `messageId`, and reply metadata. Alert event aliases may also appear under `meta.event`, `meta.eventType`, `meta.eventSubType`, `meta.originalEventType`, `meta.rawType`, `meta.alertType`, or `meta.eventName`.

Display names are fallback identities only; WordleStream prefers `userid`, YouTube `meta.channelId`, or Streamplace identity metadata when present. Broadcaster/owner/moderator roles are trusted only when delivered as booleans by an adapter. This includes SSN Twitch WebSocket's strict `mod: true`, which it derives from moderator or broadcaster badge tags. Badge labels, role strings, and free text never grant admin rights.

## Event handling and diagnostics

- Alerts classify canonical fields plus the documented legacy aliases used by SSN's current alert box.
- Donation fields can create an alert even when `event` is absent. A membership field without an event is accepted only when the payload has no normal chat message, avoiding an alert for every member chat line.
- Periodic counters and status updates do not become cards. Unknown values and Streamplace production alert claims fail closed.
- `debug=1` adds a bounded, text-only log. Every trusted raw envelope is shown before extraction, then each payload is marked `EVENT`, `CHAT`, or `IGNORED` with source, event, target type/tier, and reason. Sensitive keys and private URL parameters are redacted; nothing is persisted or written to console.
- Full Twitch, Kick, and YouTube event coverage requires the corresponding SSN platform WebSocket/EventSub/bridge mode. That source-capture setting is different from the overlay's automatic channel-4 receiver.
- Twitch follows specifically require EventSub `channel.follow` v2, an OAuth token containing `moderator:read:followers`, and an authenticated broadcaster or moderator. SSN's Twitch WebSocket page logs either `Successfully subscribed to channel.follow` or the subscription failure. Twitch does not document repeated follow/unfollow as a supported test mechanism; use a fresh account after confirming the EventSub subscription.
- SSN's global **Mechanics → Hide stream events (follows, likes, subs)** switch must be off. Despite its presentation as a display preference, the current Twitch WebSocket source returns before forwarding every non-cheer EventSub notification when this setting is on; Bits can therefore work while follows, Hype Train, subs, and raids do not. Also disable **Hide specific events** or remove `new_follower` from its list while diagnosing.
- Real Twitch Bits and Hype Train events are separate EventSub subscriptions. Re-authorize the Twitch WebSocket source as the broadcaster so its token contains `bits:read` and `channel:read:hype_train`; an old token does not gain newly requested scopes automatically.
- Twitch does not require a channel to be live for `channel.follow`; the subscription is valid whenever that channel receives a follow. Live state is therefore not the explanation when a real follow is absent. Confirm the EventSub subscription and OAuth role/scope first.
- A normal Twitch popout/DOM chat is insufficient for follows. Keep SSN's dedicated Twitch IRC WebSocket source open and connected to the broadcaster's exact channel. Its **Channel Role** must read `Broadcaster` (or a correctly authorized moderator). A numeric follower total proves that Helix polling returned a total but does not by itself prove that `channel.follow` EventSub is enabled; SSN's own Recent Events panel should receive the named follow before transport to any custom overlay is considered.
- SSN polls Twitch's follower total every 60 seconds. In Alerts `debug=1`, an initial `follower_update` establishes only a count baseline. If that total later increases without a preceding `new_follower`, Twitch accepted a follower-count change but SSN did not deliver the named EventSub event. If neither Twitch's Creator Dashboard Activity Feed nor the count changes, Twitch itself did not register the test follow.
- Keep only one Twitch WebSocket/EventSub source active for the broadcaster across the SSN browser extension, standalone app, browser profiles, and other computers. Twitch returns HTTP `409` when the same event type and condition already have a subscription. At upstream revision `27eafa3`, SSN treats that response as active without verifying that the existing subscription's `transport.session_id` belongs to the current socket. A second source can therefore look connected while the first source receives the event. Close every duplicate, wait at least 70 seconds for disconnected WebSocket subscriptions to age out, then open and connect one source.
- SSN currently exposes chat connection and role information but no per-subscription EventSub status, and its message switch does not surface Twitch `revocation` frames. For a no-console check in Chrome/Edge, open Developer Tools **Network**, enable **Preserve log**, filter `eventsub/subscriptions`, then reconnect the single Twitch source. Find the POST whose request payload has `type: channel.follow`: expected status is `202` and response subscription status is `enabled`. `403` means the scope is absent, `401` means token/client authorization failed, `409` means another matching subscription exists, and `429` means a subscription/connection limit. Never copy or share the request's Authorization header.
- YouTube DOM/Standard capture does not emit new-subscriber follows. `new_follower` comes only from the authenticated YouTube Data API/WebSocket source, only when monitoring the authenticated owner's own channel. SSN polls `myRecentSubscribers` every five minutes; YouTube exposes only public subscriptions and documents a possible delay of up to four hours.
- SSN's generic **Test Message** is randomized chat test data, not a deterministic alert test. Two branches literally produce `hasDonation: "2500 gold"` and a YouTube Shorts `hasDonation: "3 hearts"`; Alerts must accept those because `hasDonation` is an official alert signal, but seeing them does not prove that a real follow source is configured.

## Endpoint verification

Channels are directional. Channel 1 is the API Sandbox's expected default for commands going **to the SSN extension**. Channel 4 carries captured chat/events **from the extension to listeners**. The overlay listens on channel 4; this does not mean the Sandbox's main connection must default to 4.

The Sandbox custom-message form emits `eventType`, not necessarily `event`. Leaving its message-channel selector at Default sends `extContent` to the extension on channel 1, after which SSN forwards it normally. Selecting channel 4 sends that fixture directly to Dock/event listeners. `sendChat` sends outgoing chat to platforms and is not an alert fixture.

For a direct endpoint test:

1. Generate Alerts with `--debug 1 --sound 0`; channel 4 is already enabled.
2. Use the clearly marked local controls to prove the renderer, queue, and each classifier independently.
3. For an external Sandbox test, use the same private session and channel 4 in the **Advanced Message Generator**. Use Event Type `new_follower` or `cheer`; for Hype Train, use the dedicated **Hype Train Begin/Progress** preset when present, which emits the documented raw `{ type: "twitch", event: "hype_train", meta: ... }` payload. The separate top-level connection still showing channel 1 is normal.
4. Expect one `SERVER · RAW` entry followed by an `EVENT · ... · accepted` classification.
5. A second copy arriving over P2P is suppressed by the shared cross-transport deduplicator and alert replay cache.

Bits accepts explicit `cheer`/`bits`, Twitch donation text containing “bits”, and positive `bits`/`meta.bits` fields. Hype Train accepts canonical `hype_train`, compatibility aliases (`hype`, `hypetrain`), full `channel.hype_train.begin|progress|end` names, and SSN's targeted `{ hype: meta }` envelope when it contains train metadata.

The **Preview & Test** buttons beside SSN's own Multi-Stream Alert Box post fixtures into SSN's embedded preview iframe. At upstream revision `27eafa3`, SSN also broadcasts follow, subscription, donation, bits, and raid fixtures, but its external fixture builder has no Hype case; clicking that panel's **Hype** button therefore cannot reach a third-party overlay. Use SSN's separate **Fake Hype Train** metadata button, the API Sandbox's Hype Train preset on channel 4, or this project's local control instead. A production EventSub event remains the final end-to-end test.

With `debug=1`, **LOCAL · render follow**, **LOCAL · render Bits**, and **LOCAL · render Hype Train** inject memory-only fixtures directly into the renderer. If those cards appear but no `P2P:* · RAW` or `SERVER · RAW` entry appears for a real test, rendering/classification works and the fault is upstream capture or transport. The buttons are deliberately labeled so they cannot be mistaken for production evidence.

Never publish or screenshot either full private URL. The exact platform matrix and limitations are in `docs/alerts-capability-matrix.md`.
