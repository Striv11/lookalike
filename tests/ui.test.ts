import { describe, expect, it } from "vitest";
import { collectImages, filterImages, isImageFile, type EntryLike } from "../src/ui/files";
import { formatBytes, summarize } from "../src/ui/model";
import type { ScanOutcome } from "../src/pipeline/types";

const fileEntry = (name: string, type = ""): EntryLike => ({
  isFile: true,
  isDirectory: false,
  name,
  file: (ok) => ok(new File(["x"], name, { type })),
});
const dirEntry = (name: string, kids: EntryLike[], batch = 2): EntryLike => ({
  isFile: false,
  isDirectory: true,
  name,
  createReader() {
    let pos = 0;
    return {
      readEntries(ok) {
        const out = kids.slice(pos, pos + batch);
        pos += batch;
        ok(out);
      },
    };
  },
});

describe("isImageFile", () => {
  it("accepts by MIME type or extension, rejects others", () => {
    expect(isImageFile({ name: "a.JPG" })).toBe(true);
    expect(isImageFile({ name: "noext", type: "image/png" })).toBe(true);
    expect(isImageFile({ name: "notes.txt", type: "text/plain" })).toBe(false);
  });
  it("filterImages drops non-images", () => {
    const fs = [new File([""], "a.png"), new File([""], "b.pdf")];
    expect(filterImages(fs).map((f) => f.name)).toEqual(["a.png"]);
  });
});

describe("collectImages", () => {
  it("walks nested folders, reads all batches and skips non-images", async () => {
    const tree = dirEntry("root", [
      fileEntry("1.jpg"),
      fileEntry("readme.txt"),
      dirEntry("sub", [fileEntry("2.png"), fileEntry("3.webp"), fileEntry("4.gif")]),
      fileEntry("5.jpeg"),
    ]);
    const files = await collectImages([tree]);
    expect(files.map((f) => f.name).sort()).toEqual([
      "1.jpg",
      "2.png",
      "3.webp",
      "4.gif",
      "5.jpeg",
    ]);
  });
  it("skips unreadable entries without failing", async () => {
    const bad: EntryLike = {
      isFile: true,
      isDirectory: false,
      name: "x.jpg",
      file: (_ok, err) => err(new Error("denied")),
    };
    expect((await collectImages([bad, fileEntry("ok.jpg")])).map((f) => f.name)).toEqual([
      "ok.jpg",
    ]);
  });
});

const hashed = (index: number, pHash: bigint): ScanOutcome => ({
  index,
  name: `${index}.jpg`,
  ok: true,
  result: { aHash: 0n, dHash: 0n, pHash, width: 10, height: 20, bytes: 100 },
});

describe("summarize", () => {
  it("groups near hashes, reports failures, leaves singletons out", () => {
    const outcomes: ScanOutcome[] = [
      hashed(0, 0n),
      hashed(1, 0b111n),
      hashed(2, (1n << 64n) - 1n),
      { index: 3, name: "bad.jpg", ok: false, error: "nope" },
    ];
    const s = summarize(outcomes, 4);
    expect(s.scanned).toBe(4);
    expect(s.failed).toBe(1);
    expect(s.failures).toEqual([{ name: "bad.jpg", error: "nope" }]);
    expect(s.groups.map((g) => g.members.map((m) => m.index))).toEqual([[0, 1]]);
  });
  it("a larger radius merges more", () => {
    const o = [hashed(0, 0n), hashed(1, 0xffn)];
    expect(summarize(o, 4).groups).toHaveLength(0);
    expect(summarize(o, 8).groups).toHaveLength(1);
  });
});

describe("formatBytes", () => {
  it("formats units", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(3 * 1024 * 1024)).toBe("3.0 MB");
  });
});
