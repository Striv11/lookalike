import type { Gray } from "../src/core/gray";

/** Deterministic PRNG (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A smooth synthetic "photo": a few random gaussian blobs. */
export function synthImage(seed: number, w = 128, h = 96): Gray {
  const r = rng(seed);
  const blobs = Array.from({ length: 6 }, () => ({
    x: r() * w,
    y: r() * h,
    s: 8 + r() * 25,
    a: (r() - 0.5) * 220,
  }));
  const data = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 128;
      for (const b of blobs)
        v += b.a * Math.exp(-((x - b.x) ** 2 + (y - b.y) ** 2) / (2 * b.s ** 2));
      data[y * w + x] = Math.max(0, Math.min(255, v));
    }
  }
  return { width: w, height: h, data };
}

export function addNoise(img: Gray, amp: number, seed: number): Gray {
  const r = rng(seed);
  return { ...img, data: img.data.map((v) => Math.max(0, Math.min(255, v + (r() - 0.5) * amp))) };
}

export function brighten(img: Gray, k: number): Gray {
  return { ...img, data: img.data.map((v) => Math.min(255, v * k)) };
}
