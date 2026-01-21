
'use client';

import { useEffect, useState } from 'react';
import * as icons from 'lucide-react';
import Link from 'next/link';

interface ToolRunnerProps {
    htmlCode: string;
    title: string;
    iconName: string;
}

export default function ToolRunner({ htmlCode, title, iconName }: ToolRunnerProps) {
    const [blobUrl, setBlobUrl] = useState<string>('');

    useEffect(() => {
        // 1. INJECT ANTI-THEFT SCRIPT
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

        // 2. COMBINE CODE
        const secureHtml = htmlCode + antiTheftScript;

        // 3. CREATE BLOB
        const blob = new Blob([secureHtml], { type: 'text/html' });
        const url = URL.createObjectURL(blob);

        setBlobUrl(url);

        // Cleanup
        return () => {
            URL.revokeObjectURL(url);
        };
    }, [htmlCode]);

    const Icon = (icons as any)[iconName] || icons.Code;

    if (!blobUrl) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 w-screen h-screen bg-black overflow-hidden">
            {/* SANDBOXED IFRAME */}
            <iframe
                src={blobUrl}
                className="w-full h-full border-0 block"
                title={title}
                sandbox="allow-scripts allow-downloads allow-forms allow-pointer-lock allow-popups allow-modals allow-same-origin"
                referrerPolicy="no-referrer"
            />
        </div>
    );
}
