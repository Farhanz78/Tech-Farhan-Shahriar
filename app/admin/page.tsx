
'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase/client';
import Link from 'next/link';
import * as icons from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Tool } from '@/types';

export default function AdminPage() {
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const router = useRouter();

    // Login Form State
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    // Dashboard State
    const [activeTab, setActiveTab] = useState<'deploy' | 'manage' | 'profile'>('deploy');

    // Deploy/Edit Tool State
    const [title, setTitle] = useState('');
    const [iconName, setIconName] = useState('Code');
    const [htmlCode, setHtmlCode] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);

    // Manage Tools State
    const [tools, setTools] = useState<Tool[]>([]);
    const [refreshTools, setRefreshTools] = useState(0);

    // Profile State
    const [fullName, setFullName] = useState('');
    const [skills, setSkills] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [uploading, setUploading] = useState(false);

    // AUTH & INITIALIZATION EFFECT
    useEffect(() => {
        let mounted = true;

        async function checkSession() {
            try {
                // 1. Get initial session
                const { data: { session } } = await supabase.auth.getSession();

                if (mounted) {
                    if (session?.user) {
                        await verifyAdmin(session.user.id);
                    } else {
                        setLoading(false);
                    }
                }
            } catch (e) {
                console.error("Session check error:", e);
                if (mounted) setLoading(false);
            }
        }

        checkSession();

        // 2. Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!mounted) return;

            if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
                if (session?.user) {
                    setLoading(true);
                    await verifyAdmin(session.user.id);
                }
            } else if (event === 'SIGNED_OUT') {
                setLoading(false);
                setIsAdmin(false);
                // Redirect home isn't strictly necessary here as we render login form if !isAdmin
                // but let's just reset state to be safe
            }
        });

        // Cleanup function
        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []);

    // FETCH TOOLS EFFECT
    useEffect(() => {
        if (isAdmin && activeTab === 'manage') {
            supabase.from('tools').select('*').order('created_at', { ascending: false })
                .then(({ data }) => setTools(data || []));
        }
    }, [isAdmin, activeTab, refreshTools]);

    // FETCH PROFILE EFFECT
    useEffect(() => {
        if (isAdmin && activeTab === 'profile') {
            supabase.auth.getUser().then(({ data: { user } }) => {
                if (user) {
                    supabase.from('profiles').select('*').eq('id', user.id).single()
                        .then(({ data }) => {
                            if (data) {
                                setFullName(data.full_name || '');
                                setSkills(data.skills?.join(', ') || '');
                                setAvatarUrl(data.avatar_url || '');
                            }
                        });
                }
            });
        }
    }, [isAdmin, activeTab]);

    async function verifyAdmin(userId: string) {
        return new Promise<void>(async (resolve) => {
            // Force stop loading after 5 seconds no matter what
            const timeoutId = setTimeout(() => {
                console.warn("verifyAdmin timed out");
                setLoading(false);
                resolve();
            }, 5000);

            try {
                const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single();
                if (profile?.role === 'admin') setIsAdmin(true);
            } catch (err) {
                console.error(err);
            } finally {
                clearTimeout(timeoutId);
                setLoading(false);
                resolve();
            }
        });
    }

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            alert(error.message);
            setSubmitting(false);
        } else {
            console.log("Login successful, verifying admin...");
            if (data.session?.user) await verifyAdmin(data.session.user.id);
            router.refresh();
        }
    };


    const handleDeploy = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            if (editingId) {
                // Update existing tool
                const { error } = await supabase.from('tools').update({
                    title, icon_name: iconName, html_code: htmlCode
                }).eq('id', editingId);
                if (error) throw error;
                alert('Tool updated successfully!');
                setEditingId(null);
            } else {
                // Create new tool
                const { error } = await supabase.from('tools').insert({
                    title, icon_name: iconName, html_code: htmlCode
                });
                if (error) throw error;
                alert('Tool added successfully!');
            }
            // Reset form
            setTitle(''); setIconName('Code'); setHtmlCode('');
            // If we were editing, stick to deploy tab, or maybe switch to manage? 
            // Let's stay on deploy form which acts as edit form now.
        } catch (err) {
            alert('Error saving tool: ' + (err as Error).message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleEditTool = (tool: Tool) => {
        setTitle(tool.title);
        setIconName(tool.icon_name);
        setHtmlCode(tool.html_code);
        setEditingId(tool.id);
        setActiveTab('deploy');
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setTitle('');
        setIconName('Code');
        setHtmlCode('');
    };

    const handleDeleteTool = async (id: string) => {
        if (!confirm('Are you sure used want to delete this tool?')) return;
        const { error } = await supabase.from('tools').delete().eq('id', id);
        if (error) alert(error.message);
        else setRefreshTools(prev => prev + 1);
    };

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const skillsArray = skills.split(',').map(s => s.trim()).filter(Boolean);
        const { error } = await supabase.from('profiles').update({
            full_name: fullName, skills: skillsArray, avatar_url: avatarUrl
        }).eq('id', user.id);
        setSubmitting(false);
        if (error) alert(error.message);
        else alert('Profile updated!');
    };

    const handleUploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
        try {
            setUploading(true);
            if (!e.target.files || e.target.files.length === 0) throw new Error('Select an image.');
            const file = e.target.files[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file);
            if (uploadError) throw uploadError;
            const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
            setAvatarUrl(data.publicUrl);
        } catch (error) {
            alert((error as Error).message);
        } finally {
            setUploading(false);
        }
    };


    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const IconPreview = (icons as any)[iconName] || icons.HelpCircle;

    if (loading) return (
        <div className="min-h-screen bg-black flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
    );

    if (!isAdmin) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 relative overflow-hidden" suppressHydrationWarning>
                <div className="absolute top-0 left-0 w-96 h-96 bg-violet-600/20 rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2" />
                <div className="absolute bottom-0 right-0 w-96 h-96 bg-fuchsia-600/20 rounded-full blur-[120px] translate-x-1/2 translate-y-1/2" />
                <div className="w-full max-w-md bg-stone-900/50 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl z-10">
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent mb-2">Admin Access</h1>
                        <p className="text-neutral-400 text-sm">Enter your credentials.</p>
                    </div>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" className="w-full bg-neutral-900/50 border border-neutral-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-violet-500 outline-none" required />
                        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full bg-neutral-900/50 border border-neutral-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-violet-500 outline-none" required />
                        <button type="submit" disabled={submitting} className="w-full bg-white text-black font-semibold py-3 rounded-xl hover:bg-neutral-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                            {submitting ? 'Signing In...' : 'Sign In'} <icons.ArrowRight className="w-4 h-4" />
                        </button>
                    </form>
                    <div className="mt-8 pt-6 border-t border-white/5 text-center">
                        <Link href="/" className="text-sm text-neutral-500 hover:text-white transition-colors flex items-center justify-center gap-2 group">
                            <icons.ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to Portfolio
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white selection:bg-violet-500/30 font-sans">
            <nav className="border-b border-white/10 bg-black/50 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
                    <span className="font-bold text-lg tracking-tight">Admin Dashboard</span>
                    <div className="flex items-center gap-4">
                        <Link href="/" className="text-sm bg-white/5 hover:bg-white/10 px-4 py-2 rounded-full transition-colors border border-white/5">View Site</Link>
                        <button onClick={() => supabase.auth.signOut().then(() => router.push('/'))} className="text-sm text-red-400 hover:text-red-300">Sign Out</button>
                    </div>
                </div>
            </nav>

            <div className="max-w-4xl mx-auto p-6 md:p-12">
                <div className="flex gap-4 mb-8 border-b border-white/10 pb-4">
                    <button onClick={() => setActiveTab('deploy')} className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${activeTab === 'deploy' ? 'bg-violet-600 text-white' : 'text-neutral-400 hover:text-white hover:bg-white/5'}`}>
                        <icons.Rocket className="w-4 h-4" /> Deploy
                    </button>
                    <button onClick={() => setActiveTab('manage')} className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${activeTab === 'manage' ? 'bg-violet-600 text-white' : 'text-neutral-400 hover:text-white hover:bg-white/5'}`}>
                        <icons.List className="w-4 h-4" /> Manage Tools
                    </button>
                    <button onClick={() => setActiveTab('profile')} className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${activeTab === 'profile' ? 'bg-violet-600 text-white' : 'text-neutral-400 hover:text-white hover:bg-white/5'}`}>
                        <icons.User className="w-4 h-4" /> Profile
                    </button>
                </div>

                {activeTab === 'deploy' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="mb-10 space-y-2">
                            <h1 className="text-4xl font-bold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                                {editingId ? 'Edit Tool' : 'Deploy New Tool'}
                            </h1>
                            <p className="text-neutral-400 text-lg">
                                {editingId ? 'Update your existing micro-app.' : 'Add a new HTML micro-app to your portfolio.'}
                            </p>
                        </div>
                        <form onSubmit={handleDeploy} className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <label className="text-sm font-medium text-neutral-300 flex items-center gap-2"><icons.Type className="w-4 h-4 text-violet-500" /> Tool Title</label>
                                    <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required className="w-full bg-neutral-900/50 border border-neutral-800 rounded-xl px-4 py-3 focus:ring-2 focus:ring-violet-500 outline-none" placeholder="e.g. Percentage Calculator" />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-sm font-medium text-neutral-300 flex items-center gap-2"><icons.Image className="w-4 h-4 text-fuchsia-500" /> Icon Name</label>
                                    <div className="flex gap-4">
                                        <div className="relative flex-1">
                                            <input type="text" value={iconName} onChange={(e) => setIconName(e.target.value)} required className="w-full bg-neutral-900/50 border border-neutral-800 rounded-xl px-4 py-3 focus:ring-2 focus:ring-violet-500 outline-none" placeholder="e.g. Calculator" />
                                            <a href="https://lucide.dev/icons" target="_blank" className="absolute right-3 top-3.5 text-xs text-neutral-500 hover:text-white">Browse Icons</a>
                                        </div>
                                        <div className="w-12 h-12 shrink-0 bg-neutral-900 border border-neutral-800 rounded-xl flex items-center justify-center shadow-lg shadow-violet-900/20"><IconPreview className="w-6 h-6 text-white" /></div>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <label className="text-sm font-medium text-neutral-300 flex items-center gap-2"><icons.Code className="w-4 h-4 text-emerald-500" /> HTML Source Code</label>
                                <textarea value={htmlCode} onChange={(e) => setHtmlCode(e.target.value)} required rows={15} className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-4 font-mono text-sm text-neutral-300 focus:ring-2 focus:ring-violet-500 outline-none resize-y" placeholder="<!DOCTYPE html>..." />
                            </div>
                            <div className="pt-4 flex justify-between items-center">
                                {editingId && (
                                    <button type="button" onClick={handleCancelEdit} className="text-neutral-400 hover:text-white underline">
                                        Cancel Edit
                                    </button>
                                )}
                                <button type="submit" disabled={submitting} className="px-8 py-4 bg-white text-black font-bold rounded-xl hover:bg-neutral-200 transition-all shadow-xl shadow-white/5 disabled:opacity-50 flex items-center gap-2">
                                    {submitting ? 'Saving...' : <><icons.Rocket className="w-5 h-5" /> {editingId ? 'Update Tool' : 'Deploy Tool'}</>}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {activeTab === 'manage' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <h1 className="text-3xl font-bold mb-6">Manage Tools</h1>
                        <div className="grid gap-4">
                            {tools.map((tool) => (
                                <div key={tool.id} className="bg-neutral-900/50 border border-neutral-800 p-4 rounded-xl flex items-center justify-between group hover:border-violet-500/30 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2 bg-neutral-800 rounded-lg text-violet-400">
                                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                            {(icons as any)[tool.icon_name] ? React.createElement((icons as any)[tool.icon_name], { size: 20 }) : <icons.Code size={20} />}
                                        </div>
                                        <span className="font-semibold text-lg">{tool.title}</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <Link href={`/play/${tool.id}`} target="_blank" className="p-2 hover:bg-white/10 rounded-lg text-neutral-400 hover:text-white"><icons.ExternalLink className="w-5 h-5" /></Link>
                                        <button onClick={() => handleEditTool(tool)} className="p-2 hover:bg-violet-500/20 rounded-lg text-violet-500 hover:text-violet-400"><icons.Edit className="w-5 h-5" /></button>
                                        <button onClick={() => handleDeleteTool(tool.id)} className="p-2 hover:bg-red-500/20 rounded-lg text-red-500 hover:text-red-400"><icons.Trash2 className="w-5 h-5" /></button>
                                    </div>
                                </div>
                            ))}
                            {tools.length === 0 && <p className="text-neutral-500 text-center py-10">No tools found.</p>}
                        </div>
                    </div>
                )}

                {activeTab === 'profile' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl">
                        <h1 className="text-3xl font-bold mb-6">Edit Profile</h1>
                        <form onSubmit={handleUpdateProfile} className="space-y-6">
                            <div className="flex items-center gap-6 mb-8">
                                <div className="relative w-24 h-24 rounded-full overflow-hidden bg-neutral-800 border-2 border-neutral-700">
                                    {avatarUrl ? <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-neutral-600"><icons.User className="w-10 h-10" /></div>}
                                </div>
                                <label className="block px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg cursor-pointer transition-colors text-sm font-medium">
                                    {uploading ? 'Uploading...' : 'Upload New Photo'}
                                    <input type="file" className="hidden" accept="image/*" onChange={handleUploadAvatar} disabled={uploading} />
                                </label>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-neutral-400">Display Name</label>
                                <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 outline-none focus:border-violet-500 transition-colors" placeholder="Your Name" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-neutral-400">Skills (comma separated)</label>
                                <input type="text" value={skills} onChange={(e) => setSkills(e.target.value)} className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 outline-none focus:border-violet-500 transition-colors" placeholder="React, Next.js, Python..." />
                            </div>
                            <button type="submit" disabled={submitting} className="px-6 py-3 bg-white text-black font-bold rounded-xl hover:bg-neutral-200 transition-colors disabled:opacity-50">{submitting ? 'Saving...' : 'Save Profile'}</button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
}
