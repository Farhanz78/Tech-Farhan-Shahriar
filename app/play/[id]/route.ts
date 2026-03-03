import { supabase } from '@/utils/supabase/client';
import { NextResponse } from 'next/server';

export const revalidate = 0;

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    // Fetch the raw HTML code
    const { data: tool, error } = await supabase
        .from('tools')
        .select('*')
        .eq('id', id)
        .single();

    if (error || !tool) {
        return new NextResponse('Not Found', { status: 404 });
    }

    const antiTheftScript = `
    <script>
        document.addEventListener('contextmenu', event => event.preventDefault());
        document.addEventListener('keydown', function(event) {
            if (event.key === 'F12' || 
                (event.ctrlKey && event.shiftKey && event.key === 'I') || 
                (event.ctrlKey && event.key === 'u')) {
                event.preventDefault();
            }
        });
        // Clear console to hide errors/logs from users trying to inspect
        console.clear();
    </script>
    `;

    const secureHtml = tool.html_code + antiTheftScript;

    return new NextResponse(secureHtml, {
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
        },
    });
}
