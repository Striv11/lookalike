import { BKTree } from "./bktree";
import { type Hash64, hamming } from "./hash";

export interface Entry {
  id: number;
  hash: Hash64;
}

/**
 * Cluster entries whose hashes are within `radius` bits (transitively, via union-find).
 * Returns only groups of two or more, each sorted by id; groups sorted by first id.
 */
export function groupDuplicates(entries: Entry[], radius: number): number[][] {
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
  for (const e of entries) {
    for (const m of tree.search(e.hash, radius)) {
      parent.set(find(m.item), find(e.id));
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
export function groupDuplicatesBrute(entries: Entry[], radius: number): number[][] {
  const idx = new Map(entries.map((e, i) => [e.id, i]));
  const parent = entries.map((_, i) => i);
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x]!)));
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      if (hamming(entries[i]!.hash, entries[j]!.hash) <= radius) parent[find(i)] = find(j);
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
