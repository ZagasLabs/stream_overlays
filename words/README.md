# !Words

An original cooperative word game designed for stream participation, with its own branding, assets, sounds, and presentation.

## Local use

Run `npm run mock:words`, then open `http://127.0.0.1:8765/words/#mock=1&debug=1`. Live use reads the SSN Session ID only from `#session=SESSION_ID`. Viewers submit `!words CRANE`; the shorter `!w CRANE` and legacy `!word CRANE` aliases also work. Use `command=!guess` to replace the accepted command list.

State is stored under `words:v1:LANG:LENGTH`. The key and value never contain the SSN Session ID. Clear the Browser Source cache/site data to discard a saved round, or use an authorized `!words reset` command.

The board has a brief low-amplitude glitch approximately every 9–18 seconds. It uses only short transform/opacity animations and never changes game state. Mock mode includes a **Glitch pulse** button for immediate preview. `reduceMotion=1` and the operating system's reduced-motion preference disable it completely.

## Dictionaries and license

Accepted guesses are adapted subsets of [FrequencyWords](https://github.com/hermitdave/FrequencyWords), 2018 English and Spanish frequency-list content by Hermit Dave, licensed [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Transformation: take the token column in frequency order, normalize to Unicode NFKC/lowercase, retain alphabetic words of 4–8 Unicode letters, deduplicate, add the project's answer vocabulary, and cap each language at 10,000 entries. `scripts/generate-wordlists.mjs` records the reproducible transformation. The adapted word-list data remains CC BY-SA 4.0; see `data/NOTICE.md`.

Possible answers are a smaller, manually curated project vocabulary released under CC0-1.0. They are intentionally separate from the broader accepted-guess lists. Accented vowels can be preserved or folded; `ñ` remains distinct in both modes. No proprietary game answer or guess list was used.

## Controls

Verified broadcaster/moderator metadata or a matching `admins=platform:identity` fragment entry can run `start`, `pause`, `resume`, `reset`, `reveal`, and `new`. Display-name-only role claims are rejected. Specific answer selection is available only through the local mock harness; live rounds select from the curated answer list so the answer never appears in the URL or chat.

See the root README and `docs/obs-words.md` for full configuration and OBS setup.
