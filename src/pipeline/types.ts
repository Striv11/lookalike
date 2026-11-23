import type { Hash64 } from "../core/hash";

/** Decoded pixels, possibly downscaled; `width`/`height` describe the RGBA buffer. */
export interface Decoded {
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
  /** Dimensions of the original image before downscaling. */
  originalWidth: number;
  originalHeight: number;
}

/** Turns an image file into RGBA pixels. Rejects when the file is not a decodable image. */
export type Decoder = (file: Blob) => Promise<Decoded>;

export interface HashedImage {
  aHash: Hash64;
  dHash: Hash64;
  pHash: Hash64;
  width: number;
  height: number;
  bytes: number;
}

export interface WorkerRequest {
  id: number;
  file: Blob;
}

export type WorkerResponse =
  { id: number; ok: true; result: HashedImage } | { id: number; ok: false; error: string };

export type ScanOutcome =
  | { index: number; name: string; ok: true; result: HashedImage }
  | { index: number; name: string; ok: false; error: string };

export interface Progress {
  done: number;
  total: number;
  failed: number;
}
