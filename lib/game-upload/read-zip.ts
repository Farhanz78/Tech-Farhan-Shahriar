import type { RawFile } from './normalize';

/**
 * Read a .zip in the browser.
 *
 * fflate over jszip: ~4 KB gzipped vs ~30 KB, zero dependencies (jszip drags in
 * pako + readable-stream, which pulls Node polyfills into a browser bundle),
 * and its async `unzip` auto-tiers -- small entries inflate inline, only large
 * well-compressed ones go to a Worker -- so a 300-file game does not spawn 300
 * workers.
 *
 * The import is dynamic on purpose. fflate's package exports put the `node`
 * condition first, and that build contains `require('worker_threads')`. Client
 * components are still server-rendered in the App Router, so a top-level import
 * would pull the Node build into the server graph on every render. A dynamic
 * import inside the handler is never evaluated during SSR and gets its own
 * lazy chunk.
 */
export async function readZip(file: File): Promise<RawFile[]> {
  const { unzip } = await import('fflate');
  const buf = new Uint8Array(await file.arrayBuffer());

  const entries = await new Promise<Record<string, Uint8Array>>((resolve, reject) => {
    unzip(buf, (err, data) => (err ? reject(err) : resolve(data)));
  });

  return Object.entries(entries).map(([path, bytes]) => ({ path, bytes }));
}

export function describeZipError(err: unknown): string {
  const e = err as { code?: number; message?: string };
  if (e?.code === 13 || /invalid zip data/i.test(e?.message ?? '')) {
    return 'That file is not a readable .zip archive.';
  }
  return e?.message || 'Could not read the archive.';
}
