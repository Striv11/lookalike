import { describe, expect, it } from "vitest";
import { type Gray } from "../src/core/gray";
import { groupDuplicates, groupDuplicatesBrute, type Entry } from "../src/core/group";
import { hamming, pHash, type Hash64 } from "../src/core/hash";
import { orientations, pHashVariants } from "../src/core/orient";
import { addNoise, rng, synthImage } from "./helpers";

const rot90cw = (g: Gray): Gray => orientations(g)[1]!;

describe("orientations", () => {
  it("rotating four times is the identity and swaps dimensions on odd turns", () => {
    const g = synthImage(1, 20, 12);
    const r = rot90cw(g);
    expect([r.width, r.height]).toEqual([12, 20]);
    const back = rot90cw(rot90cw(rot90cw(r)));
    expect(Array.from(back.data)).toEqual(Array.from(g.data));
  });
  it("moves a marked pixel to the expected place under clockwise rotation", () => {
    const data = new Float32Array(6); // 3x2, mark top-left
    data[0] = 9;
    const r = rot90cw({ width: 3, height: 2, data });
    expect(r.data[1]).toBe(9); // top-left goes to top-right of a 2x3 image
  });
  it("yields 8 distinct orientations of an asymmetric image", () => {
    const o = orientations(synthImage(2, 48, 40));
    expect(new Set(o.map((g) => Array.from(g.data).join(","))).size).toBe(8);
  });
});

describe("pHash orientation invariance", () => {
  it("a rotated or mirrored noisy copy is near one of the original's variants", () => {
    for (let seed = 1; seed <= 6; seed++) {
      const g = synthImage(seed);
      const variants = pHashVariants(g);
      expect(variants[0]).toBe(pHash(g));
      for (let k = 1; k < 8; k++) {
        const copy = addNoise(orientations(g)[k]!, 6, seed * 10 + k);
        const best = Math.min(...variants.map((v) => hamming(v, pHash(copy))));
        expect(best).toBeLessThanOrEqual(8);
      }
    }
  });
  it("unrelated images stay far from all variants", () => {
    const a = pHashVariants(synthImage(100));
    const b = pHash(synthImage(200));
    expect(Math.min(...a.map((v) => hamming(v, b)))).toBeGreaterThan(8);
  });
});

describe("grouping with orientation", () => {
  const entryOf = (id: number, g: Gray): Entry => ({
    id,
    hash: pHash(g),
    variants: pHashVariants(g).slice(1),
  });
  it("groups a rotated copy only when orientation matching is on", () => {
    const g = synthImage(7);
    const entries = [entryOf(0, g), entryOf(1, orientations(g)[3]!), entryOf(2, synthImage(8))];
    expect(groupDuplicates(entries, 6)).toEqual([]);
    expect(groupDuplicates(entries, 6, { orientation: true })).toEqual([[0, 1]]);
  });
  it("tree grouping equals brute force on random hashes with variants", () => {
    const r = rng(5);
    const rand64 = (): Hash64 =>
      (BigInt(Math.floor(r() * 2 ** 32)) << 32n) | BigInt(Math.floor(r() * 2 ** 32));
    const entries: Entry[] = Array.from({ length: 150 }, (_, id) => ({
      id,
      hash: rand64(),
      variants: Array.from({ length: 7 }, rand64),
    }));
    // Random variants are not closed under inversion, so the match is directional; both
    // implementations probe with the later entry's variants against earlier hashes.
    for (const radius of [20, 26, 28]) {
      const opts = { orientation: true };
      expect(groupDuplicates(entries, radius, opts)).toEqual(
        groupDuplicatesBrute(entries, radius, opts),
      );
    }
  });
});

describe("exact duplicate fast path", () => {
  it("groups identical key+hash entries and matches the brute-force result", () => {
    const r = rng(3);
    const hashes = Array.from({ length: 40 }, () => BigInt(Math.floor(r() * 2 ** 32)) * 2n ** 20n);
    const entries: Entry[] = Array.from({ length: 200 }, (_, id) => {
      const k = Math.floor(r() * 40);
      return { id, hash: hashes[k]!, exactKey: `size${k % 7}` };
    });
    for (const radius of [0, 3, 12]) {
      expect(groupDuplicates(entries, radius)).toEqual(groupDuplicatesBrute(entries, radius));
    }
  });
});
