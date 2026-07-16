# OBS Setup

## Local Mock Mode

1. Run `npm run mock`.
2. Use the printed URL:

```text
http://127.0.0.1:8765/#mock=1&debug=1
```

Mock mode cycles through normal chat, long messages, moderator messages, subscriptions, donations, and raids.

## Linux / CachyOS / XWayland

1. In OBS 32.x, add a Browser Source.
2. Set Width and Height to match your canvas:
   - QHD canvas: `2560` by `1440`.
   - FHD canvas: `1920` by `1080`.
3. Use the production GitHub Pages URL plus your private fragment:

```text
https://OWNER.github.io/REPOSITORY/#session=SESSION_ID&side=right
```

4. Leave `Shutdown source when not visible` disabled.
5. Leave `Refresh browser when scene becomes active` disabled.
6. Keep the Browser Source background transparent.
7. Place the source as needed, but do not make it artificially taller or crop it to manage chat overflow. The overlay clips old messages at its own upper viewport edge.
8. Do not scale it below your canvas size unless you have verified readability.

## Windows

Use the same Browser Source settings as Linux:

- QHD: `2560` by `1440`.
- FHD: `1920` by `1080`.
- Transparent background.
- `Shutdown source when not visible`: disabled.
- `Refresh browser when scene becomes active`: disabled.

## Configuration

Flip the overlay to the left:

```text
#session=SESSION_ID&side=left
```

Limit visible messages:

```text
#session=SESSION_ID&max=4
```

Change when offscreen messages become eligible for cleanup:

```text
#session=SESSION_ID&duration=15000&eventDuration=24000
```

Scale the overlay:

```text
#session=SESSION_ID&scale=1.1
```

Change the accent color:

```text
#session=SESSION_ID&accent=%23ff003c
```

Disable avatars, badges, or platform markers:

```text
#session=SESSION_ID&showAvatar=0&showBadges=0&showPlatform=0
```

Reduce motion manually:

```text
#session=SESSION_ID&reduceMotion=1
```

## Cache And Privacy

If OBS keeps an old version loaded, open OBS Settings, find Browser Source cache controls, and clear the browser cache. Restart OBS if needed.

Do not expose the full URL on stream or in screenshots. The fragment contains your Social Stream Ninja Session ID.
