/**
 * Extension -> MIME map for uploaded game files.
 *
 * WHY THIS EXISTS, and why we cannot just trust the browser:
 *
 * supabase-js discards the `contentType` upload option whenever the body is a
 * Blob or a File. It builds a FormData and appends the blob, so the server
 * reads the MIME from the blob's own `type` instead. That means:
 *   - `new Blob([bytes])`                 -> type "" -> stored as octet-stream
 *   - a File from the folder picker       -> type is the OS guess, and empty
 *                                            for .wasm, .data, .unityweb, .glb
 *
 * The damage is deceptive. Supabase sends no `X-Content-Type-Options: nosniff`,
 * so a classic <script src> with the wrong MIME still runs -- which hides the
 * bug -- while:
 *   - <link rel=stylesheet> silently applies NOTHING (zero cssRules, no error)
 *   - <script type="module"> is hard-blocked by strict MIME checking
 *   - WebAssembly.instantiateStreaming rejects anything but bare
 *     `application/wasm` (a `; charset=UTF-8` suffix is also rejected)
 *
 * So: always construct the Blob with an explicit type from this table.
 */
const MIME: Record<string, string> = {
  // Documents
  html: 'text/html',
  htm: 'text/html',
  xhtml: 'application/xhtml+xml',

  // Scripts and styles
  js: 'text/javascript',
  mjs: 'text/javascript',
  cjs: 'text/javascript',
  css: 'text/css',
  json: 'application/json',
  map: 'application/json',
  xml: 'application/xml',
  wasm: 'application/wasm',

  // Engine payloads. These must NOT fall through to text/plain.
  data: 'application/octet-stream',
  unityweb: 'application/octet-stream',
  pck: 'application/octet-stream',
  bin: 'application/octet-stream',
  mem: 'application/octet-stream',
  bundle: 'application/octet-stream',
  symbols: 'application/octet-stream',

  // Images
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  bmp: 'image/bmp',
  ktx2: 'image/ktx2',
  basis: 'application/octet-stream',
  hdr: 'image/vnd.radiance',

  // Audio and video
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  flac: 'audio/flac',
  mp4: 'video/mp4',
  webm: 'video/webm',

  // 3D
  glb: 'model/gltf-binary',
  gltf: 'model/gltf+json',
  obj: 'text/plain',
  mtl: 'text/plain',
  fbx: 'application/octet-stream',
  draco: 'application/octet-stream',

  // Fonts
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
  eot: 'application/vnd.ms-fontobject',

  // Text
  txt: 'text/plain',
  csv: 'text/csv',
  md: 'text/plain',
  webmanifest: 'application/manifest+json',
};

export function mimeFor(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return MIME[ext] ?? 'application/octet-stream';
}

/** Wrap bytes in a Blob whose `type` is correct, since the upload option is ignored. */
export function blobFor(path: string, bytes: Uint8Array): Blob {
  // Copy: fflate hands back subarray views over the source buffer, and a Blob
  // built on a view would pin the entire unzipped archive in memory.
  return new Blob([bytes.slice().buffer as ArrayBuffer], { type: mimeFor(path) });
}
