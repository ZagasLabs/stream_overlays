# Social Stream Ninja Integration Notes

Inspection date: 2026-07-15.

Official upstream material consulted:

- `baretempate.html` in `steveseguin/social_stream`: official custom overlay example using a hidden `vdo.socialstream.ninja` iframe and `window.postMessage`.
- `api.md` in `steveseguin/social_stream`: API channels, message field notes, listener URL examples, and donation/message examples.
- `https://socialstream.ninja/sampleapi.html`: official API sandbox/sample page.
- `https://socialstream.ninja/tests/sse.html`: official SSE sample page for API testing reference.

The local shell could not resolve GitHub from the sandbox, so the upstream files were inspected through browser-backed retrieval. No upstream commit SHA was available in the local workspace. Recheck the current upstream repository before changing transport behavior.

## Transport Used

Production uses the official browser iframe bridge pattern from `baretempate.html`.

At runtime, `src/ssn-client.js` creates a hidden iframe pointed at:

```text
https://vdo.socialstream.ninja/?ln&salt=vdo.ninja&password=false&push=false&vd=0&ad=0&autostart&cleanoutput&view=SESSION&room=SESSION
```

The overlay listens for `message` events from `https://vdo.socialstream.ninja`, verifies the event came from the created iframe, and accepts only `dataReceived.overlayNinja` or `overlayNinja` payloads. Generic VDO.Ninja `content` messages are intentionally ignored because they can contain bridge control traffic rather than SSN chat.

The Social Stream Ninja Session ID is read only from the URL fragment:

```text
#session=SESSION_ID
```

The fragment can also include non-secret display configuration:

```text
#session=SESSION_ID&side=right&accent=%23ffffff&max=6&duration=18000
```

Direct WebSocket listener URLs documented in `api.md`, including channel 4 paths such as `wss://io.socialstream.ninja/join/{session}/4`, are not the default because they require API relay behavior outside the simplest custom-overlay path.

## Relevant Incoming Fields

The normalizer expects these documented or observed SSN fields when present:

- `chatname`: display name.
- `chatmessage`: chat body, sometimes containing emote HTML.
- `chatimg`: avatar URL.
- `chatbadges`: badge data or badge image URLs.
- `type`: source platform identifier.
- `sourceName`: source platform label.
- `sourceImg`: source platform icon URL.
- `textonly`: text-only indicator.
- `hasDonation`, `amount`, `currency`: donation or paid-event values.
- `contentimg`: attached content image.
- `membership`: member/subscriber context.
- `title`, `subtitle`: event or paid-message context.
- `moderator`: moderator role indicator.
- `event`: event type such as subscription, raid, follow, or system.
- `admin`, `bot`, `private`, `nameColor`, `userid`, `id`, `question`, `meta`: optional metadata used conservatively.

## Assumptions And Fallbacks

- A normal chat payload must contain visible sanitized text or at least one valid emote image. A name or avatar by itself is not sufficient.
- Payloads marked `private` are never rendered by the public overlay.
- Recognized structured events require an author, message, or event detail. Empty `event: true` signals are ignored.
- Unknown event types with visible content degrade to a safe system message. Empty unknown events are ignored.
- Boolean events are inferred from message text only when it contains a specific action phrase such as "started following" or "raided with". Ordinary words such as "like" or "heart" inside chat do not create reaction banners.
- A `member` or `subscriber` role does not itself turn ordinary chat into a subscription event; an explicit event or descriptive membership action is required.
- Unusable payloads are ignored with a debug-only list of field names. Diagnostics never include field values or the Session ID.
- Badge and emote HTML is not trusted. Only HTTPS image URLs and narrow image attributes survive sanitization.
- Platform icons and avatar URLs are optional. Missing avatars render a local generated fallback.
- Featured-message classification is intentionally conservative because a reliable official field was not confirmed beyond optional `question` or `featured` style metadata.
- The overlay does not store, log, screenshot, or commit the Session ID.
