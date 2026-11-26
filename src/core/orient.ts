import { type Gray } from "./gray";
import { type Hash64, pHash } from "./hash";

/**
 * The 8 dihedral transforms (4 rotations x optional mirror), index 0 is the identity.
 * Bit 0..1 of the index: number of 90-degree clockwise rotations; bit 2: horizontal mirror first.
 */
export const ORIENTATIONS = 8;

function rotate90(g: Gray): Gray {
  const { width: w, height: h } = g;
  const data = new Float32Array(w * h);
  // clockwise: new (x', y') = (h - 1 - y, x), new width = h
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) data[x * h + (h - 1 - y)] = g.data[y * w + x] ?? 0;
  }
  return { width: h, height: w, data };
}

function mirror(g: Gray): Gray {
  const { width: w, height: h } = g;
  const data = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) data[y * w + (w - 1 - x)] = g.data[y * w + x] ?? 0;
  }
  return { width: w, height: h, data };
}

/** All 8 orientations of an image, in the index order documented on ORIENTATIONS. */
export function orientations(g: Gray): Gray[] {
  const out: Gray[] = [];
  for (const base of [g, mirror(g)]) {
    let cur = base;
    for (let r = 0; r < 4; r++) {
      out.push(cur);
      cur = rotate90(cur);
    }
  }
  return out;
}

/** pHash of every orientation; element 0 is the plain pHash. */
export function pHashVariants(g: Gray): Hash64[] {
  return orientations(g).map(pHash);
}
