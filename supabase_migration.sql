-- ============================================================================
--  PORTFOLIO UPGRADE MIGRATION
--  Run this ONCE in: Supabase Dashboard -> SQL Editor -> New query -> Run.
--  It is IDEMPOTENT: running it twice is safe and changes nothing the 2nd time.
--
--  WHAT IT DOES
--    1. Adds an is_admin() helper so write access is gated on profiles.role
--       instead of "any logged-in user" (which is the current, broken rule).
--    2. Extends `tools` so a row can be either a pasted HTML page ('inline')
--       or a multi-file uploaded game bundle ('bundle').
--    3. Replaces every RLS policy with an admin-only write set, and adds the
--       DELETE policies that are missing today (which is why the admin panel's
--       delete button silently does nothing).
--    4. Creates the public 'games' storage bucket and its policies.
--    5. Adds profile contact fields + a contact `messages` table.
--
--  EXISTING DATA IS PRESERVED. is_published defaults to TRUE precisely so that
--  games already in the table stay visible the moment the new policies land.
-- ============================================================================


-- ============================================================================
--  1. ADMIN HELPER
--  SECURITY DEFINER makes this run as the table owner, and an owner bypasses
--  RLS on its own tables. That is what stops a policy on `profiles` that reads
--  `profiles` from recursing forever (Postgres error 42P17).
--  SET search_path = '' blocks search_path hijacking, so every name below is
--  schema-qualified on purpose.
-- ============================================================================
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())      -- scalar subquery: evaluated once per
      and p.role = 'admin'                -- statement, not once per row
  );
$$;

revoke all     on function public.is_admin() from public;
grant  execute on function public.is_admin() to anon, authenticated;


