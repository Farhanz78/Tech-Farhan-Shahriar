import { supabase } from '@/utils/supabase/client';
import { bundleBaseUrl, bundleFileUrl } from '@/lib/storage';

export const dynamic = 'force-dynamic';

/**
 * Serves a game's HTML document.
 *
 * WHY THIS ROUTE EXISTS AT ALL:
 * Supabase Storage rewrites `text/html` to `text/plain` on every response --
 * unconditionally, in the base renderer, for public and signed URLs alike.
 * Pointing an iframe at a stored index.html therefore renders the source code
 * as visible text instead of running the game. There is no bucket setting or
 * upload option that changes this.
 *
 * So the entry document (a few KB) is served from this origin with the correct
 * Content-Type, and a <base href> is injected pointing back at the Storage CDN
 * so every relative asset path -- js, wasm, textures, audio -- still resolves
 * to Storage and streams straight from its CDN. Only the HTML passes through
 * here; the 20 MB of assets never touch this server.
 */

function injectBase(html: string, baseHref: string): string {
  const baseTag = `<base href="${baseHref}">`;

  // A <base> only affects tags that come after it, so it has to land as early
  // in <head> as possible.
  const headOpen = /<head\b[^>]*>/i.exec(html);
  if (headOpen) {
    const at = headOpen.index + headOpen[0].length;
    return html.slice(0, at) + baseTag + html.slice(at);
  }

  const htmlOpen = /<html\b[^>]*>/i.exec(html);
  if (htmlOpen) {
    const at = htmlOpen.index + htmlOpen[0].length;
    return html.slice(0, at) + `<head>${baseTag}</head>` + html.slice(at);
  }

  const doctype = /<!doctype[^>]*>/i.exec(html);
  if (doctype) {
    const at = doctype.index + doctype[0].length;
    return html.slice(0, at) + `<head>${baseTag}</head>` + html.slice(at);
  }

  return `<head>${baseTag}</head>` + html;
}

/**
 * Root-relative references resolve against the base's ORIGIN and discard its
 * path, so `<base href>` cannot rescue them: src="/game.js" would become
 * https://<ref>.supabase.co/game.js and 404. Inside a self-contained bundle a
 * leading slash always means "bundle root", so making it relative is correct.
 * Protocol-relative (//cdn...) and data:/blob: URLs are left alone.
 */
function rewriteRootRelative(html: string): string {
  return html.replace(
    /(\s(?:src|href|poster|data-src)\s*=\s*)(["'])\/(?!\/)([^"']*)\2/gi,
    (_m, attr, quote, path) => `${attr}${quote}${path}${quote}`,
  );
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const notFound = (msg: string) =>
    new Response(
      `<!doctype html><meta charset="utf-8"><title>Not available</title>` +
        `<body style="margin:0;display:grid;place-items:center;height:100vh;` +
        `background:#0B0C0E;color:#8A8F98;font:15px/1.5 system-ui,sans-serif">` +
        `<p>${msg}</p></body>`,
      { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } },
    );

  if (!/^[0-9a-f-]{36}$/i.test(id)) return notFound('Not found.');

  // select('*') so this still works on a database where supabase_migration.sql
  // has not been applied yet: naming a column that does not exist fails the
  // whole query, which would take every existing game offline.
  const { data: tool, error } = await supabase
    .from('tools')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !tool) return notFound('This project is not available.');
  if (tool.is_published === false) return notFound('This project is not available.');

  let html: string;

  if (tool.kind === 'bundle') {
    if (!tool.storage_path) return notFound('This project is missing its files.');

    const entry = tool.entry_path || 'index.html';
    const res = await fetch(bundleFileUrl(tool.storage_path, entry), { cache: 'no-store' });
    if (!res.ok) return notFound('This project failed to load.');

    html = rewriteRootRelative(await res.text());
    html = injectBase(html, bundleBaseUrl(tool.storage_path));
  } else {
    if (!tool.html_code) return notFound('This project is empty.');
    html = tool.html_code;
  }

  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // The portfolio page carries the SEO; the raw game document should not
      // compete with it in search results.
      'x-robots-tag': 'noindex',
      // Always fresh, so re-uploading a game takes effect immediately. The
      // document is small; the assets behind it are the cached part.
      'cache-control': 'no-store, must-revalidate',
    },
  });
}
