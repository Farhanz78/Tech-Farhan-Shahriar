export const GAMES_BUCKET = 'games';

function supabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
  return url.replace(/\/+$/, '');
}

/** Public CDN base for a bundle. Trailing slash included: this is a <base href>. */
export function bundleBaseUrl(storagePath: string): string {
  return `${supabaseUrl()}/storage/v1/object/public/${GAMES_BUCKET}/${storagePath}/`;
}

/** Public URL of one file inside a bundle. */
export function bundleFileUrl(storagePath: string, filePath: string): string {
  return bundleBaseUrl(storagePath) + filePath.replace(/^\/+/, '');
}

/**
 * Origin that serves playable game documents.
 *
 * Default is the site's own origin, which always works. Setting
 * NEXT_PUBLIC_GAME_ORIGIN to a DIFFERENT domain you control (for example the
 * project's *.vercel.app address, while the portfolio itself is on the custom
 * domain) puts every game on a separate origin. The browser's same-origin
 * policy then makes it impossible for game code to read the portfolio's
 * localStorage or reach into its page, while the game still gets its own
 * working localStorage for save data.
 */
export function gameDocumentUrl(id: string): string {
  const origin = process.env.NEXT_PUBLIC_GAME_ORIGIN?.replace(/\/+$/, '');
  return origin ? `${origin}/g/${id}` : `/g/${id}`;
}
