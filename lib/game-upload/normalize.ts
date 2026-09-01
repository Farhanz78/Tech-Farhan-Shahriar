/**
 * Path normalisation, safety filtering and entry-point detection for an
 * uploaded game (either unzipped in the browser, or picked as a folder).
 *
 * The finding that drives all of this: PowerShell's Compress-Archive -- the
 * default "Send to > Compressed folder" on Windows -- writes BACKSLASH
 * separators into zip entry names ("MyGame\index.html"). Any code that splits
 * on '/' then sees one giant filename, and every prefix / junk / traversal
 * check fails open. So normalizePath() runs first, on everything.
 */

export type RawFile = { path: string; bytes: Uint8Array };
export type RawPicked = { path: string; file: File };

export type EntryReason =
  | 'root-index'
  | 'nested-index'
  | 'only-html'
  | 'ambiguous'
  | 'no-html';

export type RejectReason = 'unsafe' | 'junk';

export type NormalizeResult<T> = {
  files: T[];
  entryPath: string | null;
  entryReason: EntryReason;
  htmlCandidates: string[];
  strippedRoot: string | null;
  rejected: { path: string; reason: RejectReason }[];
  /** Pre-compressed builds cannot work on Supabase Storage. See warnings. */
  compressedBuild: boolean;
  /** Root-relative asset refs cannot be fixed by <base href>. See warnings. */
  rootRelativeRefs: string[];
};

const SKIP_BASENAMES = new Set([
  '.DS_Store',
  'Thumbs.db',
  'desktop.ini',
  'ehthumbs.db',
  '.gitkeep',
  '.gitignore',
  'run_game.bat',
  'run_game.sh',
]);

/** Root-level docs must not veto stripping of a single wrapper folder. */
const STRAY_ROOT_DOC =
  /^(readme|license|licence|changelog|notice|authors|contributing|submit|store-text)([.\-_]|$)/i;

/** Backslash -> slash, drop "./" and any leading slashes. ALWAYS run first. */
export function normalizePath(raw: string): string {
  return raw
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '');
}

/** Reject anything that could escape the destination prefix. */
export function isUnsafePath(p: string): boolean {
  if (p.includes('\0')) return true;
  if (p.startsWith('/')) return true; // absolute
  if (/^[a-zA-Z]:/.test(p)) return true; // C:\ drive letter
  if (p.split('/').includes('..')) return true; // traversal at any depth
  if (p.length > 400) return true; // storage key sanity bound
  return false;
}

export function isJunkPath(p: string): boolean {
  if (p.startsWith('__MACOSX/') || p.includes('/__MACOSX/')) return true;
  const segs = p.split('/');
  const base = segs[segs.length - 1];
  if (base === '') return true; // a bare directory entry, e.g. "MyGame/"
  if (SKIP_BASENAMES.has(base)) return true;
  if (base.startsWith('._')) return true; // AppleDouble resource fork
  if (segs.includes('.git') || segs.includes('node_modules')) return true;
  return false;
}

/**
 * The single top-level folder shared by every file, or null if there isn't one.
 * Returns null when two different top folders exist, or when a real file sits
 * at the root -- in both cases stripping would corrupt the layout.
 */
function commonRootPrefix(paths: string[]): string | null {
  if (!paths.length) return null;
  const meaningful = paths.filter((p) => p.includes('/') || !STRAY_ROOT_DOC.test(p));
  if (!meaningful.length) return null;

  let candidate: string | null = null;
  for (const p of meaningful) {
    const slash = p.indexOf('/');
    if (slash <= 0) return null; // a real file at the root
    const top = p.slice(0, slash);
    if (candidate === null) candidate = top;
    else if (candidate !== top) return null; // two top-level folders
  }
  return candidate;
}

const depth = (p: string) => p.split('/').length;

export function pickEntry(
  paths: string[],
): Pick<NormalizeResult<never>, 'entryPath' | 'entryReason' | 'htmlCandidates'> {
  const html = paths.filter((p) => /\.x?html?$/i.test(p));
  if (!html.length) {
    return { entryPath: null, entryReason: 'no-html', htmlCandidates: [] };
  }

  const rootIndex = html.find((p) => /^index\.x?html?$/i.test(p));
  if (rootIndex) {
    return { entryPath: rootIndex, entryReason: 'root-index', htmlCandidates: html };
  }

  const nestedIndex = html
    .filter((p) => /(^|\/)index\.x?html?$/i.test(p))
    .sort((a, b) => depth(a) - depth(b) || a.localeCompare(b));
  if (nestedIndex.length) {
    return { entryPath: nestedIndex[0], entryReason: 'nested-index', htmlCandidates: html };
  }

  const shallowest = [...html].sort((a, b) => depth(a) - depth(b) || a.localeCompare(b));
  return {
    entryPath: shallowest[0],
    entryReason: html.length > 1 ? 'ambiguous' : 'only-html',
    htmlCandidates: html,
  };
}

/** Root-relative refs (src="/x.js") drop the whole storage prefix and 404. */
export function findRootRelativeRefs(html: string): string[] {
  const found = new Set<string>();
  const attr = /(?:src|href)\s*=\s*["'](\/[^/"'][^"']*)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = attr.exec(html)) !== null) found.add(m[1]);
  return [...found].slice(0, 12);
}

function finish<T extends { path: string }>(
  kept: T[],
  rejected: { path: string; reason: RejectReason }[],
  rootsPeeled: string[],
): NormalizeResult<T> {
  const paths = kept.map((f) => f.path);
  return {
    files: kept,
    strippedRoot: rootsPeeled.length ? rootsPeeled.join('/') : null,
    rejected,
    compressedBuild: paths.some((p) => /\.(gz|br)$/i.test(p)),
    rootRelativeRefs: [],
    ...pickEntry(paths),
  };
}

/**
 * Shared pipeline: filter unsafe/junk, then peel wrapper folders.
 * Peels repeatedly so a double-wrapped zip (Outer/MyGame/index.html) works.
 */
function normalizeAny<T extends { path: string }>(
  raw: T[],
  setPath: (item: T, path: string) => T,
): NormalizeResult<T> {
  const rejected: { path: string; reason: RejectReason }[] = [];
  let kept: T[] = [];

  for (const f of raw) {
    const p = normalizePath(f.path);
    if (isUnsafePath(p)) {
      rejected.push({ path: f.path, reason: 'unsafe' });
      continue;
    }
    if (isJunkPath(p)) {
      rejected.push({ path: f.path, reason: 'junk' });
      continue;
    }
    kept.push(setPath(f, p));
  }

  const rootsPeeled: string[] = [];
  for (let i = 0; i < 6; i++) {
    const root = commonRootPrefix(kept.map((f) => f.path));
    if (!root) break;
    rootsPeeled.push(root);
    const cut = root.length + 1;
    kept = kept
      .filter((f) => f.path.startsWith(root + '/'))
      .map((f) => setPath(f, f.path.slice(cut)));
  }

  return finish(kept, rejected, rootsPeeled);
}

export function normalizeZipFiles(raw: RawFile[]): NormalizeResult<RawFile> {
  return normalizeAny(raw, (f, path) => ({ ...f, path }));
}

export function normalizePickedFiles(raw: RawPicked[]): NormalizeResult<RawPicked> {
  return normalizeAny(raw, (f, path) => ({ ...f, path }));
}
