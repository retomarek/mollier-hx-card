---
name: visual-check
description: Render the built card in headless Chrome across themes, languages, widths, fixed tiles and error states, then look at the screenshots. Use after any change to rendering, styles, sizing, translations or the editor-facing config, and before a release.
---

# Visual check

The card is SVG + CSS inside Home Assistant's dashboard grid; most regressions are visual (clipped captions, wrong size at full width, unreadable text in one theme). Check them by looking, not by reasoning.

## Steps

1. `npm run build`
2. `npm run visual-check` (all cases) or `npm run visual-check -- <case> <case>` for a subset. It writes `tmp/visual/<case>.png` and prints one line per case with the card size; `PROBLEM` lines list console errors or a card that never rendered.
3. Read the PNGs that matter for the change with the Read tool. To compare several at once, combine them into one HTML page of `<img>` tags and screenshot that page once.
4. For each image check: nothing clipped (axis captions, labels, legend), text readable at that size, card fills a fixed tile and is capped and centred at full width, messages in the right language and colour (grey for hints, red only for errors), light and dark both legible.
5. Fix, rebuild, and re-run only the affected cases. Stop when the cases relevant to the change look right; report what you checked and anything you could not.

## Cases

Defined in `scripts/visual-check.mjs` (`CASES`): dark/English, light/German, narrow masonry (390 px), full width (1400 px), fixed tiles (6 rows), panel view, all iso-lines on, no statistics, failing fetch, unavailable sensor. Add a case when a change introduces a new state or option.

## Notes

- Chrome comes from `$CHROME_PATH` or the first of google-chrome / chromium on PATH. In the Home Assistant SSH add-on: `apk add chromium font-noto` (not persistent across add-on restarts).
- `npm run screenshots` renders the two README images and runs in CI on every push to `main`; this skill is the broader local check.
