# Work log

Newest entries at the bottom. Each entry records what actually changed, what was learned, and what comes next.

## 2026-11-23 (Day 1)
- Chose a duplicate photo finder (TypeScript, client-side): new domain and a different language profile from the recent predictive-coding, meal-planner and chord projects.
- Scaffolded Vite + TypeScript + Vitest + ESLint + Prettier; `check.sh` runs format, lint, tsc and tests; CI and Pages workflows added.
- Implemented grayscale conversion and box resize, aHash/dHash/pHash, Hamming distance, a BK-tree and union-find grouping, with a brute-force oracle in tests.
- Learned: brightening that clips pixels shifts pHash by around 10 bits, so thresholds in tests must allow for saturation.
- Next: image decoding pipeline with worker pool (Day 2).
