# OBS Overlay Monorepo

Three dependency-free static Browser Source overlays share one GitHub Pages deployment:

- `/chat/` — the Social Stream Ninja comic chat.
- `/wordlestream/` — a cooperative multilingual word game.
- `/alerts/` — normalized multi-platform alerts with managed procedural or locally customized audio.

All runtime configuration is read from the URL fragment. A Social Stream Ninja Session ID is never hard-coded, stored, logged, included in fixtures, or sent to CI.

## Requirements and commands

Use Node.js 24 or newer. There are no package dependencies.

```sh
npm run dev                 # all apps, chat URL printed
npm run dev:chat
npm run dev:wordle
npm run dev:alerts
npm run mock:chat
npm run mock:wordle
npm run mock:alerts

npm run test
npm run test:wordle
npm run test:alerts
npm run check
npm run preflight
npm run build:pages
```

The server always binds to `127.0.0.1:8765`. Mock URLs are:

```text
http://127.0.0.1:8765/chat/#mock=1&debug=1
http://127.0.0.1:8765/wordlestream/#mock=1&debug=1
http://127.0.0.1:8765/alerts/#mock=1&debug=1
```

## Private URL generation

Run these commands only when you intend to print a private URL:

```sh
npm run url -- --session SESSION_ID
npm run url:wordle -- --session SESSION_ID
npm run url:alerts -- --session SESSION_ID

npm run url -- --session SESSION_ID --production
npm run url:wordle -- --session SESSION_ID --production
npm run url:alerts -- --session SESSION_ID --production
```

The production base is declared in package metadata as `https://zagaslabs.github.io/stream_overlays/`; `PAGES_BASE_URL` or `GITHUB_REPOSITORY` can override it for forks and CI. CI redacts a supplied session defensively, though CI never needs one.

## Configuration

Common settings include `session`, `accent`, `scale`, `debug`, `mock`, `reduceMotion`, and visibility options. Values are validated and bounded; fragment values never become HTML, CSS declarations, or asset paths.

WordleStream adds `lang=en|es`, `command=!w,!word`, `maxAttempts=3..10`, `wordLength=4..8`, cooldowns in seconds, `admins=platform:identity`, `accents=fold|preserve`, and optional low-volume `sound`/`volume`. See [WordleStream](wordlestream/README.md).

Alerts adds `position=top|center|bottom`, `side=left|center|right`, per-tier durations/priorities, master/per-tier volumes, and avatar/platform toggles. Add `server=1` when the source must also receive SSN endpoint/webhook traffic from server channel 4; normal platform events continue to arrive over P2P. With `debug=1`, a bounded diagnostic panel shows raw envelopes, transport, classification, and rejection reasons while redacting session/token fields. Custom WAV/OGG files can be assigned by tier and event through `alerts/assets/sounds/manifest.json`; no asset path is accepted from the URL. See [Alerts](alerts/README.md).

## Deployment

The Pages workflow runs syntax checks, all tests, and preflight before building an allowlisted `dist/` artifact. It publishes only the chat runtime, shared runtime, the two new app runtimes, dictionaries, and required assets. Tests, fixtures, documentation, screenshots, development scripts, and secrets are excluded.

In GitHub Settings → Pages, select **GitHub Actions** as the source. No SSN secret is required. Public paths remain:

```text
https://zagaslabs.github.io/stream_overlays/chat/
https://zagaslabs.github.io/stream_overlays/wordlestream/
https://zagaslabs.github.io/stream_overlays/alerts/
```

The repository root redirects to `/chat/` while preserving URL-fragment configuration. The GitHub repository must be named `stream_overlays` for these exact public paths.

## Operations and troubleshooting

- OBS cache: refresh the Browser Source cache only when deploying an update. For a stuck old build, clear OBS Browser cache and restart OBS.
- SSN connection: confirm the extension/app is enabled, the source chat is open, and platform WebSocket mode is enabled for full Twitch/Kick/YouTube events. For endpoint tests, generate an Alerts URL with `--server 1 --debug 1` and send the fixture to channel 4. The platform WebSocket mode and the optional SSN server/API relay are separate settings.
- Word game state: keep source shutdown/scene refresh disabled. Clear site data or use an authorized reset to remove a saved round.
- Audio: use OBS's Browser Source audio control and avoid also capturing the same audio through Desktop Audio.
- Privacy: never display, paste into chat, commit, or screenshot a complete production URL; its fragment contains the Session ID.

Detailed guides: [WordleStream OBS](docs/obs-wordlestream.md), [Alerts OBS/audio](docs/obs-alerts.md), [SSN integration](docs/ssn-integration.md), [capability matrix](docs/alerts-capability-matrix.md), and [security](docs/security.md).

## Updating an overlay

Keep each app's logic, styles, tests, and docs within its directory. Put only transport, sanitization, validated configuration primitives, platform identity, and neutral design tokens in `shared/`. Run `npm run check`, `npm run preflight`, and `npm run build:pages`; verify all three paths in `dist/` before opening a pull request.
