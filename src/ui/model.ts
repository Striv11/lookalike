import { groupDuplicates, type Entry, type GroupOptions } from "../core/group";
import type { ScanOutcome } from "../pipeline/types";

export interface Member {
  index: number;
  name: string;
  width: number;
  height: number;
  bytes: number;
}

export interface ResultGroup {
  members: Member[];
}

export interface ScanSummary {
  scanned: number;
  failed: number;
  groups: ResultGroup[];
  failures: { name: string; error: string }[];
}

/** Default Hamming radius on the 64-bit pHash. */
export const DEFAULT_RADIUS = 8;

/** Turn raw scan outcomes into duplicate groups plus a failure list. */
export function summarize(
  outcomes: ScanOutcome[],
  radius = DEFAULT_RADIUS,
  opts: GroupOptions = {},
): ScanSummary {
  const byIndex = new Map<number, Member>();
  const entries: Entry[] = [];
  const failures = [];
  for (const o of outcomes) {
    if (!o.ok) {
      failures.push({ name: o.name, error: o.error });
      continue;
    }
    const r = o.result;
    byIndex.set(o.index, {
      index: o.index,
      name: o.name,
      width: r.width,
      height: r.height,
      bytes: r.bytes,
    });
    entries.push({
      id: o.index,
      hash: r.pHash,
      variants: r.pHashVariants,
      exactKey: `${r.bytes}:${r.width}x${r.height}`,
    });
  }
  const groups = groupDuplicates(entries, radius, opts).map((ids) => ({
    members: ids.map((i) => byIndex.get(i)!),
  }));
  return { scanned: outcomes.length, failed: failures.length, groups, failures };
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
