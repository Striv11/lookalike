import { describe, expect, it } from "vitest";
import { resizeGray, rgbaToGray } from "../src/core/gray";
import { aHash, dHash, fromHex, hamming, pHash, toHex } from "../src/core/hash";
import { addNoise, brighten, synthImage } from "./helpers";

describe("gray", () => {
  it("converts RGBA and composites alpha over white", () => {
    const g = rgbaToGray([255, 0, 0, 255, 0, 0, 0, 0], 2, 1);
    expect(g.data[0]).toBeCloseTo(76.245, 2);
    expect(g.data[1]).toBe(255);
  });
  it("rejects wrong buffer sizes", () => {
    expect(() => rgbaToGray([0, 0, 0], 1, 1)).toThrow(RangeError);
  });
  it("box resize preserves the mean of a constant image and averages blocks", () => {
    const g = { width: 4, height: 2, data: Float32Array.from([0, 0, 100, 100, 0, 0, 100, 100]) };
    expect(Array.from(resizeGray(g, 2, 1).data)).toEqual([0, 100]);
    expect(Array.from(resizeGray(g, 1, 1).data)).toEqual([50]);
  });
});

describe("hamming / hex", () => {
  it("counts differing bits", () => {
    expect(hamming(0n, 0n)).toBe(0);
    expect(hamming(0xffffffffffffffffn, 0n)).toBe(64);
    expect(hamming(0b1010n, 0b0110n)).toBe(2);
  });
  it("round-trips hex", () => {
    expect(fromHex(toHex(0xdeadbeefn))).toBe(0xdeadbeefn);
    expect(toHex(1n)).toHaveLength(16);
    expect(() => fromHex("xyz")).toThrow();
  });
});

describe.each([
  ["aHash", aHash],
  ["dHash", dHash],
  ["pHash", pHash],
])("%s", (_name, fn) => {
  const base = synthImage(1);
  it("is deterministic", () => expect(fn(base)).toBe(fn(base)));
  it("is robust to noise, brightness and rescaling", () => {
    const h = fn(base);
    expect(hamming(h, fn(addNoise(base, 12, 5)))).toBeLessThanOrEqual(6);
    expect(hamming(h, fn(brighten(base, 1.1)))).toBeLessThanOrEqual(10);
    expect(hamming(h, fn(resizeGray(base, 64, 48)))).toBeLessThanOrEqual(6);
  });
  it("separates unrelated images", () => {
    const dists = [2, 3, 4, 5, 6].map((s) => hamming(fn(base), fn(synthImage(s))));
    expect(dists.filter((d) => d > 10).length).toBeGreaterThanOrEqual(4);
  });
});
