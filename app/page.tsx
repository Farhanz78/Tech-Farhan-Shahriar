
import { supabase } from '@/utils/supabase/client';
import ToolCard from '@/components/ToolCard';
import { Tool } from '@/types';

// Force dynamic rendering to always get latest tools
export const revalidate = 0;

export default async function Home() {
  const { data: tools } = await supabase
    .from('tools')
    .select('*')
    .order('created_at', { ascending: false });

  // FETCH PROFILE (Assuming single user/admin site, just fetch the first one or specific ID if known)
  // For this single-user portfolio, we'll fetch the first profile found or a specific admin one. 
  // Ideally, you'd know your Admin ID, but let's just grab the first admin found.
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'admin')
    .limit(1)
    .single();

  const displayName = profile?.full_name || "Your Name";
  const avatar = profile?.avatar_url || "/me.jpg";
  const skillsList = profile?.skills || ["Next.js", "Supabase", "React", "TypeScript"];

  return (
    <div className="min-h-screen bg-black text-white selection:bg-violet-500/30">
      {/* HERO SECTION */}
      <section className="relative px-6 py-24 md:py-32 max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-12">

        {/* Abstract Backgrounds */}
        <div className="absolute top-20 left-20 w-72 h-72 bg-violet-600/30 rounded-full blur-[100px] -z-10 animate-pulse" />
        <div className="absolute bottom-20 right-20 w-72 h-72 bg-fuchsia-600/30 rounded-full blur-[100px] -z-10 animate-pulse delay-700" />

        <div className="md:w-1/3 flex justify-center">
          <div className="relative w-48 h-48 md:w-64 md:h-64 rounded-full p-1 bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-2xl shadow-violet-500/20">
            <div className="w-full h-full rounded-full overflow-hidden bg-black border-4 border-black relative">
              <img
                src={avatar}
                alt="Developer"
                className="w-full h-full object-cover hover:scale-110 transition-transform duration-500"
              />
            </div>
          </div>
        </div>

        <div className="md:w-2/3 text-center md:text-left space-y-6">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
            Hi, I'm <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">{displayName}</span>
          </h1>
          <p className="text-xl text-neutral-400 leading-relaxed max-w-2xl mx-auto md:mx-0">
            A passionate developer building <span className="text-white font-medium">dynamic web experiences</span>.
            Explore my mini-tools and experiments below.
          </p>

          <div className="flex flex-wrap gap-3 justify-center md:justify-start">
            {skillsList.map((skill: string) => (
              <span key={skill} className="px-4 py-2 bg-white/5 border border-white/10 rounded-full text-sm font-medium hover:bg-white/10 hover:scale-105 transition-all cursor-default">
                {skill}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Tools Grid Section */}
      <section>
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-violet-500"></span>
            Deployed Tools
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tools?.map((tool) => (
            <ToolCard key={tool.id} tool={tool as Tool} />
          ))}

          {(!tools || tools.length === 0) && (
            <div className="col-span-full flex flex-col items-center justify-center p-20 border border-dashed border-neutral-800 rounded-2xl bg-neutral-900/20 text-neutral-500">
              <p className="text-lg">No tools available yet.</p>
              <a href="/admin" className="mt-4 px-6 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors font-medium">
                Go to Admin Panel
              </a>
            </div>
          )}
        </div>
      </section>
    </div>

  );
}
