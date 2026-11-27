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

## 2026-11-25 (Day 4)
- Added `src/ui/review.ts`: best-pick heuristic (pixels, then bytes, then earliest), keep/remove marks stored as sparse manual overrides on top of the heuristic, removal count, and CSV export. CSV cells are quoted and prefixed with `'` when a filename starts with a formula character.
- Wired the UI: similarity slider (0 to 16 bits) regroups live from the stored outcomes without rehashing; click/Space/K toggles, R resets a group, arrows move focus, E exports. Overrides are keyed by file index so they survive regrouping.
- 5 new tests in `tests/review.test.ts` (39 total). Learned: vitest only includes `tests/**`, so a test placed next to the source was silently not run. As before, `main.ts` is not unit tested and I did not check it in a real browser; `vite build` succeeds. Day 6 e2e covers it.
- Next: Day 5: rotation/flip-invariant matching, exact-duplicate fast path, 10k-hash benchmark with a budget in check.sh.

## 2026-11-26 (Day 5)
- Added `src/core/orient.ts` (8 dihedral orientations, `pHashVariants`); the worker now returns the 7 extra pHashes, and `groupDuplicates(entries, radius, { orientation })` probes the BK-tree with each variant. UI has a "Match rotated or flipped copies" checkbox that regroups live.
- Exact-duplicate fast path: entries with the same `exactKey` (bytes + dimensions) and hash are unioned directly and skip the tree.
- Performance: the first 10k benchmark took 23 s because BigInt popcount allocates. Hamming now works on two 32-bit number halves (`split`/`hammingSplit`, precomputed in tree nodes): 10k hashes group in ~1.5 s including corpus generation. `tests/bench.test.ts` enforces an 8 s ceiling (run by check.sh) and checks tree == brute force on 1,500 hashes.
- Learned: a tiny synthetic image can clip to all zeros, making orientation tests vacuous, so test images need adequate size. Random variants are not closed under inversion, so the brute-force oracle must probe in the same direction as the tree; real variant sets are symmetric.
- Next: Day 6 design system (themes, type scale, loading/error states) and Playwright e2e, which should also finally exercise real browser decoding and the new checkbox.

## 2026-11-27 (Day 6)
- Design system: CSS tokens for colour, type scale, spacing and radius; dark theme now also reachable via a system/light/dark toggle (`data-theme`, remembered in localStorage); spinner in the loading state, `role="alert"` on scan errors, reduced-motion respected.
- Playwright e2e (`e2e/app.spec.ts`, `npm run e2e`, run in a separate CI job, not in check.sh to keep it browser-free): PNGs are generated in-test with a tiny encoder (`e2e/png.ts`). Covers empty state and no overflow at 375px and 1280px, grouping a resized duplicate, unreadable-file reporting, click/keyboard marking and reset, CSV download, theme toggle. 10 runs (5 tests x 2 viewports) pass against the production build.
- Learned: this is the first time real browser decoding, the worker and the UI were exercised; they worked unchanged. The orientation checkbox is not yet covered by e2e.
- Next: Day 7 polish: screenshots, accessibility pass, precision/recall evaluation, e2e for the rotation checkbox.
