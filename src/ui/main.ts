import { createHashWorker, scanFiles } from "../pipeline/scan";
import { collectImages, filterImages, type EntryLike } from "./files";
import { DEFAULT_RADIUS, formatBytes, summarize, type ScanSummary } from "./model";
import { countRemovals, markOf, resetGroup, toCsv, toggleMark, type Overrides } from "./review";
import type { ScanOutcome } from "../pipeline/types";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const drop = $("drop");
const status = $("status");
const bar = $<HTMLProgressElement>("bar");
const statusText = $("status-text");
const results = $("results");

const toolbar = $("toolbar");
const radiusInput = $<HTMLInputElement>("radius");
const radiusOut = $("radius-out");
const orientInput = $<HTMLInputElement>("orient");
const removalsOut = $("removals");

let urls: string[] = [];
let currentFiles: File[] = [];
let currentOutcomes: ScanOutcome[] = [];
let current: ScanSummary | null = null;
let overrides: Overrides = new Map();
let controller: AbortController | null = null;

function reset() {
  for (const u of urls) URL.revokeObjectURL(u);
  urls = [];
  results.replaceChildren();
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function alertEl(text: string) {
  const p = el("p", "error", text);
  p.setAttribute("role", "alert");
  return p;
}

function render(files: File[], s: ScanSummary) {
  reset();
  current = s;
  removalsOut.textContent = `${countRemovals(s.groups, overrides)} marked for removal`;
  const head = el(
    "p",
    "summary",
    `Scanned ${s.scanned} photos: ${s.groups.length} duplicate group${s.groups.length === 1 ? "" : "s"}` +
      (s.failed ? `, ${s.failed} could not be read.` : "."),
  );
  results.append(head);
  if (s.groups.length === 0) {
    results.append(el("p", "empty", "No duplicates found. Try raising the similarity slider."));
  }
  s.groups.forEach((g, gi) => {
    const box = el("article", "group");
    box.dataset.group = String(gi);
    box.append(el("h3", undefined, `Group ${gi + 1} (${g.members.length} photos)`));
    const grid = el("div", "grid");
    for (const m of g.members) {
      const cell = el("figure", "thumb");
      cell.style.margin = "0";
      cell.tabIndex = 0;
      cell.dataset.index = String(m.index);
      const mark = markOf(g, m, overrides);
      cell.classList.add(mark);
      cell.setAttribute("aria-label", `${m.name}: ${mark}`);
      const img = el("img");
      const url = URL.createObjectURL(files[m.index]!);
      urls.push(url);
      img.src = url;
      img.alt = m.name;
      img.loading = "lazy";
      cell.append(
        img,
        el("div", `badge ${mark}`, mark === "keep" ? "Keep" : "Remove"),
        el("div", "name", m.name),
        el("div", "meta", `${m.width}×${m.height} · ${formatBytes(m.bytes)}`),
      );
      cell.addEventListener("click", () => toggle(gi, m.index));
      grid.append(cell);
    }
    box.append(grid);
    results.append(box);
  });
  if (s.failures.length) {
    const d = el("details");
    d.append(el("summary", undefined, `${s.failures.length} unreadable files`));
    const ul = el("ul");
    for (const f of s.failures) ul.append(el("li", undefined, `${f.name}: ${f.error}`));
    d.append(ul);
    results.append(d);
  }
}

function regroup(refocus?: string) {
  if (!currentOutcomes.length) return;
  radiusOut.textContent = `${radiusInput.value} bits`;
  render(
    currentFiles,
    summarize(currentOutcomes, Number(radiusInput.value), {
      orientation: orientInput.checked,
    }),
  );
  if (refocus) results.querySelector<HTMLElement>(`[data-index="${refocus}"]`)?.focus();
}

function toggle(gi: number, index: number) {
  const g = current?.groups[gi];
  const m = g?.members.find((x) => x.index === index);
  if (!g || !m) return;
  toggleMark(g, m, overrides);
  regroup(String(index));
}

function exportCsv() {
  if (!current) return;
  const url = URL.createObjectURL(
    new Blob([toCsv(current.groups, overrides)], { type: "text/csv" }),
  );
  const a = el("a");
  a.href = url;
  a.download = "lookalike-review.csv";
  a.click();
  URL.revokeObjectURL(url);
}

radiusInput.addEventListener("input", () => regroup());
orientInput.addEventListener("change", () => regroup());
$("export").addEventListener("click", exportCsv);
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const t = e.target as HTMLElement;
  if (t instanceof HTMLInputElement && t.type !== "range") return;
  const cell = t.closest<HTMLElement>(".thumb");
  const key = e.key.toLowerCase();
  if (key === "e" && current) {
    exportCsv();
    return;
  }
  if (!cell) return;
  const gi = Number(cell.closest<HTMLElement>(".group")?.dataset.group);
  const index = Number(cell.dataset.index);
  if (key === " " || key === "k" || key === "enter") {
    e.preventDefault();
    toggle(gi, index);
  } else if (key === "r") {
    const g = current?.groups[gi];
    if (g) {
      resetGroup(g, overrides);
      regroup(String(index));
    }
  } else if (key === "arrowright" || key === "arrowleft") {
    e.preventDefault();
    const all = [...results.querySelectorAll<HTMLElement>(".thumb")];
    all[all.indexOf(cell) + (key === "arrowright" ? 1 : -1)]?.focus();
  }
});

