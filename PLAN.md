# Plan

Seven-day arc. Every milestone has acceptance criteria that can be checked by a test or a command.

| Day | Milestone | Acceptance criteria | Status |
|-----|-----------|---------------------|--------|
| 1 | Scaffold and core algorithms | `bash check.sh` passes; aHash/dHash/pHash robust to noise, brightness and resize in tests; BK-tree results equal brute force; grouping tested | [x] |
| 2 | Image pipeline | Decode File to RGBA via createImageBitmap with downscale; worker pool hashing; progress callback; unit tests with fake decoder; handles undecodable files without aborting | [x] |
| 3 | UI and Pages | Drop zone and folder picker; empty state; results grid of groups; deployed Pages page; responsive at 375px | [ ] |
| 4 | Review workflow | Similarity slider regroups live; keep/remove marking with best-pick heuristic (resolution, size); keyboard shortcuts; export list as CSV | [ ] |
| 5 | Quality and robustness | Rotation/flip-invariant matching option; exact-dup fast path by size+hash; benchmark: 10k hashes grouped under a budget enforced in check.sh | [ ] |
| 6 | Design system and e2e | Light/dark themes, type scale, loading and error states; Playwright e2e for drop, group, mark flows | [ ] |
| 7 | Polish | Screenshots in README, landing section, accessibility pass, precision/recall evaluation documented | [ ] |

## Stretch
- Persist hash cache in IndexedDB so re-scans are instant.
- Optional WASM hashing kernel.
