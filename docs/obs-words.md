# !Words OBS Setup

1. Generate a private URL with `npm run url:words -- --session SESSION_ID --production`. Never show or screenshot the complete URL.
2. Add an OBS Browser Source using `https://zagaslabs.github.io/stream_overlays/words/#session=SESSION_ID`.
3. Use the full canvas size: **2560×1440** for QHD or **1920×1080** for FHD. The page outside the game panel is transparent.
4. Leave **Shutdown source when not visible** disabled.
5. Leave **Refresh browser when scene becomes active** disabled. These settings preserve the active round while changing scenes.
6. Keep custom CSS empty unless you intentionally maintain an override.

Viewers send `!words CRANE`. The aliases `!w CRANE` and `!word CRANE` remain available. Change language with `lang=es`; Spanish input supports accents, with accented-vowel folding enabled by default and `ñ` preserved. Use `command=!guess` for a custom command and `userCooldown`/`globalCooldown` values in seconds.

Broadcasters and moderators can run `!words start`, `pause`, `resume`, `reset`, `reveal`, or `new` when SSN provides verified role metadata. Add explicit stable identities with `admins=twitch:name,kick:name,youtube:channel-id` when needed. A display-name role string is not sufficient.

The round persists in Browser Source site data, not in the URL. `reset` clears guesses but keeps the answer; `new` starts a fresh random answer. To fully discard saved state, remove/re-add the source or clear OBS Browser Source cache/site data. Mock testing uses:

```text
http://127.0.0.1:8765/words/#mock=1&debug=1
```

The debug panel demonstrates both languages, invalid/duplicate/cooldown cases, four platforms, Unicode/long names, victory, failure, admin controls, and reset.
