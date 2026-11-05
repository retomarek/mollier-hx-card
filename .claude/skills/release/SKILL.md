---
name: release
description: Release checklist for this card (pre-release or final). Use when the user asks to release, publish a beta, or bump the version.
---

# Release

Never push, tag or publish without the user's go-ahead for this release.

## Before

1. Decide the version with the user (SemVer; betas as `X.Y.Z-beta.N`). Breaking config change → major, new option → minor, fix → patch.
2. Set it in both places: `package.json` `version` and the `version` constant in `src/mollier-hx-card.js`.
3. Move the `[Unreleased]` entries in `CHANGELOG.md` under the new version with today's date and update the compare links.
4. `npm run build` and check the console banner in `dist/` shows the new version.
5. Run the `visual-check` skill and the `card-reviewer` agent on the changes since the last tag (`git diff <last-tag>`); fix findings first.
6. Check `hacs.json` (`filename` matches the dist file; `homeassistant` minimum still right) and that the README documents every new option.

## Publish

1. Commit (including `dist/` and `docs/` changes), push `main`.
2. Create the GitHub release `vX.Y.Z` from `main`; mark betas as pre-release. Release notes = the CHANGELOG section.
3. Wait for the workflows: `Validate` (HACS action) and `Release` (attaches `mollier-hx-card.js` to the release) must succeed; `Screenshots` may push a `docs: update screenshots` commit.
4. Confirm the release has the `mollier-hx-card.js` asset.

## After

- Update or install the card via HACS / Marketplace in the test instance and hard-reload the browser; the console banner must show the new version.
- First final release only: submit to the catalog (fork `hacs/default`, add `retomarek/mollier-hx-card` to the `plugin` file in alphabetical order, PR from the personal account with the template filled in, link to the release and a passing HACS action run without `ignore`).
