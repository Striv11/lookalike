/** A grayscale image with float luminance values in 0..255, row-major. */
export interface Gray {
  width: number;
  height: number;
  data: Float32Array;
}

/** Convert RGBA bytes (as from canvas ImageData) to luminance, compositing alpha over white. */
export function rgbaToGray(rgba: ArrayLike<number>, width: number, height: number): Gray {
  if (rgba.length !== width * height * 4) {
    throw new RangeError(`expected ${width * height * 4} RGBA bytes, got ${rgba.length}`);
  }
  const data = new Float32Array(width * height);
  for (let i = 0; i < data.length; i++) {
    const a = (rgba[i * 4 + 3] ?? 255) / 255;
    const y =
      0.299 * (rgba[i * 4] ?? 0) + 0.587 * (rgba[i * 4 + 1] ?? 0) + 0.114 * (rgba[i * 4 + 2] ?? 0);
    data[i] = y * a + 255 * (1 - a);
  }
  return { width, height, data };
}

/** Area-average (box filter) resize. Works for both down- and up-scaling. */
export function resizeGray(src: Gray, w: number, h: number): Gray {
  if (w < 1 || h < 1) throw new RangeError("target size must be positive");
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = (y * src.height) / h;
    const y1 = ((y + 1) * src.height) / h;
    for (let x = 0; x < w; x++) {
      const x0 = (x * src.width) / w;
      const x1 = ((x + 1) * src.width) / w;
      let sum = 0;
      let weight = 0;
      for (let sy = Math.floor(y0); sy < Math.min(src.height, Math.ceil(y1)); sy++) {
        const wy = Math.min(sy + 1, y1) - Math.max(sy, y0);
        for (let sx = Math.floor(x0); sx < Math.min(src.width, Math.ceil(x1)); sx++) {
          const wx = Math.min(sx + 1, x1) - Math.max(sx, x0);
          const wgt = wx * wy;
          sum += (src.data[sy * src.width + sx] ?? 0) * wgt;
          weight += wgt;
        }
      }
      out[y * w + x] = weight > 0 ? sum / weight : 0;
    }
  }
  return { width: w, height: h, data: out };
}
