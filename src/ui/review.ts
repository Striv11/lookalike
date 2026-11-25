import type { Member, ResultGroup } from "./model";

export type Mark = "keep" | "remove";

/** Manual overrides keyed by member index; anything absent follows the best-pick heuristic. */
export type Overrides = Map<number, Mark>;

/** Best member of a group: most pixels, then largest file, then earliest. */
export function pickBest(members: Member[]): Member {
  let best = members[0]!;
  for (const m of members.slice(1)) {
    const a = m.width * m.height;
    const b = best.width * best.height;
    if (a > b || (a === b && m.bytes > best.bytes)) best = m;
  }
  return best;
}

/** Effective mark of a member: the manual override if any, else keep for the best pick only. */
export function markOf(group: ResultGroup, m: Member, overrides: Overrides): Mark {
  return overrides.get(m.index) ?? (pickBest(group.members) === m ? "keep" : "remove");
}

/** Toggle a member's mark; stores an override only when it differs from the heuristic. */
export function toggleMark(group: ResultGroup, m: Member, overrides: Overrides): void {
  const next: Mark = markOf(group, m, overrides) === "keep" ? "remove" : "keep";
  const auto: Mark = pickBest(group.members) === m ? "keep" : "remove";
  if (next === auto) overrides.delete(m.index);
  else overrides.set(m.index, next);
}

/** Reset every member of a group back to the heuristic. */
export function resetGroup(group: ResultGroup, overrides: Overrides): void {
  for (const m of group.members) overrides.delete(m.index);
}

export function countRemovals(groups: ResultGroup[], overrides: Overrides): number {
  let n = 0;
  for (const g of groups) for (const m of g.members) if (markOf(g, m, overrides) === "remove") n++;
  return n;
}

function csvCell(s: string): string {
  // Quote when needed, and defuse spreadsheet formula injection from hostile filenames.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** CSV listing every grouped file with its group number and keep/remove decision. */
export function toCsv(groups: ResultGroup[], overrides: Overrides): string {
  const rows = ["group,name,width,height,bytes,action"];
  groups.forEach((g, gi) => {
    for (const m of g.members) {
      rows.push(
        [gi + 1, csvCell(m.name), m.width, m.height, m.bytes, markOf(g, m, overrides)].join(","),
      );
    }
  });
  return rows.join("\r\n") + "\r\n";
}
