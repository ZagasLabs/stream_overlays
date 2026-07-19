# Security Model

Incoming SSN names, messages, badges, event text, avatars, image URLs, metadata, and role claims are untrusted.

- Every page sets `<meta name="referrer" content="no-referrer">`.
- The Session ID is read only from the URL fragment, validated to a narrow token format, passed only to the selected official SSN transports, and never logged or persisted.
- Text is normalized, stripped of markup, length-bounded, and rendered with `textContent`/text nodes.
- The sanitizer converts only verified `<img>` emotes into explicit nodes. Scripts, iframes, styles, arbitrary tags, inline handlers, unsafe protocols, malformed URLs, and non-local HTTP images are rejected.
- Fragment values are enum/number/color/token validated and never used as HTML, CSS text, or file paths.
- Wordle queues, cooldown maps, participants, attempts, alert queues, dedupe maps, DOM nodes, timers, and audio nodes are bounded and cleaned up.
- Wordle localStorage contains only versioned game state under a session-independent key. Alerts and chat use no browser storage.
- Admin access requires adapter boolean role metadata or an exact configured platform identity. Free-text roles and badges cannot grant control.
- Unknown alert events and Streamplace production alert claims fail closed.
- Alerts server mode is a boolean opt-in and connects only to the fixed official SSN WebSocket endpoint; fragments cannot supply a socket URL. Its debug log is memory-only, bounded to 60 entries, rendered with text nodes, and redacts session/room/API credential fields before display.
- Preflight scans source/fixtures for SSN sessions, common token formats, credential-like fixture fields, unsafe HTML sinks, disallowed storage, and remote runtime dependencies.

Operationally, treat a complete OBS URL as a credential. If it is exposed, rotate the SSN Session ID, update Browser Sources, clear OBS Browser cache, and rerun `npm run preflight`.
