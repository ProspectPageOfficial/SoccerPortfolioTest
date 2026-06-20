# Soccer Portfolio — Goalkeeper Edition

A single-file, zero-dependency goalkeeper portfolio site. Double-click
`index.html` and you're done — no build step, no frameworks, no CDN
scripts required.

## What's in here

- **`index.html`** — the whole site. HTML, CSS, and a tiny vanilla-JS tab
  switcher all live in one self-contained file.
- **`.gitignore`** — keeps OS junk and future tooling artifacts out.
- **`README.md`** — you're reading it.

## Features

- Hero banner with player photo, name, position, and stat badges
- Tabbed sections (vanilla JS, one delegated handler):
  - **About** — bio, strengths, what they're working on
  - **Career Stats** — stat tiles + by-competition breakdown
  - **Season Log** — recent match-by-match table
  - **Fixtures** — upcoming match cards
  - **Highlights** — placeholder slots for video embeds
- Goalkeeper-specific metrics: clean sheets, saves, save %, GA/90,
  penalties saved
- Mobile-friendly layout, accessible tab roles, focus-visible outlines
- CSS custom properties — recolor the whole site by editing the
  `:root` block at the top

## Running it

```bash
# Option A: just open it
start index.html        # Windows
open  index.html        # macOS
xdg-open index.html     # Linux

# Option B: serve it locally (any static server works)
python -m http.server 8000
# then visit http://localhost:8000
```

## Customizing

Everything you'd want to change lives in `index.html`:

| Want to change...    | Where to look                                  |
| -------------------- | ---------------------------------------------- |
| Colors / theme       | `:root { ... }` at the top of the `<style>`    |
| Player name & badges | Inside `<header class="hero">`                 |
| Bio copy             | `#panel-about` section                         |
| Stats numbers        | `#panel-stats` — stat tiles and table rows     |
| Recent matches       | `#panel-season` — table rows                   |
| Upcoming fixtures    | `#panel-fixtures` — `.fixture` blocks          |
| Video embeds         | `#panel-film` — swap placeholders for iframes  |
| Player photo         | `<img class="player-photo">` `src` attribute   |

## Design notes

- **One file** because YAGNI — there's nothing here that justifies a
  build system.
- **CSS custom properties** as a single source of truth for colors,
  radii, and shadows (DRY).
- **One tab handler** swaps `active` classes for all buttons and panels
  in a single function — no per-tab listeners.
- Accessible: tabs use `role="tab"` / `role="tabpanel"` /
  `aria-selected`, focus rings are visible.

## License

Personal portfolio template — do whatever you want with it.
