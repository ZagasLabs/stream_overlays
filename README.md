# Comic Chat Overlay for OBS

Static animated multi-platform chat overlay for OBS Browser Source, powered by Social Stream Ninja. The design is an original high-contrast comic dialogue system with compact connected panels, skewed avatar frames, angular author labels, and event-specific compositions.

## 1. Requirements

- Node.js 20 or newer.
- OBS 32.x.
- Social Stream Ninja Session ID for live use.

No runtime framework, backend, database, Docker, CDN scripts, analytics, or remote fonts are used.

## 2. Install Development Dependencies

There are no package dependencies, but run install once if you want npm to create a lockfile:

```sh
npm install
```

## 3. Run Mock Mode

```sh
npm run mock
```

Open:

```text
http://127.0.0.1:8765/#mock=1&debug=1
```

## 4. Run Tests

```sh
npm run test
npm run check
npm run preflight
```

## 5. Configure A Real SSN Session Locally

Start the static server:

```sh
npm run dev
```

Generate a private local URL:

```sh
npm run url -- --session SESSION_ID
```

The Session ID is placed in the fragment and is not stored by the project.

## 6. Deploy To GitHub Pages

The included workflow deploys the static site from the default branch using GitHub Pages actions. Enable GitHub Pages in repository settings and select GitHub Actions as the source.

No Session ID is required in GitHub Actions.

## 7. Generate The OBS URL

For a production URL, run this from a GitHub repository with `origin` set, or provide `PAGES_BASE_URL`:

```sh
npm run url -- --session SESSION_ID --production
```

Optional parameters:

```sh
npm run url -- --session SESSION_ID --production --side left --max 5 --duration 16000 --accent "#ff003c"
```

## 8. Add It To OBS

Add a Browser Source and use the generated URL. Recommended source size:

- `2560x1440` for QHD.
- `1920x1080` for FHD.

Keep background transparent, and leave `Shutdown source when not visible` and `Refresh browser when scene becomes active` disabled.

## 9. Customize Appearance

Use fragment parameters for runtime changes:

```text
#session=SESSION_ID&side=right&max=6&duration=18000&eventDuration=26000&accent=%23ffffff&scale=1
```

Edit `src/styles.css` for deeper visual changes.

## 10. Troubleshooting

- Connection: confirm the SSN Session ID is correct and SSN is actively receiving chat.
- Missing messages: test first with `#mock=1&debug=1`, then confirm Social Stream Ninja sees the platform messages.
- Empty events: transport/control packets and events without visible information are intentionally ignored.
- Cache: clear OBS browser cache if old styling remains.
- CORS/referrer: production uses the official SSN iframe bridge and `no-referrer`.
- Private URL: never show the full Browser Source URL on stream.

## Command Reference

| Command | Purpose |
| --- | --- |
| `npm run dev` | Serve the overlay at `127.0.0.1:8765`. |
| `npm run mock` | Serve and print the mock/debug URL. |
| `npm run test` | Run Node unit tests. |
| `npm run check` | Run syntax checks and tests. |
| `npm run preflight` | Check required files and secret-safety rules. |
| `npm run url -- --session SESSION_ID` | Print local OBS URL. |
| `npm run url -- --session SESSION_ID --production` | Print GitHub Pages OBS URL. |
