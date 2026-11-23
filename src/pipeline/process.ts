import { rgbaToGray } from "../core/gray";
import { aHash, dHash, pHash } from "../core/hash";
import type { Decoder, HashedImage, WorkerRequest, WorkerResponse } from "./types";

/** Decode one file and compute all three hashes. Pure given the decoder. */
export async function hashFile(file: Blob, decode: Decoder): Promise<HashedImage> {
  const d = await decode(file);
  const gray = rgbaToGray(d.rgba, d.width, d.height);
  return {
    aHash: aHash(gray),
    dHash: dHash(gray),
    pHash: pHash(gray),
    width: d.originalWidth,
    height: d.originalHeight,
    bytes: file.size,
  };
}

/** Worker message handler; never throws, so one bad file cannot kill a worker. */
export async function handleRequest(req: WorkerRequest, decode: Decoder): Promise<WorkerResponse> {
  try {
    return { id: req.id, ok: true, result: await hashFile(req.file, decode) };
  } catch (e) {
    return { id: req.id, ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
