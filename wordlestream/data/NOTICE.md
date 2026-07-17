# Word-list attribution

`en.js` and `es.js` adapt the 2018 English and Spanish content from [Hermit Dave's FrequencyWords](https://github.com/hermitdave/FrequencyWords), licensed under [Creative Commons Attribution-ShareAlike 4.0 International](https://creativecommons.org/licenses/by-sa/4.0/).

Changes made on 2026-07-16: selected the token column in frequency order; normalized tokens to Unicode NFKC and locale lowercase; retained alphabetic tokens of 4–8 Unicode letters; deduplicated; merged a small project-authored answer vocabulary; capped each accepted list at 10,000 entries; serialized the result as JavaScript arrays. The transformation is reproducible with `scripts/generate-wordlists.mjs` and the upstream `content/2018/en/en_50k.txt` / `content/2018/es/es_50k.txt` files.

The adapted `en.js` and `es.js` word-list data is distributed under CC BY-SA 4.0. The project-authored answer vocabulary, considered separately before incorporation, is offered under CC0-1.0.
