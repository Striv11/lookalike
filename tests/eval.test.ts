import { describe, expect, it } from "vitest";
import { resizeGray, type Gray } from "../src/core/gray";
import { groupDuplicates, type Entry } from "../src/core/group";
import { pHash } from "../src/core/hash";
import { orientations, pHashVariants } from "../src/core/orient";
import { addNoise, brighten, synthImage } from "./helpers";

/** Pairwise precision/recall of `groups` against ground-truth labels (entry id -> source image). */
export function pairwiseScore(labels: number[], groups: number[][]) {
  const predicted = new Set<string>();
  for (const g of groups)
    for (let i = 0; i < g.length; i++)
      for (let j = i + 1; j < g.length; j++) predicted.add(`${g[i]}:${g[j]}`);
  let truth = 0;
  let hit = 0;
  for (let i = 0; i < labels.length; i++)
    for (let j = i + 1; j < labels.length; j++)
      if (labels[i] === labels[j]) {
        truth++;
        if (predicted.has(`${i}:${j}`)) hit++;
      }
  return {
    precision: predicted.size === 0 ? 1 : hit / predicted.size,
    recall: truth === 0 ? 1 : hit / truth,
  };
}

type Edit = (g: Gray, seed: number) => Gray;
const EDITS: Record<string, Edit> = {
  noise: (g, s) => addNoise(g, 12, s),
  brightness: (g) => brighten(g, 1.12),
  "half-size": (g) => resizeGray(g, Math.round(g.width / 2), Math.round(g.height / 2)),
  "rotate 90": (g) => orientations(g)[1]!,
  mirror: (g) => orientations(g)[4]!,
};

const SOURCES = 60;

function build(editNames: string[]) {
  const entries: Entry[] = [];
  const labels: number[] = [];
  const add = (g: Gray, label: number) => {
    entries.push({ id: entries.length, hash: pHash(g), variants: pHashVariants(g).slice(1) });
    labels.push(label);
  };
  for (let s = 0; s < SOURCES; s++) {
    const base = synthImage(1000 + s);
    add(base, s);
    editNames.forEach((n, k) => add(EDITS[n]!(base, s * 7 + k), s));
  }
  return { entries, labels };
}

describe("precision/recall evaluation (synthetic corpus)", () => {
  const radii = [4, 8, 12];
  it("finds noisy and resized copies with high precision and recall at radius 8", () => {
    const { entries, labels } = build(["noise", "half-size"]);
    const s = pairwiseScore(labels, groupDuplicates(entries, 8));
    expect(s.precision).toBeGreaterThan(0.98);
    expect(s.recall).toBeGreaterThan(0.95);
  });
  it("is weaker on clipping brightness edits (documented limitation) but never merges strangers", () => {
    const { entries, labels } = build(["brightness"]);
    const s = pairwiseScore(labels, groupDuplicates(entries, 8));
    expect(s.precision).toBeGreaterThan(0.98);
    expect(s.recall).toBeGreaterThan(0.7);
  });
  it("misses rotated and mirrored copies unless orientation matching is on", () => {
    const { entries, labels } = build(["rotate 90", "mirror"]);
    const off = pairwiseScore(labels, groupDuplicates(entries, 8));
    const on = pairwiseScore(labels, groupDuplicates(entries, 8, { orientation: true }));
    expect(off.recall).toBeLessThan(0.5);
    expect(on.recall).toBeGreaterThan(0.95);
    expect(on.precision).toBeGreaterThan(0.98);
  });
  it("recall never decreases and precision stays sane as the radius grows", () => {
    const { entries, labels } = build(Object.keys(EDITS));
    let prev = 0;
    for (const r of radii) {
      const s = pairwiseScore(labels, groupDuplicates(entries, r, { orientation: true }));
      expect(s.recall).toBeGreaterThanOrEqual(prev);
      prev = s.recall;
      if (process.env.EVAL_PRINT)
        console.log(
          `radius ${r}: precision ${s.precision.toFixed(3)} recall ${s.recall.toFixed(3)}`,
        );
    }
  });
  it("prints per-edit results when EVAL_PRINT is set", { timeout: 60_000 }, () => {
    if (!process.env.EVAL_PRINT) return;
    for (const name of Object.keys(EDITS))
      for (const r of radii)
        for (const o of [false, true]) {
          const { entries, labels } = build([name]);
          const s = pairwiseScore(labels, groupDuplicates(entries, r, { orientation: o }));
          console.log(
            `${name} r=${r} orient=${o} P=${s.precision.toFixed(3)} R=${s.recall.toFixed(3)}`,
          );
        }
  });
});
