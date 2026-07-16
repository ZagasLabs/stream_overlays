# Security Notes

## Threat Model

The overlay runs in OBS Chromium/CEF and receives untrusted data from live chat sources through Social Stream Ninja. Attackers may control names, messages, emote markup, badge labels, avatar URLs, and event text.

Main risks:

- DOM injection from chat text or emote HTML.
- Unsafe image URLs such as `javascript:` or non-local `http:`.
- CSS injection through inline `style` attributes.
- Script execution through event handlers, scripts, iframes, or malformed HTML.
- Session ID exposure through committed files, console logs, OBS screenshots, or shared URLs.
- Fake or malformed donation/event payloads.

## Controls

- Production configuration uses the URL fragment, not query parameters: `#session=SESSION_ID`.
- The Session ID is not written to localStorage, sessionStorage, source files, fixtures, generated HTML, or CI logs.
- `index.html` sets `<meta name="referrer" content="no-referrer">`.
- Chat text is rendered with text nodes, not unsafe `innerHTML`.
- Emote and badge image handling uses a narrow allowlist: `img`-like data is converted into explicit DOM nodes with validated URLs.
- Inline event handlers, styles, scripts, iframes, unsafe protocols, and arbitrary HTML tags are stripped.
- Avatar, platform, badge, and emote URLs must be HTTPS, except local development HTTP URLs for localhost.
- Debug diagnostics are disabled by default and are written to the overlay UI only. Rejected payload diagnostics contain field names, never field values or Session IDs.
- The iframe listener accepts only SSN `overlayNinja` envelopes and ignores generic VDO.Ninja content/control traffic.
- Incoming payloads marked `private` are discarded before normalization and rendering.
- Preflight scans for accidental Session IDs, browser storage usage, and remote runtime dependencies.

## Operational Guidance

Do not show the full OBS Browser Source URL on stream. Treat it like a private credential because the fragment contains the Session ID.

If a malicious message appears in chat, the overlay should display only plain text and approved images. If the overlay behaves unexpectedly, remove the Browser Source, clear OBS browser cache, rotate the SSN Session ID, and rerun `npm run preflight`.
