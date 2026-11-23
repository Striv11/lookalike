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
