# Work log

Newest entries at the bottom. Each entry records what actually changed, what was learned, and what comes next.

## 2026-11-23 (Day 1)
- Chose a duplicate photo finder (TypeScript, client-side): new domain and a different language profile from the recent predictive-coding, meal-planner and chord projects.
- Scaffolded Vite + TypeScript + Vitest + ESLint + Prettier; `check.sh` runs format, lint, tsc and tests; CI and Pages workflows added.
- Implemented grayscale conversion and box resize, aHash/dHash/pHash, Hamming distance, a BK-tree and union-find grouping, with a brute-force oracle in tests.
- Learned: brightening that clips pixels shifts pHash by around 10 bits, so thresholds in tests must allow for saturation.
- Next: image decoding pipeline with worker pool (Day 2).

## 2026-11-23 (Day 2)
- Added `src/pipeline`: injectable `Decoder` (browser impl uses createImageBitmap + OffscreenCanvas, downscaled to 256px), `hashFile`/`handleRequest`, a web worker, and `scanFiles`, a worker pool with a concurrency cap, ordered outcomes, progress callback, AbortSignal support and replacement of crashed workers.
- Undecodable files become failed outcomes; the scan continues.
- Tests use an in-process fake worker and fake decoder (9 tests: ordering, progress, concurrency limit, crash recovery, abort, empty input).
- Learned: Uint8ClampedArray rounds on store, so equality tests against float pixels must round first. Real browser decoding is not covered by unit tests; the Day 6 e2e will exercise it.
- Next: Day 3 UI: drop zone, folder picker, results grid, Pages deploy.

## 2026-11-24 (Day 3)
- Added `src/ui`: drop zone with recursive folder traversal (batched `readEntries`), folder and file pickers, progress bar with cancel, results grid of duplicate groups with thumbnails (object URLs, revoked on reset), failure list, empty states. Grid uses `auto-fill` columns so it fits 375px; light/dark follows system preference.
- Logic that can be tested without a DOM lives in `files.ts` and `model.ts` (7 new tests: traversal with in-memory entry trees, unreadable entries, grouping and radius, formatting). `main.ts` is thin DOM wiring and is not unit tested; Day 6 e2e will cover it. I did not verify the page in a real browser today, only that `vite build` succeeds.
- Learned: `webkitGetAsEntry` must be called synchronously in the drop handler, and `readEntries` returns batches so it must be looped until empty.
- Next: Day 4 review workflow: similarity slider that regroups live, best-pick heuristic, keep/remove marking, keyboard shortcuts, CSV export.