async function run(files: File[]) {
  controller?.abort();
  reset();
  toolbar.hidden = true;
  current = null;
  currentOutcomes = [];
  if (files.length === 0) {
    results.append(el("p", "empty", "No image files found in that selection."));
    return;
  }
  const mine = (controller = new AbortController());
  status.hidden = false;
  bar.max = files.length;
  bar.value = 0;
  statusText.textContent = `Hashing 0 / ${files.length}`;
  try {
    const outcomes = await scanFiles(files, {
      createWorker: createHashWorker,
      concurrency: Math.min(navigator.hardwareConcurrency || 4, 8),
      signal: mine.signal,
      onProgress: (p) => {
        bar.value = p.done;
        statusText.textContent = `Hashing ${p.done} / ${p.total}`;
      },
    });
    currentFiles = files;
    currentOutcomes = outcomes;
    overrides = new Map();
    radiusInput.value = String(DEFAULT_RADIUS);
    toolbar.hidden = false;
    regroup();
  } catch (e) {
    if ((e as DOMException).name === "AbortError") {
      if (controller === mine) results.append(el("p", "empty", "Scan cancelled."));
    } else {
      results.append(alertEl(`Scan failed: ${(e as Error).message}`));
    }
  } finally {
    if (controller === mine) {
      status.hidden = true;
      controller = null;
    }
  }
}

const themeBtn = $("theme");
const THEMES = ["system", "light", "dark"] as const;
function applyTheme(t: (typeof THEMES)[number]) {
  if (t === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.dataset.theme = t;
  themeBtn.textContent = `Theme: ${t}`;
  themeBtn.setAttribute("aria-label", `Theme: ${t}. Activate to change.`);
}
let themeIdx = 0;
try {
  const saved = localStorage.getItem("lookalike-theme");
  themeIdx = Math.max(0, THEMES.indexOf(saved as (typeof THEMES)[number]));
} catch {
  /* storage unavailable: stay on system */
}
applyTheme(THEMES[themeIdx]!);
themeBtn.addEventListener("click", () => {
  themeIdx = (themeIdx + 1) % THEMES.length;
  applyTheme(THEMES[themeIdx]!);
  try {
    localStorage.setItem("lookalike-theme", THEMES[themeIdx]!);
  } catch {
    /* ignore */
  }
});

$("cancel").addEventListener("click", () => controller?.abort());
for (const id of ["pick-folder", "pick-files"]) {
  const input = $<HTMLInputElement>(id);
  input.addEventListener("change", () => {
    void run(filterImages([...(input.files ?? [])]));
    input.value = "";
  });
}
drop.addEventListener("dragover", (e) => {
  e.preventDefault();
  drop.classList.add("over");
});
drop.addEventListener("dragleave", () => drop.classList.remove("over"));
drop.addEventListener("drop", (e) => {
  e.preventDefault();
  drop.classList.remove("over");
  const items = [...(e.dataTransfer?.items ?? [])];
  // Entries must be grabbed synchronously; the DataTransfer is cleared after the handler.
  const entries = items
    .map((i) => i.webkitGetAsEntry?.() as EntryLike | null | undefined)
    .filter((x): x is EntryLike => !!x);
  if (entries.length) void collectImages(entries).then(run);
  else void run(filterImages([...(e.dataTransfer?.files ?? [])]));
});
