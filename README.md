# lookalike

**Live demo: https://striv11.github.io/lookalike/** 

> Find duplicate and near-duplicate photos by dropping a folder into your browser. Nothing is uploaded.

![CI](https://github.com/Striv11/lookalike/actions/workflows/ci.yml/badge.svg)

## Problem
Photo libraries accumulate exact copies, resized exports, re-compressed screenshots and burst shots. Byte-hash tools miss all but exact copies, and online dedupers require uploading private photos.

## Motivation
Everything is built from scratch to explore three ideas: perceptual hashing (aHash, dHash and a DCT-based pHash), metric-space indexing with a BK-tree so range queries avoid an O(n²) scan, and union-find clustering of transitive near-matches. All of it runs client-side, so no data leaves the device.

## Architecture
```
 dropped folder ─► decode (createImageBitmap) ─► canvas ─► RGBA
      RGBA ─► gray ─► box-resize ─► aHash / dHash / pHash (64-bit)
      hashes ─► BK-tree (Hamming) ─► range search ─► union-find ─► groups ─► review UI
```
- `src/core/gray.ts`: RGBA to luminance, area-average resize.
- `src/core/hash.ts`: hashes, Hamming distance, hex serialisation.
- `src/core/bktree.ts`: BK-tree range search.
- `src/core/orient.ts`: the 8 rotations/mirrors of an image and their pHashes.
- `src/core/group.ts`: duplicate grouping (optional rotation/flip matching, exact-duplicate fast path), plus a brute-force reference used in tests.
- `src/ui/`: `files.ts` (folder/drop traversal, image filtering), `model.ts` (outcomes to groups), `review.ts` (best-pick, marks, CSV), `main.ts` (DOM wiring), `style.css` (design tokens, responsive, light/dark via system preference with a manual override).
- `src/pipeline/`: `decode.ts` (createImageBitmap + OffscreenCanvas, downscaled), `process.ts` (decode + hash, never throws in the worker), `scan.ts` (worker pool with progress, abort, crash recovery), `hash.worker.ts` (the web worker).

Invariant: tree-based grouping returns exactly the same groups as the brute-force reference.

## Setup
Requires Node 22+.
```
npm ci
bash check.sh      # format, lint, typecheck, tests
npm run dev        # local dev server
npm run build      # static build in dist/
npm run e2e        # Playwright end-to-end tests (needs: npx playwright install chromium)
```

## Demo
Open the live page, drop a folder of photos (or use the folder picker) and see grouped duplicates with per-file size and dimensions. A similarity slider regroups live, and a checkbox also matches rotated or mirrored copies; the best photo (most pixels, then largest file) in each group is pre-marked Keep and the rest Remove. Click or press Space/K to toggle, R to reset a group, arrows to move, E or the button to export a CSV. Nothing is deleted; the CSV is a list for you to act on.

## Design decisions & trade-offs
- 64-bit hashes held as BigInt: simple and correct; may move to two uint32 if profiling demands.
- Grouping is transitive (union-find), which can chain loosely related images; the UI will show per-pair distance.
- Orientation matching stores the pHash of all 8 orientations per image (7 extra) and probes the tree with each; the tree itself stays a single index. Hamming runs on two 32-bit halves, which made grouping 10k hashes about 10x faster than BigInt popcount.
- Pure TypeScript instead of WASM: hashing a 32x32 thumbnail is cheap, and decoding dominates.

## Roadmap
- [x] Day 1: hashing, BK-tree, grouping, tests
- [x] Day 2: decode pipeline and worker pool
- [x] Day 3: drop zone, folder picker, results grid
- [x] Day 4: similarity slider, keep/remove review, CSV export
- [x] Day 5: orientation-invariant matching, exact-duplicate fast path, 10k benchmark
- [x] Day 6: design tokens, manual theme toggle, loading/error states, Playwright e2e
- [ ] Day 7: see [PLAN.md](PLAN.md)

## License
MIT. See [LICENSE](LICENSE).
