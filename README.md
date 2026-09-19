# Days Alive

A single-screen "Days Alive" calculator. Enter your birth date and the form
flips to a result view showing how many days you've been alive (with a live
seconds ticker), your age, weeks and hours lived, share of an 80-year lifespan,
and a "What's coming up" section: your next round-number day, next birthday, and
golden birthday.

Warm, minimal UI — cream + terracotta, Caprasimo + Figtree type. No header,
navbar, or footer.

## Run it

It's plain HTML/CSS/JS — no build needed to view. Just serve the folder:

```bash
python3 -m http.server 8099
```

Then open http://localhost:8099 . (Opening `index.html` via `file://` also works
in most browsers.)

Try `?dob=2002-06-12` on the URL to pre-fill and auto-calculate.

## Editing the logic

The logic is written in **TypeScript** (`src/main.ts`) and compiled to `app.js`,
which is what the page loads. After changing the `.ts` file, recompile:

```bash
npm install   # first time only — installs the TypeScript compiler
npm run build # compiles src/main.ts -> app.js
```

Use `npm run watch` to recompile automatically while editing.

## Files

- `index.html` — markup (semantic, SEO + Open Graph tags)
- `styles.css` — styling, light/dark themes, responsive layout
- `src/main.ts` — TypeScript source (calculation, animation, countdown, storage)
- `app.js` — compiled output loaded by the page (don't edit by hand)

## Features

- Local-date parsing (no timezone off-by-one)
- Live seconds ticker; short count-up on the big number (respects
  `prefers-reduced-motion`)
- Age breakdown, weeks/hours lived, % of an 80-year lifespan
- "What's coming up": next round-number day, next birthday, golden birthday
- Calculate on click or Enter; friendly inline validation (empty / future)
- Remembers your date in `localStorage`; supports `?dob=YYYY-MM-DD`
- "Copy result" button
- Accessible: labelled input, `aria-live` result, visible focus states
