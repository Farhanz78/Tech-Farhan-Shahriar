'use client';

import { useEffect, useRef } from 'react';
import * as icons from 'lucide-react';
import type { Tool } from '@/types';
import { CATEGORY_LABEL } from '@/types';

/** Where the popup's button sends the visitor, and what it says by default. */
export function projectTarget(tool: Tool): { href: string; external: boolean; label: string } {
  if (tool.kind === 'link' && tool.external_url) {
    return {
      href: tool.external_url,
      external: true,
      label: tool.cta_label?.trim() || 'Open project',
    };
  }
  return {
    href: `/play/${tool.id}`,
    external: false,
    label: tool.cta_label?.trim() || (tool.category === 'game' ? 'Play now' : 'Open project'),
  };
}

export default function ProjectModal({ tool, onClose }: { tool: Tool; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const { href, external, label } = projectTarget(tool);

  useEffect(() => {
    closeRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key !== 'Tab') return;
      // Keep focus inside the dialog while it is open.
      const nodes = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled])',
      );
      if (!nodes?.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const Icon =
    (tool.icon_name && (icons as unknown as Record<string, icons.LucideIcon>)[tool.icon_name]) ||
    icons.Gamepad2;

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-modal-title"
    >
      <button
        className="absolute inset-0 bg-ink/92 animate-fade cursor-default"
        onClick={onClose}
        aria-label="Close"
        tabIndex={-1}
      />

      <div
        ref={panelRef}
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-hairline bg-surface shadow-2xl animate-rise max-h-[90vh] overflow-y-auto"
      >
        <div className="relative aspect-video bg-surface-2">
          {tool.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={tool.thumbnail_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center">
              <Icon className="h-10 w-10 text-lime/30" aria-hidden />
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent" />

          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 rounded-lg border border-hairline bg-ink/70 p-2 text-muted backdrop-blur-sm transition-colors hover:text-text"
          >
            <icons.X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="space-y-4 p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-lime/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-lime">
              {CATEGORY_LABEL[tool.category] ?? 'Project'}
            </span>
            {tool.year && <span className="text-xs text-subtle">{tool.year}</span>}
            {tool.play_count > 0 && (
              <span className="flex items-center gap-1 text-xs text-subtle">
                <icons.Play className="h-3 w-3" aria-hidden />
                {tool.play_count.toLocaleString()} plays
              </span>
            )}
          </div>

          <h2 id="project-modal-title" className="font-display text-2xl font-extrabold">
            {tool.title}
          </h2>

          {tool.description && (
            <p className="text-sm leading-relaxed text-muted whitespace-pre-line">
              {tool.description}
            </p>
          )}

          {tool.role_note && (
            <p className="text-sm leading-relaxed text-subtle">
              <span className="text-muted">My role: </span>
              {tool.role_note}
            </p>
          )}

          {tool.tech?.length > 0 && (
            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-subtle">Built with</p>
              <div className="flex flex-wrap gap-1.5">
                {tool.tech.map((t) => (
                  <span
                    key={t}
                    className="rounded-md border border-hairline bg-surface-2 px-2 py-0.5 text-[11px] text-muted"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3 pt-1">
            <a
              href={href}
              {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-lime px-6 py-3 font-semibold text-ink transition-colors hover:bg-lime-dim"
            >
              {label}
              {external ? (
                <icons.ExternalLink className="h-4 w-4" aria-hidden />
              ) : (
                <icons.ArrowRight className="h-4 w-4" aria-hidden />
              )}
            </a>

            {tool.source_url && (
              <a
                href={tool.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-hairline px-4 py-3 text-sm text-muted transition-colors hover:border-lime/40 hover:text-text"
              >
                <icons.Code className="h-4 w-4" aria-hidden />
                Source
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
