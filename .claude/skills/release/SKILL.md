---
name: release
description: Release checklist for this card (pre-release or final). Use when the user asks to release, publish a beta, or bump the version.
---

# Release

Never push, tag or publish without the user's go-ahead for this release.

## Before

1. Decide the version with the user (SemVer). Until 1.0.0 the cards are in the 0.x phase: new option or breaking change → minor, fix → patch. 1.0.0 is released together with the sister card, and from then on breaking change → major.
   - The Comfort Compass Card and the Mollier hx Card go out together: release both when shared code (`npm run check-shared`) or the shared config schema changed.
2. Set it in both places: `package.json` `version` and the `version` constant in `src/mollier-hx-card.js`.
3. Move the `[Unreleased]` entries in `CHANGELOG.md` under the new version with today's date and update the compare links.
4. The `E2E` workflow in mollier-hx-card (both cards in Home Assistant stable and beta) is green for the current `main` of both repos (run it by hand if needed: Actions → E2E → Run workflow, or `npm run e2e` there with Docker).
5. `npm test`, `npm run lint`, `npm run format:check`, `npm run check-shared -- --local ../<sister>` and `npm run build`; check the console banner in `dist/` shows the new version.
6. Run the `visual-check` skill and the `card-reviewer` agent on the changes since the last tag (`git diff <last-tag>`); fix findings first.
7. Check `hacs.json` (`filename` matches the dist file; `homeassistant` minimum still right) and that the README documents every new option.

## Publish

1. Commit (`dist/` is gitignored) and push `main` of **both** cards when shared code changed, then re-run the `shared` CI job of the repo pushed first. Wait for `CI` to be green in both.
2. Create the GitHub release `vX.Y.Z` from `main` as a **full release** (not a pre-release: HACS validation and the Marketplace only look at full releases, and `dist/` is not in the repo). The tag must not exist yet (`git ls-remote --tags origin`). Release notes = the CHANGELOG section.
3. Wait for the workflows: `Validate` (HACS action) and `Release` (attaches `mollier-hx-card.js` to the release) must succeed; `Validate` runs again by itself once `Release` has attached the asset (until the first full release it is red, because there is no `dist/` to fall back on). `Screenshots` may push a `docs: update screenshots` commit.
4. Confirm the release has the `mollier-hx-card.js` asset.

## After

- Update or install the card via HACS / Marketplace in the test instance and hard-reload the browser; the console banner must show the new version.
- 1.0.0 only (together with the sister card): submit to the catalog (fork `hacs/default`, add `retomarek/mollier-hx-card` to the `plugin` file in alphabetical order, PR from the personal account with the template filled in, link to the release and a passing HACS action run without `ignore`).
