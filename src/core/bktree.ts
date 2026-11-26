import { type Hash64, hammingSplit, split } from "./hash";

interface Node<T> {
  hi: number;
  lo: number;
  items: T[];
  children: Map<number, Node<T>>;
}

/** BK-tree over 64-bit hashes under Hamming distance: range queries without a full scan. */
export class BKTree<T> {
  private root: Node<T> | null = null;
  size = 0;

  insert(hash: Hash64, item: T): void {
    this.size++;
    const [hi, lo] = split(hash);
    if (!this.root) {
      this.root = { hi, lo, items: [item], children: new Map() };
      return;
    }
    let node = this.root;
    for (;;) {
      const d = hammingSplit(hi, lo, node.hi, node.lo);
      if (d === 0) {
        node.items.push(item);
        return;
      }
      const next = node.children.get(d);
      if (!next) {
        node.children.set(d, { hi, lo, items: [item], children: new Map() });
        return;
      }
      node = next;
    }
  }

  /** All items whose hash is within `radius` bits of `hash`. */
  search(hash: Hash64, radius: number): { item: T; distance: number }[] {
    const out: { item: T; distance: number }[] = [];
    if (!this.root) return out;
    const [hi, lo] = split(hash);
    const stack: Node<T>[] = [this.root];
    while (stack.length) {
      const node = stack.pop()!;
      const d = hammingSplit(hi, lo, node.hi, node.lo);
      if (d <= radius) for (const item of node.items) out.push({ item, distance: d });
      for (const [cd, child] of node.children) {
        if (cd >= d - radius && cd <= d + radius) stack.push(child);
      }
    }
    return out;
  }
}
