import { describe, expect, it } from "vitest";
import { aHash, dHash, pHash } from "../src/core/hash";
import { handleRequest, hashFile } from "../src/pipeline/process";
import { type WorkerLike, scanFiles } from "../src/pipeline/scan";
import type { Decoded, Decoder, Progress, WorkerRequest } from "../src/pipeline/types";
import { synthImage } from "./helpers";

/** Fake decoder: the blob's text is "seed" or "bad"; renders a synthetic image as RGBA. */
const fakeDecoder: Decoder = async (file) => {
  const text = await file.text();
  if (text === "bad") throw new Error("not a decodable image");
  const g = synthImage(Number(text), 64, 48);
  const rgba = new Uint8ClampedArray(g.width * g.height * 4);
  g.data.forEach((v, i) => rgba.set([v, v, v, 255], i * 4));
  const d: Decoded = {
    width: g.width,
    height: g.height,
    rgba,
    originalWidth: 4000,
    originalHeight: 3000,
  };
  return d;
};

const file = (text: string, name = `${text}.jpg`) => new File([text], name);

/** In-process worker; `crashOn` makes it emit an error event instead of replying. */
function fakeFactory(
  opts: { crashOn?: string; created?: { n: number; active: number; max: number } } = {},
) {
  const stats = opts.created ?? { n: 0, active: 0, max: 0 };
  return () => {
    stats.n++;
    const w: WorkerLike = {
      onmessage: null,
      onerror: null,
      terminate() {},
      postMessage(req: WorkerRequest) {
        stats.active++;
        stats.max = Math.max(stats.max, stats.active);
        void (async () => {
          if ((await req.file.text()) === opts.crashOn) {
            stats.active--;
            setTimeout(() => w.onerror?.({ message: "boom" }), 0);
            return;
          }
          const res = await handleRequest(req, fakeDecoder);
          await new Promise((r) => setTimeout(r, 1));
          stats.active--;
          w.onmessage?.({ data: res });
        })();
      },
    };
    return w;
  };
}

describe("hashFile", () => {
  it("matches hashing the same pixels directly and reports original size", async () => {
    const r = await hashFile(file("7"), fakeDecoder);
    const g = synthImage(7, 64, 48);
    // the fake decoder stores luminance as bytes, so compare against the rounded pixels
    g.data = g.data.map((v) => Math.round(v));
    expect(r.aHash).toBe(aHash(g));
    expect(r.dHash).toBe(dHash(g));
    expect(r.pHash).toBe(pHash(g));
    expect([r.width, r.height, r.bytes]).toEqual([4000, 3000, 1]);
  });

  it("handleRequest turns decode failures into error responses", async () => {
    const res = await handleRequest({ id: 3, file: file("bad") }, fakeDecoder);
    expect(res).toEqual({ id: 3, ok: false, error: "not a decodable image" });
  });
});

describe("scanFiles", () => {
  it("returns outcomes in input order and survives undecodable files", async () => {
    const files = [file("1"), file("bad", "notes.txt"), file("2"), file("3")];
    const out = await scanFiles(files, { createWorker: fakeFactory(), concurrency: 2 });
    expect(out.map((o) => o.name)).toEqual(["1.jpg", "notes.txt", "2.jpg", "3.jpg"]);
    expect(out.map((o) => o.ok)).toEqual([true, false, true, true]);
    const bad = out[1]!;
    expect(!bad.ok && bad.error).toBe("not a decodable image");
  });

  it("reports monotonic progress ending at total, counting failures", async () => {
    const seen: Progress[] = [];
    await scanFiles([file("1"), file("bad"), file("2")], {
      createWorker: fakeFactory(),
      concurrency: 2,
      onProgress: (p) => seen.push(p),
    });
    expect(seen.map((p) => p.done)).toEqual([1, 2, 3]);
    expect(seen.at(-1)).toEqual({ done: 3, total: 3, failed: 1 });
  });

  it("never exceeds the concurrency limit and uses no more workers than files", async () => {
    const stats = { n: 0, active: 0, max: 0 };
    const files = Array.from({ length: 10 }, (_, i) => file(String(i)));
    await scanFiles(files, { createWorker: fakeFactory({ created: stats }), concurrency: 3 });
    expect(stats.max).toBeLessThanOrEqual(3);
    expect(stats.max).toBeGreaterThan(1);
    expect(stats.n).toBe(3);

    const few = { n: 0, active: 0, max: 0 };
    await scanFiles([file("1")], { createWorker: fakeFactory({ created: few }), concurrency: 8 });
    expect(few.n).toBe(1);
  });

  it("marks a crashed job failed, replaces the worker and finishes the rest", async () => {
    const stats = { n: 0, active: 0, max: 0 };
    const files = [file("1"), file("crash"), file("2"), file("3")];
    const out = await scanFiles(files, {
      createWorker: fakeFactory({ crashOn: "crash", created: stats }),
      concurrency: 1,
    });
    expect(out.map((o) => o.ok)).toEqual([true, false, true, true]);
    const crashed = out[1]!;
    expect(!crashed.ok && crashed.error).toBe("boom");
    expect(stats.n).toBe(2);
  });

  it("resolves an empty scan immediately", async () => {
    expect(await scanFiles([], { createWorker: fakeFactory() })).toEqual([]);
  });

  it("rejects with AbortError and terminates workers when aborted", async () => {
    const ctl = new AbortController();
    let terminated = 0;
    const factory = () => {
      const w = fakeFactory()();
      const t = w.terminate;
      w.terminate = () => {
        terminated++;
        t();
      };
      return w;
    };
    const p = scanFiles([file("1"), file("2"), file("3")], {
      createWorker: factory,
      concurrency: 2,
      signal: ctl.signal,
    });
    ctl.abort();
    await expect(p).rejects.toMatchObject({ name: "AbortError" });
    expect(terminated).toBe(2);
  });

  it("rejects immediately if already aborted", async () => {
    const ctl = new AbortController();
    ctl.abort();
    await expect(
      scanFiles([file("1")], { createWorker: fakeFactory(), signal: ctl.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});
