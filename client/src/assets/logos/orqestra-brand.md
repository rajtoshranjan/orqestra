# Orqestra — Brand basics

## The mark
The Orqestra mark is a **Module Q**: eight resource modules form an open ring (the counter), and one module breaks off as the tail, spelling **Q**. The empty center is the graph's focal point; the single lighter module reads as the active, orchestrated node. It's a literal expression of the product — many resources, composed into one architecture graph.

## Color tokens
| Token | Hex | Use |
|---|---|---|
| `brand` (Iris) | `#7156FB` | Primary mark, links, primary actions |
| `brand-300` | `#B9ABFF` | Hover tints, soft fills |
| `brand-400` | `#9C86FF` | The "active node" accent module |
| `brand-600` | `#5B3FE0` | Pressed states, edges |
| `brand-700` | `#4733B5` | Deep accents on light surfaces |
| `ink` | `#0E1116` | Canvas, primary text, monochrome mark |
| `tile` | `#15171D` | App-icon / dark container background |
| `slate` | `#3A414D` | Secondary surfaces |
| `muted` | `#6B7280` | Secondary text |
| `line` | `#D9DBE0` | Borders, dividers |
| `paper` | `#F7F7FA` | Light background |
| `signal` | `#18B26B` | Deploy / healthy status only — use sparingly |

Suggested split: Iris for brand and interactive elements, ink/slate for the graph canvas and UI chrome, and signal-green strictly for "live / deployed" states so the architecture graph stays calm.

## Files
- `orqestra-mark.svg` — primary mark, transparent
- `orqestra-app-icon.svg` — mark on dark tile, 512×512
- `orqestra-favicon.svg` — compact tile for browser tabs
- `orqestra-logo-horizontal-light.svg` — mark + wordmark for light backgrounds
- `orqestra-logo-horizontal-dark.svg` — mark + wordmark for dark backgrounds
- `orqestra-mark-mono.svg` — single-color version (set `color:` to recolor)

## Clear space & sizing
- Keep clear space around the mark equal to **one module** on all sides.
- Minimum mark size: **20px**. Minimum favicon tile: **16px**.
- Don't recolor individual modules, rotate the mark, add effects, or stretch it.

## Typography (next step)
The wordmark currently uses a system bold sans as a placeholder. For production, set "Orqestra" in a geometric grotesk — good open-source options that suit an OSS project are **Inter**, **Geist**, or **General Sans** — at weight 700 with tight tracking (about −1.5 at large sizes), then **convert the wordmark to outlines** so it renders identically everywhere.

## Note
These are vector SVGs and scale infinitely. For raster needs (social avatars, OG images), export the app icon to PNG at 1024, 512, 256, and 32px.
