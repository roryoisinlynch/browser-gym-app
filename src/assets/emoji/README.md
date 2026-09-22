# Emoji artwork

SVGs from [Noto Emoji](https://github.com/googlefonts/noto-emoji) by Google, licensed under the Apache License 2.0. The full license text is in `LICENSE` beside this file. Fetched unmodified on 2026-09-22 through the Iconify API's `noto` set.

| File | Emoji | Code point | Used for |
| --- | --- | --- | --- |
| `medal-gold.svg` | 🥇 | U+1F947 | Gold session |
| `medal-silver.svg` | 🥈 | U+1F948 | Silver session |
| `medal-bronze.svg` | 🥉 | U+1F949 | Bronze session |
| `flag-white.svg` | 🏳️ | U+1F3F3 | Skipped session |
| `face-star-struck.svg` | 🤩 | U+1F929 | Week rating 1 |
| `face-slightly-smiling.svg` | 🙂 | U+1F642 | Week rating 2 |
| `face-neutral.svg` | 😐 | U+1F610 | Week rating 3 |
| `face-slightly-frowning.svg` | 🙁 | U+1F641 | Week rating 4 |
| `face-clown.svg` | 🤡 | U+1F921 | Week rating 5 |
| `bullseye.svg` | 🎯 | U+1F3AF | Set that met the intensity target |

The app renders these through `src/components/EmojiGlyph.tsx` rather than printing the characters as text, because the phone's emoji font may be a bitmap that blurs at large sizes. Add any new emoji there too.
