'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as icons from 'lucide-react';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '@/utils/supabase/client';
import ImageCropper from '@/components/ImageCropper';
import { readZip, describeZipError } from '@/lib/game-upload/read-zip';
import {
  normalizeZipFiles,
  normalizePickedFiles,
  findRootRelativeRefs,
  type EntryReason,
} from '@/lib/game-upload/normalize';
import { blobFor } from '@/lib/game-upload/mime';
import {
  uploadGameFiles,
  removeGameFiles,
  formatBytes,
  GAMES_BUCKET,
  type UploadItem,
  type UploadProgress,
} from '@/lib/game-upload/upload';
import type { Tool, Message, ToolCategory } from '@/types';

type Tab = 'deploy' | 'manage' | 'messages' | 'profile';
type Mode = 'zip' | 'folder' | 'paste' | 'link';

type Staged = {
  items: UploadItem[];
  entryPath: string;
  entryReason: EntryReason;
  htmlCandidates: string[];
  totalBytes: number;
  strippedRoot: string | null;
  rejectedCount: number;
  warnings: string[];
};

const EMPTY_META = {
  title: '',
  description: '',
  category: 'game' as ToolCategory,
  tags: '',
  tech: '',
  iconName: 'Gamepad2',
  thumbnailUrl: '',
  ctaLabel: '',
  roleNote: '',
  externalUrl: '',
  sourceUrl: '',
  year: '',
};

