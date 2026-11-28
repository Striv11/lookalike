# Precision / recall evaluation

Measured by `tests/eval.test.ts` (runs in `check.sh`). Corpus: 60 deterministic synthetic
"photos" (gaussian-blob scenes), each with one edited copy per row below. Ground truth: two
files are duplicates iff they derive from the same source. Scores are **pairwise** over
all file pairs. Hash: pHash, 64 bits; "radius" is the max Hamming distance (the slider).

| Edit | r=4 | r=8 | r=12 |
|------|-----|-----|------|
| noise (±6 levels) | P 1.00 / R 0.90 | P 1.00 / R 1.00 | P 1.00 / R 1.00 |
| half-size resize | P 1.00 / R 1.00 | P 1.00 / R 1.00 | P 1.00 / R 1.00 |
| brightness ×1.12 (clips) | P 1.00 / R 0.73 | P 1.00 / R 0.80 | P 1.00 / R 0.90 |
| rotate 90°, orientation off | R 0.00 | R 0.00 | R 0.00 |
| rotate 90°, orientation on | P 1.00 / R 1.00 | P 1.00 / R 1.00 | P 0.71 / R 1.00 |
| mirror, orientation on | P 1.00 / R 1.00 | P 1.00 / R 1.00 | P 0.75 / R 1.00 |

(P = precision, R = recall; orientation-on rows with edits other than rotate/mirror are
identical to off except at r=12, where precision drops to ~0.77–0.79.)

## Findings
- Radius 8 (the default) is the sweet spot on this corpus: no false merges, full recall for
  noise, resizing and orientation changes.
- Radius 12 starts merging unrelated images, and with orientation matching on it hurts
  more, because each image is probed with 8 variants, so there are 8x more chances of an
  accidental near-match. Keep the slider at or below ~10 when orientation matching is on.
- Brightness edits that clip highlights are the weak spot (recall 0.80 at r=8): clipping
  changes the DCT low frequencies. Raising the radius helps recall at a precision cost.

## Caveats
Synthetic smooth scenes are easier than real photos and have no true near-duplicate
non-matches (e.g. burst shots of the same scene, which are *meant* to group). Treat the
numbers as a regression guard and a guide to radius behaviour, not as a benchmark.

To reprint the per-edit numbers: `EVAL_PRINT=1 npx vitest run tests/eval.test.ts`.
