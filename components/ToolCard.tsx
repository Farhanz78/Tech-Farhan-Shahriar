
import * as icons from 'lucide-react';
import { Tool } from '@/types';

export default function ToolCard({ tool, index = 0 }: { tool: Tool; index?: number }) {
    // Fallback to 'Code' icon if name not found
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const IconComponent = (icons as any)[tool.icon_name] || icons.Code;

    return (
        <a
            href={`/play/${tool.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block group h-full animate-float"
            style={{ animationDelay: `-${index * 1.5}s` }}
        >
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 hover:border-violet-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-violet-500/10 h-full flex flex-col justify-between gap-4">
                <div className="flex items-start justify-between w-full">
                    <div className="p-3 bg-neutral-800 rounded-xl group-hover:bg-violet-500/20 group-hover:text-violet-400 transition-colors">
                        <IconComponent className="w-6 h-6" />
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity text-neutral-500">
                        <icons.ArrowUpRight className="w-5 h-5" />
                    </div>
                </div>

                <div>
                    <h3 className="text-xl font-bold text-neutral-100 mb-1">{tool.title}</h3>
                    <p className="text-sm text-neutral-400">Run this tool</p>
                </div>
            </div>
        </a>
    );
}
