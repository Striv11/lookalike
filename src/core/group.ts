import { BKTree } from "./bktree";
import { type Hash64, hamming } from "./hash";

export interface Entry {
  id: number;
  hash: Hash64;
  /**
   * Hashes of the same image in the other 7 orientations (any order). When present and
   * `orientation` is enabled, two entries match if any variant of one is near the other's hash.
   */
  variants?: Hash64[];
  /** Entries sharing a key and a hash are exact duplicates and skip the tree search. */
  exactKey?: string;
}

export interface GroupOptions {
  /** Also match rotated and mirrored copies (needs `variants` on entries). */
  orientation?: boolean;
}

/**
 * Cluster entries whose hashes are within `radius` bits (transitively, via union-find).
 * Returns only groups of two or more, each sorted by id; groups sorted by first id.
 */
export function groupDuplicates(
  entries: Entry[],
  radius: number,
  opts: GroupOptions = {},
): number[][] {
  const parent = new Map<number, number>(entries.map((e) => [e.id, e.id]));
  const find = (x: number): number => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    while (parent.get(x) !== r) {
      const n = parent.get(x)!;
      parent.set(x, r);
      x = n;
    }
    return r;
  };
  const tree = new BKTree<number>();
  const seen = new Map<string, number>();
  for (const e of entries) {
    if (e.exactKey !== undefined) {
      // Exact duplicate fast path: identical bytes and hash, so distance 0 to a representative
      // that has already been searched; no tree query or insert needed.
      const k = `${e.exactKey}:${e.hash}`;
      const rep = seen.get(k);
      if (rep !== undefined) {
        parent.set(find(rep), find(e.id));
        continue;
      }
      seen.set(k, e.id);
    }
    const probes = opts.orientation ? [e.hash, ...(e.variants ?? [])] : [e.hash];
    for (const h of probes) {
      for (const m of tree.search(h, radius)) parent.set(find(m.item), find(e.id));
    }
    tree.insert(e.hash, e.id);
  }
  const groups = new Map<number, number[]>();
  for (const e of entries) {
    const r = find(e.id);
    (groups.get(r) ?? groups.set(r, []).get(r)!).push(e.id);
  }
  return [...groups.values()]
    .filter((g) => g.length > 1)
    .map((g) => g.sort((a, b) => a - b))
    .sort((a, b) => a[0]! - b[0]!);
}

/** Reference O(n^2) implementation used to validate the tree-based search. */
export function groupDuplicatesBrute(
  entries: Entry[],
  radius: number,
  opts: GroupOptions = {},
): number[][] {
  const idx = new Map(entries.map((e, i) => [e.id, i]));
  const parent = entries.map((_, i) => i);
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x]!)));
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const b = entries[j]!;
      const probes = opts.orientation ? [b.hash, ...(b.variants ?? [])] : [b.hash];
      if (probes.some((h) => hamming(h, entries[i]!.hash) <= radius)) parent[find(i)] = find(j);
    }
  }
  const groups = new Map<number, number[]>();
  for (const e of entries) {
    const r = find(idx.get(e.id)!);
    (groups.get(r) ?? groups.set(r, []).get(r)!).push(e.id);
  }
  return [...groups.values()]
    .filter((g) => g.length > 1)
    .map((g) => g.sort((a, b) => a - b))
    .sort((a, b) => a[0]! - b[0]!);
}
