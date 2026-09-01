import Link from 'next/link';
import * as icons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Tool } from '@/types';

const iconMap = icons as unknown as Record<string, LucideIcon | undefined>;

/**
 * Cover images use a plain <img>, not next/image, on purpose: thumbnail_url can
 * hold any URL, and next/image hard-fails on a host that is not listed in
 * next.config.ts — a failure the site owner would have to edit config to fix.
 */
export default function GameCard({ tool, priority = false }: { tool: Tool; priority?: boolean }) {
  const Icon = (tool.icon_name && iconMap[tool.icon_name]) || icons.Gamepad2;
  const plays = tool.play_count ?? 0;

  return (
    <article className="group relative flex flex-col rounded-2xl bg-surface border border-hairline overflow-hidden transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-1 hover:border-lime/40 hover:shadow-[0_18px_44px_-16px_rgba(0,0,0,0.9)] focus-within:border-lime/60 motion-reduce:hover:translate-y-0">
      <div className="relative aspect-video overflow-hidden bg-surface-2">
        {tool.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={tool.thumbnail_url}
            alt=""
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.045] motion-reduce:group-hover:scale-100"
          />
        ) : (
          <CoverFallback title={tool.title} id={tool.id} Icon={Icon} />
        )}

        {tool.is_featured && (
          <span className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-full bg-amber text-ink text-[11px] font-bold uppercase tracking-wide">
            Featured
          </span>
        )}

        {plays > 0 && (
          <span className="absolute top-3 right-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-ink/70 backdrop-blur-sm px-2.5 py-1 text-[11px] text-muted tabular-nums">
            <icons.Play className="w-3 h-3 fill-amber text-amber" aria-hidden />
            {plays.toLocaleString()}
          </span>
        )}

        <div className="absolute inset-0 grid place-items-center bg-ink/55 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
          <span className="inline-flex items-center gap-2 rounded-full bg-lime px-5 py-2.5 text-sm font-semibold text-ink translate-y-1.5 transition-transform duration-200 group-hover:translate-y-0 group-focus-within:translate-y-0 motion-reduce:translate-y-0">
            <icons.Play className="w-4 h-4 fill-ink" aria-hidden />
            {tool.category === 'tool' ? 'Open' : 'Play now'}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-5">
        <h3 className="font-semibold text-[17px] leading-snug text-text">
          {/* Stretched link: the whole card is clickable, but the accessible
              name stays just the title instead of swallowing the description
              and every tag. */}
          <Link
            href={`/play/${tool.id}`}
            className="after:absolute after:inset-0 after:content-[''] group-hover:text-lime transition-colors"
          >
            {tool.title}
          </Link>
        </h3>

        {tool.description && (
          <p className="text-sm text-muted leading-relaxed line-clamp-2">{tool.description}</p>
        )}

        {tool.tags?.length > 0 && (
          <ul className="mt-auto flex flex-wrap gap-1.5 pt-1">
            {tool.tags.slice(0, 3).map((tag) => (
              <li
                key={tag}
                className="px-2 py-0.5 rounded-md bg-surface-2 border border-hairline text-[11px] text-subtle"
              >
                {tag}
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}

/**
 * No cover uploaded yet. Deterministic per project id, so an untouched game
 * still looks deliberate and two games never look identical.
 */
function CoverFallback({
  title,
  id,
  Icon,
}: {
  title: string;
  id: string;
  Icon: LucideIcon;
}) {
  const hue = [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  const initials = title
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <div
      className="absolute inset-0 grid place-items-center"
      style={{
        background: `radial-gradient(120% 120% at 20% 0%, hsl(${hue} 45% 15%) 0%, #141619 62%)`,
      }}
    >
      <span
        aria-hidden
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(135deg, #C4F82A 0 1px, transparent 1px 10px)',
        }}
      />
      <span className="relative font-display text-5xl font-extrabold tracking-tight text-text/10 select-none">
        {initials}
      </span>
      <Icon className="absolute bottom-3 right-3 w-5 h-5 text-lime/25" aria-hidden />
    </div>
  );
}
