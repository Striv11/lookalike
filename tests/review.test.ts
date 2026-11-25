import { describe, expect, it } from "vitest";
import type { Member, ResultGroup } from "../src/ui/model";
import { countRemovals, markOf, pickBest, resetGroup, toCsv, toggleMark } from "../src/ui/review";

const m = (index: number, w: number, h: number, bytes: number, name = `f${index}.jpg`): Member => ({
  index,
  name,
  width: w,
  height: h,
  bytes,
});
const group = (...members: Member[]): ResultGroup => ({ members });

describe("pickBest", () => {
  it("prefers resolution, then size, then earliest", () => {
    expect(pickBest([m(0, 100, 100, 9000), m(1, 200, 200, 10)]).index).toBe(1);
    expect(pickBest([m(0, 100, 100, 10), m(1, 100, 100, 20)]).index).toBe(1);
    expect(pickBest([m(0, 100, 100, 10), m(1, 100, 100, 10)]).index).toBe(0);
  });
});

describe("marks", () => {
  const g = group(m(0, 100, 100, 5), m(1, 200, 200, 5), m(2, 50, 50, 5));
  it("keeps only the best by default", () => {
    const o = new Map();
    expect(g.members.map((x) => markOf(g, x, o))).toEqual(["remove", "keep", "remove"]);
    expect(countRemovals([g], o)).toBe(2);
  });
  it("toggle overrides, and toggling back clears the override", () => {
    const o = new Map();
    toggleMark(g, g.members[0]!, o);
    expect(markOf(g, g.members[0]!, o)).toBe("keep");
    expect(o.size).toBe(1);
    toggleMark(g, g.members[0]!, o);
    expect(o.size).toBe(0);
  });
  it("resetGroup restores the heuristic", () => {
    const o = new Map();
    toggleMark(g, g.members[1]!, o);
    toggleMark(g, g.members[2]!, o);
    resetGroup(g, o);
    expect(o.size).toBe(0);
  });
});

describe("toCsv", () => {
  it("emits a header, quotes awkward names and defuses formulas", () => {
    const g = group(m(0, 10, 10, 1, 'a,"b".jpg'), m(1, 20, 20, 2, "=cmd.jpg"));
    const lines = toCsv([g], new Map()).trim().split("\r\n");
    expect(lines[0]).toBe("group,name,width,height,bytes,action");
    expect(lines[1]).toBe('1,"a,""b"".jpg",10,10,1,remove');
    expect(lines[2]).toBe("1,'=cmd.jpg,20,20,2,keep");
  });
});