const CATEGORY_OPTIONS: { value: ToolCategory; label: string }[] = [
  { value: 'game', label: 'Games' },
  { value: 'web', label: 'Web Apps' },
  { value: 'mobile', label: 'Mobile Apps' },
  { value: 'tool', label: 'Tools' },
];

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tab, setTab] = useState<Tab>('deploy');

  // ---------------------------------------------------------------- auth
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState('');

  const verifyAdmin = useCallback(async (userId: string) => {
    // Every call is guarded: supabase-js normally returns {data, error}, but a
    // network failure can still throw, and an uncaught throw here used to leave
    // the page spinning forever because setLoading(false) never ran.
    try {
      // Prefer the RPC (exists after the migration); fall back to reading the
      // profile row so this page still works on an un-migrated database.
      const rpc = await supabase.rpc('is_admin');
      if (!rpc.error && typeof rpc.data === 'boolean') return rpc.data;
    } catch (e) {
      console.error('[admin] is_admin rpc failed:', e);
    }
    try {
      const { data } = await supabase.from('profiles').select('role').eq('id', userId).single();
      return data?.role === 'admin';
    } catch (e) {
      console.error('[admin] profile lookup failed:', e);
      return false;
    }
  }, []);

  useEffect(() => {
    let alive = true;

    // Hard ceiling on the loading state. If Supabase is slow, paused, blocked by
    // an adblocker/network, or throws somewhere unexpected, the page falls back to the sign-in
    // form instead of spinning forever.
    const bail = setTimeout(() => {
      if (alive) setLoading(false);
    }, 2500);

    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) console.error('[admin] getSession error:', error);
        
        if (!alive) return;
        
        if (session?.user) {
          const ok = await verifyAdmin(session.user.id);
          if (alive) setIsAdmin(ok);
        }
      } catch (e) {
        console.error('[admin] session check failed:', e);
      } finally {
        if (alive) {
          clearTimeout(bail);
          setLoading(false);
        }
      }
    };
    
    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!alive) return;
      if (event === 'SIGNED_OUT') {
        setIsAdmin(false);
        return;
      }
      if (session?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
        const ok = await verifyAdmin(session.user.id);
        if (alive) setIsAdmin(ok);
      }
    });

    return () => {
      alive = false;
      clearTimeout(bail);
      subscription.unsubscribe();
    };
  }, [verifyAdmin]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setSigningIn(true);
    setAuthError('');

    const controller = new AbortController();
    const bail = setTimeout(() => controller.abort(), 20000);

    try {
      // Direct REST call to Supabase Auth — bypasses supabase-js and its
      // navigator.locks entirely, which is the root cause of the hang.
      const res = await fetch(
        `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ email, password }),
          signal: controller.signal,
        }
      );
      clearTimeout(bail);

      const body = await res.json();

      if (!res.ok || body.error) {
        setAuthError(body.error_description || body.msg || body.error || 'Invalid credentials.');
        setSigningIn(false);
        return;
      }

      // We have a valid session — push it into the supabase-js client so the
      // rest of the admin panel (storage uploads, RPC, etc.) works normally.
      await supabase.auth.setSession({
        access_token: body.access_token,
        refresh_token: body.refresh_token,
      });

      // Verify admin
      const ok = await verifyAdmin(body.user.id);
      setIsAdmin(ok);
      if (!ok) setAuthError('That account is not an administrator.');
    } catch (err: any) {
      clearTimeout(bail);
      if (err.name === 'AbortError') {
        setAuthError('Sign in timed out. Please refresh the page and try again.');
      } else {
        console.error('[admin] login error:', err);
        setAuthError(err?.message || 'An unexpected error occurred.');
      }
    } finally {
      setSigningIn(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-ink grid place-items-center">
        <icons.Loader2 className="w-6 h-6 text-lime animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-ink grid place-items-center p-6" suppressHydrationWarning>
        <div className="w-full max-w-md rounded-2xl border border-hairline bg-surface p-8">
          <h1 className="text-2xl font-bold mb-1">Admin</h1>
          <p className="text-sm text-subtle mb-6">Sign in to manage your projects.</p>
          <form onSubmit={handleLogin} className="space-y-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full bg-ink border border-hairline rounded-xl px-4 py-3 outline-none focus:border-lime/60"
            />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-ink border border-hairline rounded-xl px-4 py-3 outline-none focus:border-lime/60"
            />
            {authError && (
              <p className="text-sm text-danger">
                {authError}
              </p>
            )}
            <button
              type="submit"
              disabled={signingIn}
              className="w-full bg-lime text-ink font-semibold py-3 rounded-xl hover:bg-lime-dim transition-colors disabled:opacity-60"
            >
              {signingIn ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
          <Link
            href="/"
            className="mt-6 flex items-center justify-center gap-2 text-sm text-subtle hover:text-text"
          >
            <icons.ArrowLeft className="w-4 h-4" /> Back to site
          </Link>
        </div>
      </div>
    );
  }

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'deploy', label: 'Add project', icon: icons.Upload },
    { id: 'manage', label: 'Manage', icon: icons.LayoutGrid },
    { id: 'messages', label: 'Messages', icon: icons.Mail },
    { id: 'profile', label: 'Profile', icon: icons.User },
  ];

  return (
    <div className="min-h-screen bg-ink text-text">
      <nav className="border-b border-hairline bg-ink/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="font-semibold">Dashboard</span>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-sm px-3 py-1.5 rounded-lg border border-hairline hover:border-lime/40 transition-colors"
            >
              View site
            </Link>
            <button
              onClick={() => supabase.auth.signOut().then(() => router.push('/'))}
              className="text-sm text-danger hover:opacity-80"
            >
              Sign out
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex gap-1 mb-8 border-b border-hairline">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm border-b-2 -mb-px transition-colors ${
                tab === t.id
                  ? 'border-lime text-text'
                  : 'border-transparent text-subtle hover:text-text'
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'deploy' && <DeployTab />}
        {tab === 'manage' && <ManageTab />}
        {tab === 'messages' && <MessagesTab />}
        {tab === 'profile' && <ProfileTab />}
      </div>
    </div>
  );
}

/* ========================================================================== */
/*  DEPLOY                                                                     */
/* ========================================================================== */

function DeployTab() {
  const [mode, setMode] = useState<Mode>('zip');
  const [meta, setMeta] = useState({ ...EMPTY_META });
  const [html, setHtml] = useState('');

  const [reading, setReading] = useState(false);
  const [staged, setStaged] = useState<Staged | null>(null);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');

  function reset() {
    setMeta({ ...EMPTY_META });
    setHtml('');
    setStaged(null);
    setError('');
    setProgress(null);
  }

  function buildWarnings(compressed: boolean, rootRefs: string[], reason: EntryReason) {
    const w: string[] = [];
    if (compressed) {
      w.push(
        'This build contains .gz or .br files. Those cannot be served correctly here, ' +
          'and the game will fail to start. Re-export it with compression disabled ' +
          '(or with decompression fallback turned on) and upload again.',
      );
    }
    if (rootRefs.length) {
      w.push(
        `The entry page links to ${rootRefs.length} path(s) starting with "/" ` +
          `(${rootRefs.slice(0, 3).join(', ')}). Those are rewritten automatically when ` +
          'the game is served, but if anything looks missing in-game, change them to ' +
          'relative paths in your source.',
      );
    }
    if (reason === 'ambiguous') {
      w.push('Several HTML files were found. Confirm which one starts the game.');
    }
    return w;
  }

  async function onZip(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setReading(true);
    setError('');
    setStaged(null);
    try {
      const raw = await readZip(file);
      const n = normalizeZipFiles(raw);
      if (!n.entryPath) {
        setError('No HTML file was found inside that archive.');
        return;
      }

      // Auto-fill metadata if portfolio.json is present
      const metaFile = n.files.find((f) => f.path === 'portfolio.json' || f.path.endsWith('/portfolio.json'));
      if (metaFile) {
        try {
          const metaText = new TextDecoder().decode(metaFile.bytes);
          const parsed = JSON.parse(metaText);
          setMeta((prev) => ({
            ...prev,
            title: parsed.title || prev.title,
            description: parsed.description || prev.description,
            category: parsed.category || prev.category,
            tags: parsed.tags ? (Array.isArray(parsed.tags) ? parsed.tags.join(', ') : parsed.tags) : prev.tags,
            tech: parsed.tech ? (Array.isArray(parsed.tech) ? parsed.tech.join(', ') : parsed.tech) : prev.tech,
            ctaLabel: parsed.ctaLabel || prev.ctaLabel,
          }));
        } catch (e) {
          console.warn('Could not parse portfolio.json', e);
        }
      }

      const entryFile = n.files.find((f) => f.path === n.entryPath);
      const entryText = entryFile ? new TextDecoder().decode(entryFile.bytes) : '';
      const rootRefs = findRootRelativeRefs(entryText);

      const items: UploadItem[] = n.files.map((f) => ({
        path: f.path,
        body: blobFor(f.path, f.bytes),
        size: f.bytes.byteLength,
      }));

      setStaged({
        items,
        entryPath: n.entryPath,
        entryReason: n.entryReason,
        htmlCandidates: n.htmlCandidates,
        totalBytes: items.reduce((a, i) => a + i.size, 0),
        strippedRoot: n.strippedRoot,
        rejectedCount: n.rejected.length,
        warnings: buildWarnings(n.compressedBuild, rootRefs, n.entryReason),
      });
      if (!meta.title) setMeta((m) => ({ ...m, title: file.name.replace(/\.zip$/i, '') }));
    } catch (err) {
      setError(describeZipError(err));
    } finally {
      setReading(false);
      e.target.value = '';
    }
  }

  async function onFolder(e: React.ChangeEvent<HTMLInputElement>) {
    const list = e.target.files;
    if (!list?.length) return;
    setReading(true);
    setError('');
    setStaged(null);
    try {
      const raw = Array.from(list).map((file) => ({
        path: file.webkitRelativePath || file.name,
        file,
      }));
      const n = normalizePickedFiles(raw);
      if (!n.entryPath) {
        setError('No HTML file was found in that folder.');
        return;
      }
      const entry = n.files.find((f) => f.path === n.entryPath);
      const entryText = entry ? await entry.file.text() : '';
      const rootRefs = findRootRelativeRefs(entryText);

      // File objects are lazy handles -- pass them straight through rather than
      // reading 20 MB of game assets into memory.
      const items: UploadItem[] = n.files.map((f) => ({
        path: f.path,
        body: f.file,
        size: f.file.size,
      }));

      setStaged({
        items,
        entryPath: n.entryPath,
        entryReason: n.entryReason,
        htmlCandidates: n.htmlCandidates,
        totalBytes: items.reduce((a, i) => a + i.size, 0),
        strippedRoot: n.strippedRoot,
        rejectedCount: n.rejected.length,
        warnings: buildWarnings(n.compressedBuild, rootRefs, n.entryReason),
      });
      if (!meta.title && n.strippedRoot) setMeta((m) => ({ ...m, title: n.strippedRoot! }));
    } catch (err) {
      setError((err as Error).message || 'Could not read that folder.');
    } finally {
      setReading(false);
      e.target.value = '';
    }
  }

  const csv = (s: string) =>
    s
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);

  const tagsArray = csv(meta.tags);

  /** Fields every kind of project shares. */
  const commonFields = () => ({
    title: meta.title,
    icon_name: meta.iconName || 'Gamepad2',
    category: meta.category,
    description: meta.description || null,
    thumbnail_url: meta.thumbnailUrl || null,
    tags: tagsArray,
    tech: csv(meta.tech),
    cta_label: meta.ctaLabel.trim() || null,
    role_note: meta.roleNote || null,
    source_url: meta.sourceUrl || null,
    year: meta.year ? Number(meta.year) : null,
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setDone('');
    setBusy(true);

    try {
      if (mode === 'link') {
        if (!/^https?:\/\//i.test(meta.externalUrl.trim())) {
          throw new Error('Enter the full link, starting with https://');
        }
        const { data, error: err } = await supabase
          .from('tools')
          .insert({ ...commonFields(), kind: 'link', external_url: meta.externalUrl.trim() })
          .select('id');
        if (err) throw err;
        if (!data?.length) throw new Error('Nothing was saved. Check the admin policies.');
        setDone(`"${meta.title}" is live.`);
        reset();
        return;
      }

      if (mode === 'paste') {
        if (!html.trim()) throw new Error('Paste the HTML for this project first.');
        const { data, error: err } = await supabase
          .from('tools')
          .insert({ ...commonFields(), kind: 'inline', html_code: html })
          .select('id');
        if (err) throw err;
        if (!data?.length) throw new Error('Nothing was saved. Check the admin policies.');
        setDone(`"${meta.title}" is live.`);
        reset();
        return;
      }

      if (!staged) throw new Error('Choose a .zip file or a folder first.');
      if (staged.warnings.some((w) => w.includes('.gz or .br'))) {
        throw new Error('Fix the compressed-build problem above before uploading.');
      }

      const storagePath = `g/${crypto.randomUUID()}`;
      const result = await uploadGameFiles(storagePath, staged.items, setProgress);

      if (result.failed.length) {
        setError(
          `${result.failed.length} of ${result.filesTotal} files failed to upload. ` +
            `First failure: ${result.failed[0].path} — ${result.failed[0].message}`,
        );
        return; // deliberately no DB row: a half-uploaded game must not go live
      }

      const { data, error: err } = await supabase
        .from('tools')
        .insert({
          ...commonFields(),
          kind: 'bundle',
          storage_path: storagePath,
          entry_path: staged.entryPath,
          file_count: staged.items.length,
          bundle_bytes: staged.totalBytes,
        })
        .select('id');

      if (err) {
        // Do not leave orphaned megabytes behind if the row insert is rejected.
        await removeGameFiles(storagePath).catch(() => {});
        throw err;
      }
      if (!data?.length) {
        await removeGameFiles(storagePath).catch(() => {});
        throw new Error('Nothing was saved. Check the admin policies.');
      }

      setDone(`"${meta.title}" uploaded — ${staged.items.length} files, ${formatBytes(staged.totalBytes)}.`);
      reset();
    } catch (err) {
      setError((err as Error).message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  const field =
    'w-full bg-surface border border-hairline rounded-xl px-4 py-3 outline-none focus:border-lime/60 transition-colors placeholder:text-subtle';

  return (
    <form onSubmit={submit} className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-1">Add a project</h1>
        <p className="text-subtle text-sm">
          Upload a game folder, a .zip, or paste a single HTML file.
        </p>
      </div>

      {/* mode picker */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {(
          [
            { id: 'zip', label: 'Upload .zip', hint: 'A zipped project folder', icon: icons.FileArchive },
            { id: 'folder', label: 'Upload folder', hint: 'Pick the whole folder', icon: icons.FolderUp },
            { id: 'paste', label: 'Paste HTML', hint: 'One self-contained file', icon: icons.Code },
            { id: 'link', label: 'Link only', hint: 'Play Store, client site', icon: icons.Link },
          ] as const
        ).map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => {
              setMode(m.id);
              setStaged(null);
              setError('');
            }}
            className={`text-left p-4 rounded-xl border transition-colors ${
              mode === m.id
                ? 'border-lime bg-lime/5'
                : 'border-hairline bg-surface hover:border-hairline-strong'
            }`}
          >
            <m.icon className={`w-5 h-5 mb-2 ${mode === m.id ? 'text-lime' : 'text-subtle'}`} />
            <div className="font-medium text-sm">{m.label}</div>
            <div className="text-xs text-subtle mt-0.5">{m.hint}</div>
          </button>
        ))}
      </div>

      {/* source input */}
      {mode === 'zip' && (
        <label className="block border border-dashed border-hairline rounded-xl p-8 text-center cursor-pointer hover:border-lime/40 transition-colors">
          <icons.FileArchive className="w-7 h-7 text-subtle mx-auto mb-3" />
          <span className="text-sm">{reading ? 'Reading archive…' : 'Choose a .zip file'}</span>
          <input type="file" accept=".zip" className="hidden" onChange={onZip} disabled={reading} />
        </label>
      )}

      {mode === 'folder' && (
        <label className="block border border-dashed border-hairline rounded-xl p-8 text-center cursor-pointer hover:border-lime/40 transition-colors">
          <icons.FolderUp className="w-7 h-7 text-subtle mx-auto mb-3" />
          <span className="text-sm">{reading ? 'Reading folder…' : 'Choose a game folder'}</span>
          <span className="block text-xs text-subtle mt-1">
            Your browser will ask to confirm uploading multiple files.
          </span>
          <input
            type="file"
            webkitdirectory=""
            directory=""
            multiple
            className="hidden"
            onChange={onFolder}
            disabled={reading}
          />
        </label>
      )}

      {mode === 'paste' && (
        <textarea
          value={html}
          onChange={(e) => setHtml(e.target.value)}
          rows={12}
          placeholder="<!DOCTYPE html> …"
          className={`${field} font-mono text-sm resize-y`}
        />
      )}

      {mode === 'link' && (
        <Labelled
          label="Live link"
          hint="For work that lives somewhere else — Google Play, a client's site, another game portal. Nothing is uploaded."
        >
          <input
            type="url"
            value={meta.externalUrl}
            onChange={(e) => setMeta({ ...meta, externalUrl: e.target.value })}
            className={field}
            placeholder="https://play.google.com/store/apps/details?id=…"
          />
        </Labelled>
      )}

      {/* staged summary */}
      {staged && (
        <div className="rounded-xl border border-hairline bg-surface p-5 space-y-4">
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <Stat label="Files" value={String(staged.items.length)} />
            <Stat label="Total size" value={formatBytes(staged.totalBytes)} />
            {staged.strippedRoot && <Stat label="Folder" value={staged.strippedRoot} />}
            {staged.rejectedCount > 0 && (
              <Stat label="Skipped" value={`${staged.rejectedCount} system files`} />
            )}
          </div>

          <div>
            <label className="block text-xs text-subtle mb-1.5">Starts from</label>
            {staged.htmlCandidates.length > 1 ? (
              <select
                value={staged.entryPath}
                onChange={(e) => setStaged({ ...staged, entryPath: e.target.value })}
                className={field}
              >
                {staged.htmlCandidates.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            ) : (
              <code className="text-sm text-lime">{staged.entryPath}</code>
            )}
          </div>

          {staged.warnings.map((w, i) => (
            <p key={i} className="flex items-start gap-2 text-sm text-amber">
              <icons.AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{w}</span>
            </p>
          ))}
        </div>
      )}

      {/* metadata */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Labelled label="Title">
          <input
            required
            value={meta.title}
            onChange={(e) => setMeta({ ...meta, title: e.target.value })}
            className={field}
            placeholder="Canopy Chase"
          />
        </Labelled>
        <Labelled label="Category">
          <select
            value={meta.category}
            onChange={(e) => setMeta({ ...meta, category: e.target.value as ToolCategory })}
            className={field}
          >
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </Labelled>
      </div>

      <Labelled
        label="Description"
        hint="Shown on the card and in full inside the popup when someone clicks the project."
      >
        <textarea
          rows={4}
          value={meta.description}
          onChange={(e) => setMeta({ ...meta, description: e.target.value })}
          className={`${field} resize-y`}
          placeholder="A 3D endless runner through a jungle temple. Procedural track generation, six unlockable runners, coin economy and four power-ups."
        />
      </Labelled>

      <div className="grid sm:grid-cols-2 gap-4">
        <Labelled
          label="Button text in the popup"
          hint='Leave empty for a sensible default ("Play now" for games).'
        >
          <input
            value={meta.ctaLabel}
            onChange={(e) => setMeta({ ...meta, ctaLabel: e.target.value })}
            className={field}
            placeholder="Play now"
          />
        </Labelled>
        <Labelled label="Built with" hint="Comma separated. Shown in the popup.">
          <input
            value={meta.tech}
            onChange={(e) => setMeta({ ...meta, tech: e.target.value })}
            className={field}
            placeholder="Three.js, WebGL, Supabase"
          />
        </Labelled>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Labelled label="Cover image" hint="Recommended — cards look far better with one.">
          <ThumbnailPicker
            value={meta.thumbnailUrl}
            onChange={(url) => setMeta({ ...meta, thumbnailUrl: url })}
          />
        </Labelled>
        <Labelled label="Tags" hint="Comma separated.">
          <input
            value={meta.tags}
            onChange={(e) => setMeta({ ...meta, tags: e.target.value })}
            className={field}
            placeholder="3D, Endless Runner, Mobile"
          />
        </Labelled>
      </div>

      {progress && (
        <div className="rounded-xl border border-hairline bg-surface p-5">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted truncate pr-4">{progress.current || 'Uploading…'}</span>
            <span className="text-subtle tabular-nums shrink-0">
              {progress.filesDone}/{progress.filesTotal} · {formatBytes(progress.bytesDone)}
            </span>
          </div>
          <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
            <div
              className="h-full bg-lime transition-[width] duration-200"
              style={{
                width: `${progress.bytesTotal ? (progress.bytesDone / progress.bytesTotal) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      )}

      {error && (
        <p className="flex items-start gap-2 text-sm text-danger">
          <icons.AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}
      {done && (
        <p className="flex items-center gap-2 text-sm text-success">
          <icons.Check className="w-4 h-4" /> {done}
        </p>
      )}

      <button
        type="submit"
        disabled={busy || reading}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-lime text-ink font-semibold hover:bg-lime-dim transition-colors disabled:opacity-60"
      >
        {busy ? (
          <>
            <icons.Loader2 className="w-4 h-4 animate-spin" /> Publishing…
          </>
        ) : (
          <>
            <icons.Rocket className="w-4 h-4" /> Publish
          </>
        )}
      </button>
    </form>
  );
}

function ThumbnailPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [cropSrc, setCropSrc] = useState('');

  async function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCropSrc(URL.createObjectURL(file));
    e.target.value = '';
  }

  async function upload(file: File) {
    setCropSrc('');
    setBusy(true);
    setErr('');
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const key = `thumbs/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(GAMES_BUCKET).upload(key, file, {
      upsert: true,
      cacheControl: '31536000',
    });
    if (error) setErr(error.message);
    else {
      const { data } = supabase.storage.from(GAMES_BUCKET).getPublicUrl(key);
      onChange(data.publicUrl);
    }
    setBusy(false);
  }

  return (
    <>
      <div className="flex items-center gap-3">
        <div className="w-24 h-14 rounded-lg overflow-hidden bg-surface-2 border border-hairline shrink-0 grid place-items-center">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="w-full h-full object-cover" />
          ) : (
            <icons.Image className="w-4 h-4 text-subtle" />
          )}
        </div>
        <div className="min-w-0">
          <label className="inline-block px-3 py-2 rounded-lg bg-surface-2 border border-hairline text-sm cursor-pointer hover:border-lime/40 transition-colors">
            {busy ? 'Uploading…' : value ? 'Replace' : 'Upload image'}
            <input type="file" accept="image/*" className="hidden" onChange={handleSelect} disabled={busy} />
          </label>
          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="ml-2 text-xs text-subtle hover:text-danger"
            >
              Remove
            </button>
          )}
          {err && <p className="text-xs text-danger mt-1">{err}</p>}
        </div>
      </div>
      {cropSrc && (
        <ImageCropper
          imageSrc={cropSrc}
          aspect={16 / 9}
          onCropDone={upload}
          onCancel={() => setCropSrc('')}
        />
      )}
    </>
  );
}

/* ========================================================================== */
/*  MANAGE                                                                     */
/* ========================================================================== */

function ManageTab() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState('');
  const [editing, setEditing] = useState<Tool | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    let alive = true;
    const bail = setTimeout(() => {
      if (alive) setLoading(false);
    }, 4000);
    try {
      const { data } = await supabase
        .from('tools')
        .select('*')
        .order('created_at', { ascending: false });
      if (alive) setTools((data ?? []) as Tool[]);
    } catch (e) {
      console.error('[admin] load tools failed:', e);
    } finally {
      if (alive) {
        alive = false;
        clearTimeout(bail);
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function patch(t: Tool, patchData: Partial<Tool>) {
    // .select() turns PostgREST's 204 into a 200 with the affected rows. Without
    // it a policy-blocked write returns error === null and looks like success.
    const { data, error } = await supabase
      .from('tools')
      .update(patchData)
      .eq('id', t.id)
      .select('id');
    if (error) return setNote(error.message);
    if (!data?.length)
      return setNote('That change was blocked — run supabase_migration.sql, then try again.');
    setNote('');
    load();
  }

  async function remove(t: Tool) {
    if (!confirm(`Delete "${t.title}"? This cannot be undone.`)) return;

    if (t.kind === 'bundle' && t.storage_path) {
      await removeGameFiles(t.storage_path).catch(() => {});
    }

    const { data, error } = await supabase.from('tools').delete().eq('id', t.id).select('id');
    if (error) return setNote(error.message);
    if (!data?.length) {
      // This is exactly the old silent-failure case: RLS filtered the row out,
      // PostgREST answered 204, and supabase-js reported error === null.
      return setNote(
        'Delete was blocked — no rows were removed. Run supabase_migration.sql to add the delete policy.',
      );
    }
    setNote('');
    load();
  }

  if (loading) {
    return <icons.Loader2 className="w-5 h-5 text-lime animate-spin" />;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Manage projects</h1>
      {note && (
        <p className="flex items-start gap-2 text-sm text-danger">
          <icons.AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{note}</span>
        </p>
      )}

      {tools.map((t) => (
        <div
          key={t.id}
          className="flex flex-wrap items-center gap-4 p-4 rounded-xl border border-hairline bg-surface"
        >
          <div className="w-20 h-12 rounded-lg overflow-hidden bg-surface-2 shrink-0 grid place-items-center">
            {t.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={t.thumbnail_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <icons.Gamepad2 className="w-4 h-4 text-subtle" />
            )}
          </div>

          <div className="flex-1 min-w-[12rem]">
            <div className="font-medium">{t.title}</div>
            <div className="text-xs text-subtle mt-0.5 flex flex-wrap gap-x-3">
              <span>{t.kind === 'bundle' ? 'Uploaded bundle' : 'Single HTML file'}</span>
              {t.file_count ? <span>{t.file_count} files</span> : null}
              {t.bundle_bytes ? <span>{formatBytes(t.bundle_bytes)}</span> : null}
              {t.play_count ? <span>{t.play_count} plays</span> : null}
            </div>
          </div>

          <select
            value={t.category ?? 'game'}
            onChange={(e) => patch(t, { category: e.target.value as ToolCategory })}
            className="bg-surface-2 border border-hairline rounded-lg px-2 py-1.5 text-xs outline-none"
          >
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>

          <button
            onClick={() => setEditing(t)}
            title="Edit details"
            className="p-2 rounded-lg border border-hairline text-subtle hover:text-text transition-colors"
          >
            <icons.Pencil className="w-4 h-4" />
          </button>

          <button
            onClick={() => patch(t, { is_featured: !t.is_featured })}
            title="Feature on the homepage"
            className={`p-2 rounded-lg border transition-colors ${
              t.is_featured
                ? 'border-amber/50 text-amber'
                : 'border-hairline text-subtle hover:text-text'
            }`}
          >
            <icons.Star className={`w-4 h-4 ${t.is_featured ? 'fill-amber' : ''}`} />
          </button>

          <button
            onClick={() => patch(t, { is_published: t.is_published === false })}
            title={t.is_published === false ? 'Hidden — click to publish' : 'Visible — click to hide'}
            className={`p-2 rounded-lg border transition-colors ${
              t.is_published === false
                ? 'border-hairline text-subtle'
                : 'border-success/40 text-success'
            }`}
          >
            {t.is_published === false ? (
              <icons.EyeOff className="w-4 h-4" />
            ) : (
              <icons.Eye className="w-4 h-4" />
            )}
          </button>

          <Link
            href={`/play/${t.id}`}
            target="_blank"
            className="p-2 rounded-lg border border-hairline text-subtle hover:text-text transition-colors"
          >
            <icons.ExternalLink className="w-4 h-4" />
          </Link>

          <button
            onClick={() => remove(t)}
            className="p-2 rounded-lg border border-hairline text-danger hover:border-danger/50 transition-colors"
          >
            <icons.Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}

      {!tools.length && <p className="text-subtle">Nothing published yet.</p>}

      {editing && (
        <EditPanel
          tool={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

/** Full editor for a published project. Every field the site renders is here. */
function EditPanel({
  tool,
  onClose,
  onSaved,
}: {
  tool: Tool;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState({
    title: tool.title ?? '',
    description: tool.description ?? '',
    category: (tool.category ?? 'game') as ToolCategory,
    cta_label: tool.cta_label ?? '',
    tech: (tool.tech ?? []).join(', '),
    tags: (tool.tags ?? []).join(', '),
    role_note: tool.role_note ?? '',
    external_url: tool.external_url ?? '',
    source_url: tool.source_url ?? '',
    year: tool.year ? String(tool.year) : '',
    thumbnail_url: tool.thumbnail_url ?? '',
    sort_order: String(tool.sort_order ?? 0),
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const field =
    'w-full bg-surface-2 border border-hairline rounded-xl px-4 py-3 outline-none focus:border-lime/60 transition-colors placeholder:text-subtle';

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr('');
    const csv = (s: string) =>
      s
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);

    const { data, error } = await supabase
      .from('tools')
      .update({
        title: f.title,
        description: f.description || null,
        category: f.category,
        cta_label: f.cta_label.trim() || null,
        tech: csv(f.tech),
        tags: csv(f.tags),
        role_note: f.role_note || null,
        external_url: f.external_url || null,
        source_url: f.source_url || null,
        year: f.year ? Number(f.year) : null,
        thumbnail_url: f.thumbnail_url || null,
        sort_order: Number(f.sort_order) || 0,
      })
      .eq('id', tool.id)
      .select('id');

    setSaving(false);
    if (error) return setErr(error.message);
    if (!data?.length) return setErr('Nothing was saved — re-run supabase_migration.sql.');
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center p-4 sm:p-6">
      <button
        className="absolute inset-0 bg-ink/92 cursor-default"
        onClick={onClose}
        aria-label="Close"
        tabIndex={-1}
      />
      <form
        onSubmit={save}
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-hairline bg-surface p-6 space-y-4"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-xl font-bold">Edit project</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg border border-hairline text-subtle hover:text-text"
            aria-label="Close"
          >
            <icons.X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Labelled label="Title">
            <input
              required
              value={f.title}
              onChange={(e) => setF({ ...f, title: e.target.value })}
              className={field}
            />
          </Labelled>
          <Labelled label="Category">
            <select
              value={f.category}
              onChange={(e) => setF({ ...f, category: e.target.value as ToolCategory })}
              className={field}
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Labelled>
        </div>

        <Labelled label="Description" hint="Shown in full inside the popup.">
          <textarea
            rows={4}
            value={f.description}
            onChange={(e) => setF({ ...f, description: e.target.value })}
            className={`${field} resize-y`}
          />
        </Labelled>

        <div className="grid sm:grid-cols-2 gap-4">
          <Labelled label="Button text in the popup" hint="Empty = a sensible default.">
            <input
              value={f.cta_label}
              onChange={(e) => setF({ ...f, cta_label: e.target.value })}
              className={field}
              placeholder="Play now"
            />
          </Labelled>
          <Labelled label="Built with" hint="Comma separated.">
            <input
              value={f.tech}
              onChange={(e) => setF({ ...f, tech: e.target.value })}
              className={field}
              placeholder="Three.js, WebGL"
            />
          </Labelled>
        </div>

        <Labelled label="Cover image">
          <ThumbnailPicker
            value={f.thumbnail_url}
            onChange={(url) => setF({ ...f, thumbnail_url: url })}
          />
        </Labelled>

        <div className="grid sm:grid-cols-2 gap-4">
          <Labelled label="My role" hint="Optional, for client work.">
            <input
              value={f.role_note}
              onChange={(e) => setF({ ...f, role_note: e.target.value })}
              className={field}
            />
          </Labelled>
          <Labelled label="Year">
            <input
              value={f.year}
              onChange={(e) => setF({ ...f, year: e.target.value })}
              className={field}
              placeholder="2026"
            />
          </Labelled>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Labelled label="External link" hint="Only for link-only projects.">
            <input
              value={f.external_url}
              onChange={(e) => setF({ ...f, external_url: e.target.value })}
              className={field}
              placeholder="https://…"
            />
          </Labelled>
          <Labelled label="Source link" hint="Optional. Adds a Source button.">
            <input
              value={f.source_url}
              onChange={(e) => setF({ ...f, source_url: e.target.value })}
              className={field}
              placeholder="https://github.com/…"
            />
          </Labelled>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Labelled label="Tags" hint="Comma separated.">
            <input
              value={f.tags}
              onChange={(e) => setF({ ...f, tags: e.target.value })}
              className={field}
            />
          </Labelled>
          <Labelled label="Sort order" hint="Higher shows first.">
            <input
              value={f.sort_order}
              onChange={(e) => setF({ ...f, sort_order: e.target.value })}
              className={field}
            />
          </Labelled>
        </div>

        {err && <p className="text-sm text-danger">{err}</p>}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 rounded-xl bg-lime text-ink font-semibold hover:bg-lime-dim transition-colors disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-3 rounded-xl border border-hairline text-muted hover:text-text transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

/* ========================================================================== */
/*  MESSAGES                                                                   */
/* ========================================================================== */

function MessagesTab() {
  const [rows, setRows] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState('');

  useEffect(() => {
    let alive = true;
    const bail = setTimeout(() => {
      if (alive) setLoading(false);
    }, 4000);
    
    (async () => {
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .order('created_at', { ascending: false });
        if (!alive) return;
        if (error) setNote('Run supabase_migration.sql to enable the contact inbox.');
        setRows((data ?? []) as Message[]);
      } catch (e) {
        console.error('[admin] load messages failed:', e);
        if (alive) setNote('Failed to load messages due to network error.');
      } finally {
        if (alive) {
          alive = false;
          clearTimeout(bail);
          setLoading(false);
        }
      }
    })();
    return () => {
      alive = false;
      clearTimeout(bail);
    };
  }, []);

  if (loading) return <icons.Loader2 className="w-5 h-5 text-lime animate-spin" />;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Messages</h1>
      <p className="text-sm text-subtle">
        Every contact-form submission is stored here permanently. If
        NEXT_PUBLIC_WEB3FORMS_KEY is set in Vercel you also get each one by email — but this
        list is the durable record either way.
      </p>
      {note && <p className="text-sm text-amber">{note}</p>}
      {!rows.length && !note && <p className="text-subtle">No messages yet.</p>}
      {rows.map((m) => (
        <div key={m.id} className="p-4 rounded-xl border border-hairline bg-surface">
          <div className="flex flex-wrap justify-between gap-2 mb-2">
            <span className="font-medium">{m.name}</span>
            <span className="text-xs text-subtle">
              {new Date(m.created_at).toLocaleString()}
            </span>
          </div>
          <a href={`mailto:${m.email}`} className="text-sm text-lime hover:underline">
            {m.email}
          </a>
          <p className="mt-3 text-sm text-muted whitespace-pre-wrap">{m.body}</p>
        </div>
      ))}
    </div>
  );
}

/* ========================================================================== */
/*  PROFILE                                                                    */
/* ========================================================================== */

function ProfileTab() {
  const [form, setForm] = useState({
    full_name: '',
    tagline: '',
    bio: '',
    skills: '',
    email: '',
    phone: '',
    fiverr_url: '',
    location: '',
    avatar_url: '',
  });
  const [gallery, setGallery] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let alive = true;
    const bail = setTimeout(() => {
      if (alive) setLoading(false);
    }, 4000);

    (async () => {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (!alive) return;
        if (!user || userError) return;
        
        const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (!alive) return;
        if (data) {
          setForm({
            full_name: data.full_name ?? '',
            tagline: data.tagline ?? '',
            bio: data.bio ?? '',
            skills: (data.skills ?? []).join(', '),
            email: data.email ?? '',
            phone: data.phone ?? '',
            fiverr_url: data.fiverr_url ?? '',
            location: data.location ?? '',
            avatar_url: data.avatar_url ?? '',
          });
          setGallery(data.gallery ?? []);
        }
      } catch (e) {
        console.error('[admin] load profile failed:', e);
      } finally {
        if (alive) {
          alive = false;
          clearTimeout(bail);
          setLoading(false);
        }
      }
    })();
    return () => {
      alive = false;
      clearTimeout(bail);
    };
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setNote('');
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return setSaving(false);

    const { data, error } = await supabase
      .from('profiles')
      .update({
        full_name: form.full_name,
        tagline: form.tagline,
        bio: form.bio,
        skills: form.skills
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        email: form.email,
        phone: form.phone,
        fiverr_url: form.fiverr_url,
        location: form.location,
        avatar_url: form.avatar_url,
        gallery,
      })
      .eq('id', user.id)
      .select('id');

    setSaving(false);
    if (error) return setNote(error.message);
    if (!data?.length)
      return setNote('Nothing was saved — run supabase_migration.sql, then try again.');
    setNote('Saved.');
  }

  const [avatarCropSrc, setAvatarCropSrc] = useState('');

  async function handleAvatarSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarCropSrc(URL.createObjectURL(file));
    e.target.value = '';
  }

  async function uploadAvatar(file: File) {
    setAvatarCropSrc('');
    setUploading(true);
    const ext = file.name.split('.').pop() || 'jpg';
    const key = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('avatars').upload(key, file, { upsert: true });
    if (error) setNote(error.message);
    else {
      const { data } = supabase.storage.from('avatars').getPublicUrl(key);
      setForm((f) => ({ ...f, avatar_url: data.publicUrl }));
    }
    setUploading(false);
  }

  if (loading) return <icons.Loader2 className="w-5 h-5 text-lime animate-spin" />;

  const field =
    'w-full bg-surface border border-hairline rounded-xl px-4 py-3 outline-none focus:border-lime/60 transition-colors placeholder:text-subtle';

  return (
    <>
    <form onSubmit={save} className="space-y-5 max-w-2xl">
      <h1 className="text-2xl font-bold">Profile</h1>

      <div className="flex items-center gap-5">
        <div className="w-20 h-20 rounded-xl overflow-hidden bg-surface-2 border border-hairline grid place-items-center">
          {form.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <icons.User className="w-6 h-6 text-subtle" />
          )}
        </div>
        <label className="px-4 py-2 rounded-lg bg-surface-2 border border-hairline text-sm cursor-pointer hover:border-lime/40 transition-colors">
          {uploading ? 'Uploading…' : 'Change photo'}
          <input type="file" accept="image/*" className="hidden" onChange={handleAvatarSelect} disabled={uploading} />
        </label>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Labelled label="Name">
          <input
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            className={field}
          />
        </Labelled>
        <Labelled label="Tagline">
          <input
            value={form.tagline}
            onChange={(e) => setForm({ ...form, tagline: e.target.value })}
            className={field}
            placeholder="Game Developer & Web Developer"
          />
        </Labelled>
      </div>

      <Labelled label="About" hint="The paragraph under your name on the homepage.">
        <textarea
          rows={3}
          value={form.bio}
          onChange={(e) => setForm({ ...form, bio: e.target.value })}
          className={`${field} resize-y`}
        />
      </Labelled>

      <Labelled label="Skills" hint="Comma separated.">
        <input
          value={form.skills}
          onChange={(e) => setForm({ ...form, skills: e.target.value })}
          className={field}
        />
      </Labelled>

      <div className="grid sm:grid-cols-2 gap-4">
        <Labelled label="Email">
          <input
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className={field}
            placeholder="ftamim440@gmail.com"
          />
        </Labelled>
        <Labelled label="Phone">
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className={field}
            placeholder="01945523411"
          />
        </Labelled>
      </div>

      <Labelled label="Fiverr profile URL" hint="Leave empty to hide the Fiverr link.">
        <input
          value={form.fiverr_url}
          onChange={(e) => setForm({ ...form, fiverr_url: e.target.value })}
          className={field}
          placeholder="https://www.fiverr.com/…"
        />
      </Labelled>

      <GalleryManager photos={gallery} onChange={setGallery} />

      {note && (
        <p className={`text-sm ${note === 'Saved.' ? 'text-success' : 'text-danger'}`}>{note}</p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="px-6 py-3 rounded-xl bg-lime text-ink font-semibold hover:bg-lime-dim transition-colors disabled:opacity-60"
      >
        {saving ? 'Saving…' : 'Save profile'}
      </button>
    </form>
    {avatarCropSrc && (
      <ImageCropper
        imageSrc={avatarCropSrc}
        aspect={1}
        onCropDone={uploadAvatar}
        onCancel={() => setAvatarCropSrc('')}
      />
    )}
    </>
  );
}

/* ========================================================================== */

/**
 * Photo gallery for the About carousel. Order in this list is the order on the
 * site, so the arrows move a photo rather than just deleting and re-adding it.
 * Changes are held locally and written by the surrounding profile form's save.
 */
function GalleryManager({
  photos,
  onChange,
}: {
  photos: string[];
  onChange: (next: string[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [progress, setProgress] = useState('');
  const [cropQueue, setCropQueue] = useState<string[]>([]);

  async function addFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    
    // Create object URLs for cropping
    setCropQueue(files.map(f => URL.createObjectURL(f)));
    e.target.value = '';
  }

  async function handleCropDone(croppedFile: File) {
    setBusy(true);
    setErr('');
    setProgress(`Uploading cropped image…`);
    
    const key = `profile/${crypto.randomUUID()}.jpg`;
    const { error } = await supabase.storage.from(GAMES_BUCKET).upload(key, croppedFile, {
      upsert: true,
      cacheControl: '31536000',
    });
    
    if (error) {
      setErr(error.message);
    } else {
      const url = supabase.storage.from(GAMES_BUCKET).getPublicUrl(key).data.publicUrl;
      onChange([...photos, url]);
    }
    
    setProgress('');
    setBusy(false);
    // Remove the processed image from the queue
    setCropQueue(q => q.slice(1));
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= photos.length) return;
    const next = [...photos];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-muted">Photo gallery</label>
        <p className="text-xs text-subtle mt-1">
          Shown as a slideshow above &ldquo;Who you&rsquo;d be working with&rdquo;. The first photo
          appears first. Remember to press Save profile.
        </p>
      </div>

      {photos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {photos.map((src, i) => (
            <div
              key={src + i}
              className="relative rounded-xl overflow-hidden border border-hairline bg-surface-2 aspect-[4/3] group"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="w-full h-full object-cover" />

              <span className="absolute top-2 left-2 rounded-md bg-ink/80 px-1.5 py-0.5 text-[10px] text-muted tabular-nums">
                {i + 1}
              </span>

              <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-ink/80 p-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => move(i, i - 1)}
                    disabled={i === 0}
                    aria-label="Move left"
                    className="p-1.5 rounded-md border border-hairline text-muted hover:text-text disabled:opacity-30"
                  >
                    <icons.ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, i + 1)}
                    disabled={i === photos.length - 1}
                    aria-label="Move right"
                    className="p-1.5 rounded-md border border-hairline text-muted hover:text-text disabled:opacity-30"
                  >
                    <icons.ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => onChange(photos.filter((_, x) => x !== i))}
                  aria-label="Remove photo"
                  className="p-1.5 rounded-md border border-hairline text-danger hover:border-danger/50"
                >
                  <icons.Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <label className="inline-block px-4 py-2 rounded-lg bg-surface-2 border border-hairline text-sm cursor-pointer hover:border-lime/40 transition-colors">
        {busy ? progress || 'Uploading…' : photos.length ? 'Add more photos' : 'Add photos'}
        <input
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={addFiles}
          disabled={busy || cropQueue.length > 0}
        />
      </label>

      {err && <p className="text-sm text-danger">{err}</p>}

      {cropQueue.length > 0 && (
        <ImageCropper
          imageSrc={cropQueue[0]}
          aspect={4 / 3}
          onCropDone={handleCropDone}
          onCancel={() => setCropQueue(q => q.slice(1))}
        />
      )}
    </div>
  );
}

function Labelled({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-muted">{label}</label>
      {children}
      {hint && <p className="text-xs text-subtle">{hint}</p>}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span>
      <span className="text-subtle">{label}: </span>
      <span className="text-text">{value}</span>
    </span>
  );
}