-- Harden the existing signup trigger (it was SECURITY DEFINER with a mutable
-- search_path, which Supabase's own linter flags).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, role)
  values (new.id, 'user')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ============================================================================
--  2. PROFILE CONTACT FIELDS
--  All nullable: the site hides any contact method that is left empty.
-- ============================================================================
alter table public.profiles add column if not exists tagline     text;
alter table public.profiles add column if not exists bio         text;
alter table public.profiles add column if not exists email       text;
alter table public.profiles add column if not exists phone       text;
alter table public.profiles add column if not exists fiverr_url  text;
alter table public.profiles add column if not exists location    text;
-- Photos for the About carousel, in display order. Managed from the admin panel.
alter table public.profiles add column if not exists gallery     text[] not null default '{}'::text[];


-- ============================================================================
--  3. TOOLS TABLE -> supports multi-file game bundles
-- ============================================================================
begin;

-- 3.1 Legacy NOT NULLs must relax: a bundle row has no html_code, and inserting
--     one without an icon_name would fail with 23502.
alter table public.tools alter column html_code drop not null;
alter table public.tools alter column icon_name drop not null;
alter table public.tools alter column icon_name set default 'Gamepad2';

-- 3.2 New columns.
alter table public.tools add column if not exists kind          text        not null default 'inline';
alter table public.tools add column if not exists category      text        not null default 'game';
alter table public.tools add column if not exists role_note     text;
-- Label on the button inside the project popup. Editable per project so the
-- owner can write "Play now", "Open the app", "View on Google Play", etc.
alter table public.tools add column if not exists cta_label     text;
alter table public.tools add column if not exists tech          text[]      not null default '{}'::text[];
alter table public.tools add column if not exists external_url  text;
alter table public.tools add column if not exists source_url    text;
alter table public.tools add column if not exists year          integer;
alter table public.tools add column if not exists storage_path  text;
alter table public.tools add column if not exists entry_path    text        not null default 'index.html';
alter table public.tools add column if not exists description   text;
alter table public.tools add column if not exists thumbnail_url text;
alter table public.tools add column if not exists tags          text[]      not null default '{}'::text[];
alter table public.tools add column if not exists play_count    bigint      not null default 0;
alter table public.tools add column if not exists sort_order    integer     not null default 0;
alter table public.tools add column if not exists is_published  boolean     not null default true;
alter table public.tools add column if not exists is_featured   boolean     not null default false;
alter table public.tools add column if not exists updated_at    timestamptz not null default now();
alter table public.tools add column if not exists bundle_bytes  bigint;
alter table public.tools add column if not exists file_count    integer;

comment on column public.tools.kind
  is '''inline'' = pasted html_code. ''bundle'' = multi-file upload in the games bucket.';
comment on column public.tools.category
  is 'Which part of the work this is: game | web | mobile | tool. Drives the homepage filter.';
comment on column public.tools.external_url
  is 'Live link for work that is NOT hosted here (Play Store, a client site, CrazyGames).';
comment on column public.tools.tech
  is 'Tech used, shown on the project card. e.g. {Three.js,WebGL,Supabase}';
comment on column public.tools.storage_path
  is 'Folder prefix inside the games bucket. No leading/trailing slash. e.g. g/9f3ac1d2';
comment on column public.tools.entry_path
  is 'Relative HTML entry point inside storage_path. Usually index.html.';

-- 3.3 Backfill. State-convergent, so re-running is a no-op.
update public.tools set kind         = 'inline'      where kind is null or kind = '';
update public.tools set category     = 'game'        where category is null or category = '';
update public.tools set entry_path   = 'index.html'  where entry_path is null;
update public.tools set is_published = true          where is_published is null;

-- 3.4 Constraints. Postgres has no ADD CONSTRAINT IF NOT EXISTS, so drop-then-add.
alter table public.tools drop constraint if exists tools_kind_ck;
alter table public.tools add  constraint tools_kind_ck
  check (kind in ('inline', 'bundle', 'link'));

-- Four categories, because the owner is a full-stack developer and not only a
-- game developer. Re-running this migration widens the constraint safely.
alter table public.tools drop constraint if exists tools_category_ck;
alter table public.tools add  constraint tools_category_ck
  check (category in ('game', 'web', 'mobile', 'tool'));

-- A row may be hosted here (html_code / storage_path) OR merely linked out to
-- (external_url), so that shipped client work and Play Store apps can appear in
-- the portfolio without being re-hosted.
alter table public.tools drop constraint if exists tools_external_url_ck;
alter table public.tools add  constraint tools_external_url_ck
  check (external_url is null or external_url ~* '^https?://');

-- Each row must actually carry the payload its kind claims to have.
--   inline  a pasted HTML page, played here
--   bundle  a multi-file upload in the games bucket, played here
--   link    not hosted here at all: a Play Store app, a client site, a game on
--           another portal. The card links out instead of opening the player.
alter table public.tools drop constraint if exists tools_payload_ck;
alter table public.tools add  constraint tools_payload_ck
  check (
    (kind = 'inline' and html_code    is not null) or
    (kind = 'bundle' and storage_path is not null and entry_path is not null) or
    (kind = 'link'   and external_url is not null)
  );

-- entry_path and storage_path are concatenated into a URL, so '..' must never
-- survive into a stored value.
alter table public.tools drop constraint if exists tools_entry_path_ck;
alter table public.tools add  constraint tools_entry_path_ck
  check (
    entry_path is null or (
      entry_path !~ '^/' and entry_path !~ '\.\.' and entry_path ~* '\.x?html?$'
    )
  );

alter table public.tools drop constraint if exists tools_storage_path_ck;
alter table public.tools add  constraint tools_storage_path_ck
  check (
    storage_path is null or (
      storage_path ~ '^[A-Za-z0-9._/-]+$'
      and storage_path !~ '^/' and storage_path !~ '/$' and storage_path !~ '\.\.'
    )
  );

-- 3.5 Indexes
create unique index if not exists tools_storage_path_key
  on public.tools (storage_path) where storage_path is not null;
create index if not exists tools_published_sort_idx
  on public.tools (is_published, sort_order desc, created_at desc);
create index if not exists tools_tags_gin_idx
  on public.tools using gin (tags);

commit;


-- 3.6 Keep updated_at honest.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists tools_touch_updated_at on public.tools;
create trigger tools_touch_updated_at
  before update on public.tools
  for each row execute function public.touch_updated_at();


-- 3.7 Play counter.
--     Writes to `tools` are admin-only, so a visitor cannot bump this directly.
--     This narrow function is the escape hatch: it can ONLY increment, ONLY on
--     published rows, and touches no other column.
create or replace function public.increment_play_count(p_tool_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.tools
     set play_count = play_count + 1
   where id = p_tool_id and is_published;
$$;

revoke all     on function public.increment_play_count(uuid) from public;
grant  execute on function public.increment_play_count(uuid) to anon, authenticated;


-- ============================================================================
--  4. CONTACT MESSAGES
--  Anyone may write one; only the admin may read them back.
-- ============================================================================
create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  name       text        not null,
  email      text        not null,
  body       text        not null,
  is_read    boolean     not null default false,
  created_at timestamptz not null default now()
);

alter table public.messages enable row level security;

alter table public.messages drop constraint if exists messages_len_ck;
alter table public.messages add  constraint messages_len_ck
  check (
    char_length(name)  between 1 and 120  and
    char_length(email) between 3 and 200  and
    char_length(body)  between 1 and 5000
  );

drop policy if exists "messages_insert_anyone" on public.messages;
drop policy if exists "messages_select_admin"  on public.messages;
drop policy if exists "messages_update_admin"  on public.messages;
drop policy if exists "messages_delete_admin"  on public.messages;

create policy "messages_insert_anyone" on public.messages
  for insert to anon, authenticated
  with check (true);

create policy "messages_select_admin" on public.messages
  for select to authenticated using ( public.is_admin() );

create policy "messages_update_admin" on public.messages
  for update to authenticated
  using ( public.is_admin() ) with check ( public.is_admin() );

create policy "messages_delete_admin" on public.messages
  for delete to authenticated using ( public.is_admin() );


-- ============================================================================
--  5. RLS ON public.tools
--  The DELETE policy here is the actual fix for the dead delete button.
--
--  Why the missing DELETE policy was silent: for SELECT/UPDATE/DELETE, a policy
--  USING clause acts as an implicit WHERE filter, so non-matching rows are just
--  excluded -- "DELETE 0", no error. Only INSERT/UPDATE WITH CHECK can raise.
-- ============================================================================
alter table public.tools enable row level security;

drop policy if exists "Tools are viewable by everyone."      on public.tools;
drop policy if exists "Authenticated users can insert tools" on public.tools;
drop policy if exists "Authenticated users can update tools" on public.tools;
drop policy if exists "tools_select_public" on public.tools;
drop policy if exists "tools_insert_admin"  on public.tools;
drop policy if exists "tools_update_admin"  on public.tools;
drop policy if exists "tools_delete_admin"  on public.tools;

create policy "tools_select_public" on public.tools
  for select to anon, authenticated
  using ( is_published or public.is_admin() );

create policy "tools_insert_admin" on public.tools
  for insert to authenticated
  with check ( public.is_admin() );

create policy "tools_update_admin" on public.tools
  for update to authenticated
  using      ( public.is_admin() )
  with check ( public.is_admin() );

create policy "tools_delete_admin" on public.tools
  for delete to authenticated
  using ( public.is_admin() );


-- ============================================================================
--  6. RLS ON public.profiles  -- closes a privilege-escalation hole
--
--  The old UPDATE policy was `using (auth.uid() = id)` with no WITH CHECK and
--  no column restriction, so ANY signed-up user could PATCH their own row with
--  {"role":"admin"} and become an administrator in a single request.
--  The column-level GRANT below is the real lock; the trigger is a second line.
-- ============================================================================
alter table public.profiles enable row level security;

drop policy if exists "Public profiles are viewable by everyone." on public.profiles;
drop policy if exists "Users can insert their own profile."       on public.profiles;
drop policy if exists "Users can update own profile."             on public.profiles;
drop policy if exists "profiles_select_public" on public.profiles;
drop policy if exists "profiles_insert_self"   on public.profiles;
drop policy if exists "profiles_update_self"   on public.profiles;
drop policy if exists "profiles_update_admin"  on public.profiles;

create policy "profiles_select_public" on public.profiles
  for select to anon, authenticated
  using ( true );                       -- homepage reads name/avatar/skills

create policy "profiles_insert_self" on public.profiles
  for insert to authenticated
  with check ( (select auth.uid()) = id );

create policy "profiles_update_self" on public.profiles
  for update to authenticated
  using      ( (select auth.uid()) = id )
  with check ( (select auth.uid()) = id );

-- Written inline this policy would be 42P17 recursion; is_admin() makes it safe.
create policy "profiles_update_admin" on public.profiles
  for update to authenticated
  using      ( public.is_admin() )
  with check ( public.is_admin() );

-- Column-level grants. A column revoke has no effect while the table-level
-- privilege is still granted, so the table-level UPDATE must be revoked first.
revoke update on public.profiles from anon, authenticated;
grant  update (full_name, avatar_url, skills, tagline, bio, email, phone, fiverr_url, location, gallery)
  on public.profiles to authenticated;

-- Belt and braces: even a future accidental re-grant cannot escalate a role.
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    new.role := old.role;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();


-- ============================================================================
--  7. STORAGE: the 'games' bucket
--
--  public = true so /object/public/... serves assets without auth, which is
--  what an iframe and its <script>/<img>/fetch calls need.
--  allowed_mime_types is deliberately NULL: a WebGL bundle contains .wasm,
--  .data, .bin, .glb, .ktx2 and browsers report an empty type for several of
--  them, so any allow-list would reject real game files.
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('games', 'games', true, 52428800, null)          -- 50 MB per FILE
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "games_public_read"  on storage.objects;
drop policy if exists "games_admin_insert" on storage.objects;
drop policy if exists "games_admin_update" on storage.objects;
drop policy if exists "games_admin_delete" on storage.objects;

-- Needed even though the bucket is public: .list() and the authenticated
-- object route both go through RLS, and the admin panel lists bundle files.
create policy "games_public_read" on storage.objects
  for select to anon, authenticated
  using ( bucket_id = 'games' );

create policy "games_admin_insert" on storage.objects
  for insert to authenticated
  with check ( bucket_id = 'games' and public.is_admin() );

-- Not optional: upsert:true performs an UPDATE on storage.objects.
create policy "games_admin_update" on storage.objects
  for update to authenticated
  using      ( bucket_id = 'games' and public.is_admin() )
  with check ( bucket_id = 'games' and public.is_admin() );

-- Without this, replacing or removing a bundle silently no-ops and orphaned
-- 20 MB uploads accumulate against the 1 GB free-tier quota forever.
create policy "games_admin_delete" on storage.objects
  for delete to authenticated
  using ( bucket_id = 'games' and public.is_admin() );


-- ============================================================================
--  8. STORAGE: repair the 'avatars' bucket
--  It had the same "any authenticated user can write" flaw and no DELETE policy.
-- ============================================================================
drop policy if exists "Avatar images are publicly accessible." on storage.objects;
drop policy if exists "Anyone can upload an avatar."           on storage.objects;
drop policy if exists "Anyone can update their own avatar."    on storage.objects;
drop policy if exists "avatars_public_read"  on storage.objects;
drop policy if exists "avatars_admin_insert" on storage.objects;
drop policy if exists "avatars_admin_update" on storage.objects;
drop policy if exists "avatars_admin_delete" on storage.objects;

create policy "avatars_public_read" on storage.objects
  for select to anon, authenticated
  using ( bucket_id = 'avatars' );

create policy "avatars_admin_insert" on storage.objects
  for insert to authenticated
  with check ( bucket_id = 'avatars' and public.is_admin() );

create policy "avatars_admin_update" on storage.objects
  for update to authenticated
  using      ( bucket_id = 'avatars' and public.is_admin() )
  with check ( bucket_id = 'avatars' and public.is_admin() );

create policy "avatars_admin_delete" on storage.objects
  for delete to authenticated
  using ( bucket_id = 'avatars' and public.is_admin() );


-- ============================================================================
--  DONE.
--
--  TWO THINGS STILL TO DO BY HAND IN THE DASHBOARD:
--
--   (a) Authentication -> Sign In / Providers -> Email ->
--       turn OFF "Allow new users to sign up".
--       This site has exactly one legitimate user. With signup off, a stranger
--       has no way to obtain an account at all.
--
--   (b) Table Editor -> profiles -> check every row.
--       If any row has role = 'admin' that is not you, delete that user in
--       Authentication -> Users. Then change your own password.
-- ============================================================================
