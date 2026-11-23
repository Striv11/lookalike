import { describe, expect, it } from "vitest";
import { BKTree } from "../src/core/bktree";
import { groupDuplicates, groupDuplicatesBrute } from "../src/core/group";
import { hamming } from "../src/core/hash";
import { rng } from "./helpers";

function randHash(r: () => number): bigint {
  return (BigInt(Math.floor(r() * 2 ** 32)) << 32n) | BigInt(Math.floor(r() * 2 ** 32));
}
function flip(h: bigint, bits: number, r: () => number): bigint {
  for (let i = 0; i < bits; i++) h ^= 1n << BigInt(Math.floor(r() * 64));
  return h;
}

describe("BKTree", () => {
  it("returns exactly the brute-force range result", () => {
    const r = rng(42);
    const hashes = Array.from({ length: 400 }, () => randHash(r));
    const t = new BKTree<number>();
    hashes.forEach((h, i) => t.insert(h, i));
    for (const radius of [0, 4, 12, 28]) {
      const q = flip(hashes[7]!, 3, r);
      const got = t
        .search(q, radius)
        .map((m) => m.item)
        .sort((a, b) => a - b);
      const want = hashes.flatMap((h, i) => (hamming(h, q) <= radius ? [i] : []));
      expect(got).toEqual(want);
    }
  });
  it("stores exact duplicates together and handles an empty tree", () => {
    const t = new BKTree<string>();
    expect(t.search(0n, 5)).toEqual([]);
    t.insert(5n, "a");
    t.insert(5n, "b");
    expect(t.search(5n, 0).map((m) => m.item)).toEqual(["a", "b"]);
    expect(t.size).toBe(2);
  });
});

describe("groupDuplicates", () => {
  it("matches the brute-force grouping on clustered data", () => {
    const r = rng(9);
    const entries: { id: number; hash: bigint }[] = [];
    let id = 0;
    for (let c = 0; c < 30; c++) {
      const centre = randHash(r);
      const n = 1 + Math.floor(r() * 4);
      for (let k = 0; k < n; k++)
        entries.push({ id: id++, hash: flip(centre, k === 0 ? 0 : 2, r) });
    }
    expect(groupDuplicates(entries, 6)).toEqual(groupDuplicatesBrute(entries, 6));
    expect(groupDuplicates(entries, 6).length).toBeGreaterThan(5);
  });
  it("chains transitively and omits singletons", () => {
    const e = [
      { id: 1, hash: 0n },
      { id: 2, hash: 0b111n },
      { id: 3, hash: 0b111111n },
      { id: 4, hash: (1n << 64n) - 1n },
    ];
    expect(groupDuplicates(e, 3)).toEqual([[1, 2, 3]]);
  });
});
