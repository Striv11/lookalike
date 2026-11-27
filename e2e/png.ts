import { deflateSync } from "node:zlib";

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** Encode an 8-bit grayscale PNG; `f` maps normalised (u, v) in [0,1) to 0..255. */
export function grayPng(w: number, h: number, f: (u: number, v: number) => number): Buffer {
  const raw = Buffer.alloc((w + 1) * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      raw[y * (w + 1) + 1 + x] = Math.max(0, Math.min(255, Math.round(f(x / w, y / h))));
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // grayscale
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Two clearly different scenes. Same scene at different sizes is a resized duplicate. */
export const sceneA = (u: number, v: number) =>
  (Math.floor(u * 4) + Math.floor(v * 4)) % 2 ? 40 + 180 * u : 220 - 150 * v;
export const sceneB = (u: number, v: number) => {
  const d = Math.hypot(u - 0.5, v - 0.5);
  return Math.floor(d * 8) % 2 ? 30 : 230;
};
