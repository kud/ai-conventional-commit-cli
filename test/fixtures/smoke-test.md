# Fix context overflow on large staged diffs

Prevent `ContextOverflowError` when committing repos with generated or cache files.

## Changes

- Added `.vite/**`, `.nuxt/**`, `.svelte-kit/**`, `.parcel-cache/**`, `.turbo/**`, `.cache/**` to default `skipFilePatterns`
- Added `MAX_DIFF_CHARS` (100 000) budget in `summarizeDiffForPrompt`
- Auto-degrade privacy level `low → medium → high` when diff exceeds budget
- Guard `skipFilePatterns` against `undefined` in `shouldSkipFile`
