import { describe, expect, it } from "vitest";
import { groupDuplicates, groupDuplicatesBrute, type Entry } from "../src/core/group";
import { rng } from "./helpers";

/** Hashes of `n` photos: clusters of near-duplicates (small bit flips) amid random singletons. */
function corpus(n: number, seed: number): Entry[] {
  const r = rng(seed);
  const rand64 = () =>
    (BigInt(Math.floor(r() * 2 ** 32)) << 32n) | BigInt(Math.floor(r() * 2 ** 32));
  const out: Entry[] = [];
  while (out.length < n) {
    const base = rand64();
    const copies = r() < 0.3 ? 2 + Math.floor(r() * 4) : 1;
    for (let c = 0; c < copies && out.length < n; c++) {
      let h = base;
      for (let f = 0; f < (c === 0 ? 0 : Math.floor(r() * 4)); f++)
        h ^= 1n << BigInt(Math.floor(r() * 64));
      out.push({ id: out.length, hash: h });
    }
  }
  return out;
}

describe("performance budget", () => {
  it("groups 10,000 hashes at radius 8 within the time budget", () => {
    const entries = corpus(10_000, 11);
    const t0 = performance.now();
    const groups = groupDuplicates(entries, 8);
    const ms = performance.now() - t0;
    expect(groups.length).toBeGreaterThan(1000);
    // Generous ceiling (typical runs are far below it) so slow CI machines do not flake.
    expect(ms).toBeLessThan(8000);
  });
  it("agrees with the brute-force reference on a 1,500-hash corpus", () => {
    const entries = corpus(1_500, 12);
    expect(groupDuplicates(entries, 8)).toEqual(groupDuplicatesBrute(entries, 8));
  });
});
