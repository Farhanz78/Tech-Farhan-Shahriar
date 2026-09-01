import { supabase } from '@/utils/supabase/client';
import { mimeFor } from './mime';

export const GAMES_BUCKET = 'games';

export type UploadItem = { path: string; body: Blob | File; size: number };

export type UploadProgress = {
  filesDone: number;
  filesTotal: number;
  bytesDone: number;
  bytesTotal: number;
  current: string;
  failed: { path: string; message: string }[];
};

/**
 * 5 concurrent uploads. Supabase publishes no Storage rate limit, so this is an
 * engineering choice: it keeps peak memory to ~5 in-flight blobs, keeps the
 * retry blast radius small, and stays under the documented TUS ceiling of 10.
 * Raising it buys little because a 20 MB bundle is bandwidth-bound, not
 * round-trip-bound, and makes 429s more likely.
 */
const CONCURRENCY = 5;
const MAX_ATTEMPTS = 3;
const MAX_FILE_BYTES = 50 * 1024 * 1024; // Supabase free-tier per-file cap

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isRetryable(err: unknown): boolean {
  const e = err as { statusCode?: string | number; status?: number };
  const code = Number(e?.statusCode ?? e?.status ?? 0);
  if (code === 429) return true; // rate limited
  if (code >= 500) return true; // server side
  if (code >= 400 && code < 500) return false; // our fault; retrying won't help
  return true; // network error / fetch failed
}

async function uploadOne(key: string, body: Blob | File, path: string) {
  // Re-wrap so the MIME type is always explicit: supabase-js ignores the
  // contentType option for Blob/File bodies and reads blob.type instead.
  const want = mimeFor(path);
  const typed = body.type === want ? body : new Blob([body], { type: want });

  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const { error } = await supabase.storage.from(GAMES_BUCKET).upload(key, typed, {
      upsert: true, // makes a retry of the whole batch idempotent
      cacheControl: '31536000', // 1 year; keys are id-scoped so they never collide
    });
    if (!error) return;
    lastErr = error;
    if (!isRetryable(error) || attempt === MAX_ATTEMPTS) break;
    await sleep(300 * 2 ** (attempt - 1) + Math.random() * 200);
  }
  throw lastErr;
}

/**
 * Upload every file of a bundle under `prefix`.
 *
 * Never aborts the batch on a single failure -- it collects them so the caller
 * can offer "retry failed only". The DB row must only be inserted once this
 * returns with an empty `failed` list, otherwise a half-uploaded game leaves a
 * permanently broken card on the homepage.
 */
export async function uploadGameFiles(
  prefix: string,
  items: UploadItem[],
  onProgress: (p: UploadProgress) => void,
  signal?: AbortSignal,
): Promise<UploadProgress> {
  const oversized = items.filter((i) => i.size > MAX_FILE_BYTES);
  if (oversized.length) {
    throw new Error(
      `${oversized.length} file(s) are over the 50 MB per-file limit: ` +
        oversized
          .slice(0, 3)
          .map((f) => f.path)
          .join(', '),
    );
  }

  const progress: UploadProgress = {
    filesDone: 0,
    filesTotal: items.length,
    bytesDone: 0,
    bytesTotal: items.reduce((a, i) => a + i.size, 0),
    current: '',
    failed: [],
  };

  // Biggest first: keeps the pool saturated and surfaces size errors early.
  const queue = [...items].sort((a, b) => b.size - a.size);
  let cursor = 0;

  async function worker() {
    while (cursor < queue.length) {
      if (signal?.aborted) throw new DOMException('Upload cancelled', 'AbortError');
      const item = queue[cursor++];
      progress.current = item.path;
      try {
        await uploadOne(`${prefix}/${item.path}`, item.body, item.path);
      } catch (err) {
        progress.failed.push({
          path: item.path,
          message: (err as Error)?.message ?? 'Upload failed',
        });
      }
      progress.filesDone++;
      progress.bytesDone += item.size;
      onProgress({ ...progress, failed: [...progress.failed] });
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
  return progress;
}

/** Remove an entire bundle prefix. Used to clean up after a failed upload. */
export async function removeGameFiles(prefix: string): Promise<void> {
  const all: string[] = [];

  async function walk(dir: string) {
    const { data, error } = await supabase.storage.from(GAMES_BUCKET).list(dir, { limit: 1000 });
    if (error || !data) return;
    for (const entry of data) {
      const full = `${dir}/${entry.name}`;
      // A storage "folder" is a zero-byte placeholder with no id.
      if (entry.id === null) await walk(full);
      else all.push(full);
    }
  }

  await walk(prefix);

  for (let i = 0; i < all.length; i += 900) {
    await supabase.storage.from(GAMES_BUCKET).remove(all.slice(i, i + 900));
  }
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
