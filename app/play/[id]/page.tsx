
import { supabase } from '@/utils/supabase/client';
import { notFound } from 'next/navigation';
import ToolRunner from '@/components/ToolRunner';

// Next.js 15: params is a Promise
interface PageProps {
    params: Promise<{ id: string }>;
}

export const revalidate = 0;

export default async function ToolPage({ params }: PageProps) {
    const { id } = await params;

    // Fetch the raw HTML code
    const { data: tool, error } = await supabase
        .from('tools')
        .select('*')
        .eq('id', id)
        .single();

    if (error || !tool) {
        return notFound(); // Show 404 if tool doesn't exist
    }

    return <ToolRunner htmlCode={tool.html_code} title={tool.title} iconName={tool.icon_name} />;
}
