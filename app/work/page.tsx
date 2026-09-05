import type { Metadata } from 'next';
import { supabase } from '@/utils/supabase/client';
import WorkGrid from '@/components/WorkGrid';
import { SiteHeader, SiteFooter } from '@/components/SiteChrome';
import { getProfile, resolveProfile } from '@/lib/profile';
import type { Tool } from '@/types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Work',
  description:
    'Web apps, 3D websites, Android apps and tools by Farhan Shahriar, a full-stack ' +
    'developer in Bangladesh — most of them playable in your browser.',
  alternates: { canonical: '/work' },
};

export default async function WorkPage() {
  // select('*') and sort in JS so the page still renders if the database has
  // not had every migration column applied yet.
  const [{ data: rows }, profile] = await Promise.all([
    supabase.from('tools').select('*').order('created_at', { ascending: false }),
    getProfile(),
  ]);

  const p = resolveProfile(profile);

  const projects = ((rows ?? []) as Tool[])
    .filter((t) => t.is_published !== false)
    .map((t) => ({ ...t, category: t.category ?? 'game', tech: t.tech ?? [], tags: t.tags ?? [] }))
    .sort(
      (a, b) =>
        Number(b.is_featured ?? false) - Number(a.is_featured ?? false) ||
        (b.sort_order ?? 0) - (a.sort_order ?? 0) ||
        (b.created_at ?? '').localeCompare(a.created_at ?? ''),
    );

  return (
    <div className="min-h-screen bg-ink text-text">
      <SiteHeader name={p.name} />

      <section className="relative overflow-hidden border-b border-hairline">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 h-[26rem] w-[26rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-lime/[0.06] blur-[120px]"
        />
        <div className="relative mx-auto max-w-6xl px-6 py-16 md:py-24">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-lime">
            Portfolio
          </p>
          <h1 className="font-display text-4xl font-extrabold tracking-tight md:text-6xl">
            Selected work
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-muted">
            Games, web apps, Android apps and tools. Pick any one to see what it is and how it
            was built — most of them you can open and use straight away.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12 md:py-16">
        <WorkGrid projects={projects} />
      </section>

      <SiteFooter name={p.name} current="work" />
    </div>
  );
}
