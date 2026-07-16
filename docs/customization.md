# Customization

Most visual tuning is centralized in `src/styles.css` under `:root`.

Useful CSS variables:

- `--accent`: small accent color for event emphasis.
- `--column-width`: overlay column width.
- `--outline`: comic panel outline thickness.
- `--overlay-scale`: set from the URL `scale` parameter.
- `--font`: system font stack.
- `--display-font`: heavy system-font stack used for names and event titles.
- `--ease-out-comic` and `--ease-impact`: entry/reflow timing curves.

Runtime parameters:

```text
#session=SESSION_ID&side=right&max=6&duration=18000&eventDuration=26000&accent=%23ffffff&scale=1
```

The default `max=6` sizes the internal chat viewport for roughly six normal cards. For a tighter viewport and a more spacious composition, use `max=5`. Messages stay in insertion order and move upward as new chat arrives; the upper edge clips them like a conventional chat feed.

The visual system is an original black-and-white comic dialogue UI. It uses compact connected name/message shapes, sharp asymmetry, skewed portrait frames, thick polygon outlines, impact marks, and fast entry/exit movement without copying assets from any commercial game.

Avatar frames retain a white outer keyline and use a restrained platform accent for YouTube, Twitch, Facebook, TikTok, Instagram, Kick, Streamplace, and Discord. Unknown platforms fall back to the configured `--accent`. Normal messages display a large white `!`, `?`, or `?!` impact mark only when that punctuation is present in the sanitized message text.

Cards use their natural height and never shrink to satisfy the column. Visible messages do not disappear during silence. `duration` and `eventDuration` mark when offscreen cards become eligible for cleanup, while a small hard buffer keeps the DOM bounded during fast chat. Use canvas-matched Browser Source dimensions; the overlay provides its own upper clipping edge and does not require a manual OBS crop.

Entry motion is staged across the panel, portrait/name, text, and impact details. Existing messages use a bounded FLIP reflow upward when new chat arrives; there is no separate exit animation. For heavier or softer motion, adjust only the short transform/opacity durations and timing curves; avoid continuous full-screen effects, blur filters, backdrop filters, and particle loops in OBS.
