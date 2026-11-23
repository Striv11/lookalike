import type { Decoded, Decoder } from "./types";

/**
 * Browser decoder: createImageBitmap + canvas, downscaled so the longest side is at most
 * `maxDim`. Hashing only needs a 32x32 thumbnail, so this bounds memory for huge photos.
 */
export function createBrowserDecoder(maxDim = 256): Decoder {
  return async (file: Blob): Promise<Decoded> => {
    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(file);
    } catch {
      throw new Error("not a decodable image");
    }
    try {
      const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("2d canvas unavailable");
      ctx.drawImage(bitmap, 0, 0, width, height);
      const { data } = ctx.getImageData(0, 0, width, height);
      return {
        width,
        height,
        rgba: data,
        originalWidth: bitmap.width,
        originalHeight: bitmap.height,
      };
    } finally {
      bitmap.close();
    }
  };
}
