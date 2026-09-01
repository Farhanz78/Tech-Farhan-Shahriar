import { supabase } from '@/utils/supabase/client';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import GameFrame from '@/components/GameFrame';
import { gameDocumentUrl } from '@/lib/storage';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const { data } = await supabase.from('tools').select('*').eq('id', id).single();

  if (!data) return { title: 'Not found' };
  return {
    title: data.title,
    description: data.description ?? undefined,
    robots: { index: false, follow: true },
  };
}

export default async function PlayPage({ params }: PageProps) {
  const { id } = await params;

  // select('*') for the same reason as app/g/[id]/route.ts: the page must keep
  // working before supabase_migration.sql has been applied.
  const { data: tool, error } = await supabase
    .from('tools')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !tool) notFound();
  if (tool.is_published === false) notFound();

  // Both kinds are served through /g/[id]: inline rows because a blob: URL
  // would run as this origin, bundle rows because Supabase Storage refuses to
  // serve text/html. See app/g/[id]/route.ts.
  // kind is absent pre-migration, in which case every row is inline HTML.
  const hasPayload = tool.kind === 'bundle' ? !!tool.storage_path : !!tool.html_code;
  if (!hasPayload) notFound();

  return (
    <GameFrame
      id={tool.id}
      src={gameDocumentUrl(tool.id)}
      title={tool.title}
      thumbnail={tool.thumbnail_url}
    />
  );
}
