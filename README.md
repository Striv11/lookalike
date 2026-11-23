# lookalike

**Live demo: https://striv11.github.io/lookalike/** (placeholder page until Day 3)

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
- `src/core/group.ts`: duplicate grouping, plus a brute-force reference used in tests.
- `src/pipeline/`: `decode.ts` (createImageBitmap + OffscreenCanvas, downscaled), `process.ts` (decode + hash, never throws in the worker), `scan.ts` (worker pool with progress, abort, crash recovery), `hash.worker.ts` (the web worker).

Invariant: tree-based grouping returns exactly the same groups as the brute-force reference.

## Setup
Requires Node 22+.
```
npm ci
bash check.sh      # format, lint, typecheck, tests
npm run dev        # local dev server
npm run build      # static build in dist/
```

## Demo
**Planned.** Open the live page, drop a folder of photos, and review grouped duplicates with a similarity slider. Day 1 ships only the tested core library.

## Design decisions & trade-offs
- 64-bit hashes held as BigInt: simple and correct; may move to two uint32 if profiling demands.
- Grouping is transitive (union-find), which can chain loosely related images; the UI will show per-pair distance.
- Pure TypeScript instead of WASM: hashing a 32x32 thumbnail is cheap, and decoding dominates.

## Roadmap
- [x] Day 1: hashing, BK-tree, grouping, tests
- [x] Day 2: decode pipeline and worker pool
- [ ] Days 3 to 7: see [PLAN.md](PLAN.md)

## License
MIT. See [LICENSE](LICENSE).
