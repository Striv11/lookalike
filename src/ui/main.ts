import { createHashWorker, scanFiles } from "../pipeline/scan";
import { collectImages, filterImages, type EntryLike } from "./files";
import { formatBytes, summarize, type ScanSummary } from "./model";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const drop = $("drop");
const status = $("status");
const bar = $<HTMLProgressElement>("bar");
const statusText = $("status-text");
const results = $("results");

let urls: string[] = [];
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

function render(files: File[], s: ScanSummary) {
  reset();
  const head = el(
    "p",
    "summary",
    `Scanned ${s.scanned} photos: ${s.groups.length} duplicate group${s.groups.length === 1 ? "" : "s"}` +
      (s.failed ? `, ${s.failed} could not be read.` : "."),
  );
  results.append(head);
  if (s.groups.length === 0) {
    results.append(el("p", "empty", "No duplicates found."));
  }
  s.groups.forEach((g, gi) => {
    const box = el("article", "group");
    box.append(el("h3", undefined, `Group ${gi + 1} (${g.members.length} photos)`));
    const grid = el("div", "grid");
    for (const m of g.members) {
      const cell = el("figure", "thumb");
      cell.style.margin = "0";
      const img = el("img");
      const url = URL.createObjectURL(files[m.index]!);
      urls.push(url);
      img.src = url;
      img.alt = m.name;
      img.loading = "lazy";
      cell.append(
        img,
        el("div", "name", m.name),
        el("div", "meta", `${m.width}×${m.height} · ${formatBytes(m.bytes)}`),
      );
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

async function run(files: File[]) {
  controller?.abort();
  reset();
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
    render(files, summarize(outcomes));
  } catch (e) {
    if ((e as DOMException).name === "AbortError") {
      if (controller === mine) results.append(el("p", "empty", "Scan cancelled."));
    } else {
      results.append(el("p", "error", `Scan failed: ${(e as Error).message}`));
    }
  } finally {
    if (controller === mine) {
      status.hidden = true;
      controller = null;
    }
  }
}

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
