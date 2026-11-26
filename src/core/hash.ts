import { type Gray, resizeGray } from "./gray";

/** 64-bit perceptual hashes are held as unsigned BigInts. */
export type Hash64 = bigint;

const MASK = (1n << 64n) - 1n;

function pack(bits: boolean[]): Hash64 {
  let h = 0n;
  for (const b of bits) h = ((h << 1n) | (b ? 1n : 0n)) & MASK;
  return h;
}

/** Average hash: 8x8 thumbnail, bit set where pixel >= mean. */
export function aHash(img: Gray): Hash64 {
  const t = resizeGray(img, 8, 8).data;
  const mean = t.reduce((s, v) => s + v, 0) / t.length;
  return pack(Array.from(t, (v) => v >= mean));
}

/** Difference hash: 9x8 thumbnail, bit set where a pixel is brighter than its right neighbour. */
export function dHash(img: Gray): Hash64 {
  const t = resizeGray(img, 9, 8).data;
  const bits: boolean[] = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      bits.push((t[y * 9 + x] ?? 0) > (t[y * 9 + x + 1] ?? 0));
    }
  }
  return pack(bits);
}

const N = 32;
const COS: Float64Array = (() => {
  const c = new Float64Array(8 * N);
  for (let k = 0; k < 8; k++) {
    for (let n = 0; n < N; n++) c[k * N + n] = Math.cos(((2 * n + 1) * k * Math.PI) / (2 * N));
  }
  return c;
})();

/** Low-frequency 8x8 block of the 2-D DCT-II of a 32x32 thumbnail (row-major, 64 values). */
export function dctLowFreq(img: Gray): Float64Array {
  const t = resizeGray(img, N, N).data;
  // rows: tmp[y][u] = sum_x t[y][x] * cos(u)
  const tmp = new Float64Array(N * 8);
  for (let y = 0; y < N; y++) {
    for (let u = 0; u < 8; u++) {
      let s = 0;
      for (let x = 0; x < N; x++) s += (t[y * N + x] ?? 0) * (COS[u * N + x] ?? 0);
      tmp[y * 8 + u] = s;
    }
  }
  const out = new Float64Array(64);
  for (let v = 0; v < 8; v++) {
    for (let u = 0; u < 8; u++) {
      let s = 0;
      for (let y = 0; y < N; y++) s += (tmp[y * 8 + u] ?? 0) * (COS[v * N + y] ?? 0);
      out[v * 8 + u] = s;
    }
  }
  return out;
}

/** pHash: DCT low-frequency block, thresholded at the median of the AC coefficients. */
export function pHash(img: Gray): Hash64 {
  const d = dctLowFreq(img);
  const sorted = Array.from(d.subarray(1)).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  return pack(Array.from(d, (v) => v > median));
}

function popcount32(x: number): number {
  x -= (x >>> 1) & 0x55555555;
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  x = (x + (x >>> 4)) & 0x0f0f0f0f;
  return Math.imul(x, 0x01010101) >>> 24;
}

/** Split a hash into its high and low 32-bit halves as plain numbers (fast to compare). */
export function split(h: Hash64): [number, number] {
  return [Number(h >> 32n) | 0, Number(h & 0xffffffffn) | 0];
}

/** Hamming distance between two hashes already split with `split`. */
export function hammingSplit(ah: number, al: number, bh: number, bl: number): number {
  return popcount32(ah ^ bh) + popcount32(al ^ bl);
}

export function hamming(a: Hash64, b: Hash64): number {
  const [ah, al] = split(a);
  const [bh, bl] = split(b);
  return hammingSplit(ah, al, bh, bl);
}

export function toHex(h: Hash64): string {
  return h.toString(16).padStart(16, "0");
}

export function fromHex(s: string): Hash64 {
  if (!/^[0-9a-f]{1,16}$/i.test(s)) throw new RangeError(`invalid hash: ${s}`);
  return BigInt("0x" + s);
}
