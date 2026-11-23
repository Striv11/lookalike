import type { Progress, ScanOutcome, WorkerRequest, WorkerResponse } from "./types";

/** The subset of the Worker API the pool relies on (lets tests inject in-process fakes). */
export interface WorkerLike {
  onmessage: ((e: { data: WorkerResponse }) => void) | null;
  onerror: ((e: { message?: string }) => void) | null;
  postMessage(msg: WorkerRequest): void;
  terminate(): void;
}

export interface ScanOptions {
  createWorker: () => WorkerLike;
  /** Number of parallel workers (default 4). */
  concurrency?: number;
  onProgress?: (p: Progress) => void;
  signal?: AbortSignal;
}

/**
 * Hash files with a pool of workers. Outcomes are returned in input order. A file that fails
 * to decode, or a worker that crashes, yields a failed outcome instead of aborting the scan;
 * crashed workers are replaced. Aborting terminates all workers and rejects.
 */
export function scanFiles(files: File[], opts: ScanOptions): Promise<ScanOutcome[]> {
  const total = files.length;
  const outcomes: ScanOutcome[] = new Array(total);
  const progress: Progress = { done: 0, total, failed: 0 };
  if (total === 0) return Promise.resolve([]);

  return new Promise((resolve, reject) => {
    const live = new Set<WorkerLike>();
    let next = 0;
    let settled = false;

    const finish = (err?: unknown) => {
      if (settled) return;
      settled = true;
      opts.signal?.removeEventListener("abort", onAbort);
      for (const w of live) w.terminate();
      live.clear();
      if (err) reject(err);
      else resolve(outcomes);
    };
    const onAbort = () => finish(new DOMException("scan aborted", "AbortError"));
    if (opts.signal?.aborted) return onAbort();
    opts.signal?.addEventListener("abort", onAbort);

    const record = (index: number, outcome: ScanOutcome) => {
      outcomes[index] = outcome;
      progress.done++;
      if (!outcome.ok) progress.failed++;
      opts.onProgress?.({ ...progress });
    };

    const spawn = () => {
      if (settled) return;
      const worker = opts.createWorker();
      live.add(worker);
      let current = -1;

      const retire = () => {
        live.delete(worker);
        worker.terminate();
      };
      const feed = () => {
        if (settled) return;
        if (next >= total) {
          retire();
          if (progress.done === total) finish();
          return;
        }
        current = next++;
        worker.postMessage({ id: current, file: files[current]! });
      };

      worker.onmessage = (e) => {
        const r = e.data;
        current = -1;
        const name = files[r.id]?.name ?? "";
        record(
          r.id,
          r.ok
            ? { index: r.id, name, ok: true, result: r.result }
            : { index: r.id, name, ok: false, error: r.error },
        );
        feed();
      };
      worker.onerror = (e) => {
        if (current >= 0) {
          record(current, {
            index: current,
            name: files[current]!.name,
            ok: false,
            error: e.message || "worker crashed",
          });
        }
        retire();
        if (progress.done === total) finish();
        else if (next < total) spawn();
      };
      feed();
    };

    const n = Math.max(1, Math.min(opts.concurrency ?? 4, total));
    for (let i = 0; i < n; i++) spawn();
  });
}

/** Create a pool backed by the real hashing web worker. */
export function createHashWorker(): WorkerLike {
  return new Worker(new URL("./hash.worker.ts", import.meta.url), {
    type: "module",
  }) as unknown as WorkerLike;
}
