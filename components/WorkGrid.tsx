'use client';

import { useMemo, useState } from 'react';
import * as icons from 'lucide-react';
import type { Tool, ToolCategory } from '@/types';
import { CATEGORY_LABEL } from '@/types';
import ProjectModal from './ProjectModal';

const ORDER: ToolCategory[] = ['game', 'web', 'mobile', 'tool'];

/**
 * The work browser: category filter + grid + the project popup.
 *
 * Cards deliberately do NOT navigate on click. They open a dialog with the
 * full description first, and the dialog's button is what leaves the page --
 * and that button's label is editable per project from the admin panel.
 */
export default function WorkGrid({ projects }: { projects: Tool[] }) {
  const [active, setActive] = useState<ToolCategory | 'all'>('all');
  const [open, setOpen] = useState<Tool | null>(null);

  const present = useMemo(
    () => ORDER.filter((c) => projects.some((p) => p.category === c)),
    [projects],
  );

  const shown = useMemo(
    () => (active === 'all' ? projects : projects.filter((p) => p.category === active)),
    [projects, active],
  );

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of projects) m.set(p.category, (m.get(p.category) ?? 0) + 1);
    return m;
  }, [projects]);

  if (!projects.length) {
    return (
      <div className="rounded-2xl border border-dashed border-hairline bg-surface/40 px-6 py-20 text-center">
        <icons.Sparkles className="mx-auto mb-4 h-8 w-8 text-hairline-strong" aria-hidden />
        <p className="text-lg font-semibold">New work is on the way</p>
        <p className="mt-1 text-sm text-muted">Check back soon — there&apos;s more in progress.</p>
      </div>
    );
  }

  return (
    <>
      {present.length > 1 && (
        <div className="mb-8 flex flex-wrap gap-2">
          <FilterChip
            label="All"
            count={projects.length}
            active={active === 'all'}
            onClick={() => setActive('all')}
          />
          {present.map((c) => (
            <FilterChip
              key={c}
              label={CATEGORY_LABEL[c]}
              count={counts.get(c) ?? 0}
              active={active === c}
              onClick={() => setActive(c)}
            />
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((p, i) => (
          <ProjectCard key={p.id} tool={p} priority={i < 3} onOpen={() => setOpen(p)} />
        ))}
      </div>

      {open && <ProjectModal tool={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-4 py-2 text-sm transition-colors ${
        active
          ? 'border-lime bg-lime text-ink font-semibold'
          : 'border-hairline bg-surface text-muted hover:border-lime/40 hover:text-text'
      }`}
    >
      {label}
      <span className={active ? 'ml-1.5 text-ink/60' : 'ml-1.5 text-subtle'}>{count}</span>
    </button>
  );
}

function ProjectCard({
  tool,
  priority,
  onOpen,
}: {
  tool: Tool;
  priority: boolean;
  onOpen: () => void;
}) {
  const Icon =
    (tool.icon_name && (icons as unknown as Record<string, icons.LucideIcon>)[tool.icon_name]) ||
    icons.Gamepad2;

  const hue = [...tool.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  const initials = tool.title
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <button
      onClick={onOpen}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-hairline bg-surface text-left transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-1 hover:border-lime/40 hover:shadow-[0_18px_44px_-16px_rgba(0,0,0,0.9)] motion-reduce:hover:translate-y-0"
    >
      <div className="relative aspect-video overflow-hidden bg-surface-2">
        {tool.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={tool.thumbnail_url}
            alt=""
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.045] motion-reduce:group-hover:scale-100"
          />
        ) : (
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
            <span className="relative select-none font-display text-5xl font-extrabold tracking-tight text-text/10">
              {initials}
            </span>
            <Icon className="absolute bottom-3 right-3 h-5 w-5 text-lime/25" aria-hidden />
          </div>
        )}

        {tool.is_featured && (
          <span className="absolute left-3 top-3 z-10 rounded-full bg-amber px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-ink">
            Featured
          </span>
        )}

        <div className="absolute inset-0 grid place-items-center bg-ink/55 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
          <span className="inline-flex translate-y-1.5 items-center gap-2 rounded-full bg-lime px-5 py-2.5 text-sm font-semibold text-ink transition-transform duration-200 group-hover:translate-y-0 motion-reduce:translate-y-0">
            <icons.Eye className="h-4 w-4" aria-hidden />
            View details
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-[17px] font-semibold leading-snug transition-colors group-hover:text-lime">
            {tool.title}
          </h3>
          <span className="shrink-0 rounded-md bg-surface-2 px-2 py-0.5 text-[10px] uppercase tracking-wide text-subtle">
            {CATEGORY_LABEL[tool.category] ?? 'Project'}
          </span>
        </div>

        {tool.description && (
          <p className="line-clamp-2 text-sm leading-relaxed text-muted">{tool.description}</p>
        )}

        {tool.tech?.length > 0 && (
          <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
            {tool.tech.slice(0, 3).map((t) => (
              <span
                key={t}
                className="rounded-md border border-hairline bg-surface-2 px-2 py-0.5 text-[11px] text-subtle"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}
