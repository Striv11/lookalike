const IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp|avif)$/i;

/** True for files the browser can plausibly decode, judged by MIME type or extension. */
export function isImageFile(f: { name: string; type?: string }): boolean {
  return (f.type ?? "").startsWith("image/") || IMAGE_EXT.test(f.name);
}

/** Minimal shape of FileSystemEntry (lets tests supply in-memory trees). */
export interface EntryLike {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  file?(ok: (f: File) => void, err: (e: unknown) => void): void;
  createReader?(): {
    readEntries(ok: (entries: EntryLike[]) => void, err: (e: unknown) => void): void;
  };
}

async function readAll(entry: EntryLike): Promise<EntryLike[]> {
  const reader = entry.createReader!();
  const all: EntryLike[] = [];
  // readEntries returns results in batches; an empty batch signals the end.
  for (;;) {
    const batch = await new Promise<EntryLike[]>((ok, err) => reader.readEntries(ok, err));
    if (batch.length === 0) return all;
    all.push(...batch);
  }
}

/** Recursively collect image files below the given entries; unreadable entries are skipped. */
export async function collectImages(entries: EntryLike[]): Promise<File[]> {
  const out: File[] = [];
  const walk = async (e: EntryLike): Promise<void> => {
    try {
      if (e.isFile && e.file) {
        const f = await new Promise<File>((ok, err) => e.file!(ok, err));
        if (isImageFile(f)) out.push(f);
      } else if (e.isDirectory && e.createReader) {
        for (const child of await readAll(e)) await walk(child);
      }
    } catch {
      /* skip unreadable entry */
    }
  };
  for (const e of entries) await walk(e);
  return out;
}

/** Keep only images from a flat file list (folder picker / file input). */
export function filterImages(files: File[]): File[] {
  return files.filter(isImageFile);
}
