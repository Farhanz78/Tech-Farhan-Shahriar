-- ============================================================================
--  RLS HARDENING + VERIFICATION
--
--  Run this in: Supabase Dashboard -> SQL Editor -> New query -> Run.
--  It is IDEMPOTENT. Running it twice changes nothing the second time.
--
--  RUN supabase_migration.sql FIRST. This file hardens what that one creates;
--  on an empty database it will do nothing useful.
--
--  WHAT THIS FILE IS FOR
--  The migration already enables RLS and already writes every policy with
--  `(select auth.uid())` instead of a bare `auth.uid()`. This file:
--    1. Re-asserts RLS is ON, so a table that was created later cannot be
--       sitting there unprotected.
--    2. Turns FORCE ROW LEVEL SECURITY on where it is SAFE -- and explains, at
--       length, the two tables where it is NOT, because turning it on there
--       breaks working features silently.
--    3. Gives you a verification query whose output you can read without
--       knowing SQL.
-- ============================================================================


-- ============================================================================
--  PART 1 -- RLS ON. Always safe, on every table.
--
--  ENABLE ROW LEVEL SECURITY means: ordinary roles (anon, authenticated) can
--  only see and change rows that a policy allows. Without it, the anon key in
--  the browser bundle can read every row in the table.
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.tools    enable row level security;
alter table public.messages enable row level security;


-- ============================================================================
--  PART 2 -- FORCE ROW LEVEL SECURITY. Read this before changing it.
--
--  ENABLE and FORCE are not the same thing.
--    ENABLE applies RLS to ordinary roles.
--    FORCE additionally applies it to the table's OWNER, which in Supabase is
--    the `postgres` role.
--
--  It follows that FORCE only changes anything for code running AS the owner.
--  In this database, that means SECURITY DEFINER functions -- and this schema
--  has two that depend on the owner's RLS bypass to work at all.
--
--  ---------------------------------------------------------------------------
--  WHY public.profiles IS NOT FORCED
--
--    public.is_admin() is SECURITY DEFINER and reads public.profiles.
--    public.profiles has a policy (profiles_update_admin) that calls
--    public.is_admin().
--
--    Today that is fine: is_admin() runs as the owner, the owner skips RLS, the
--    read completes, and no policy is consulted. FORCE removes the skip. The
--    policy then calls is_admin(), which reads profiles, which evaluates the
--    policy, which calls is_admin()... Postgres detects it and raises
--    42P17 "infinite recursion detected in policy for relation profiles".
--
--    Symptom if you do it anyway: the admin panel stops loading, every write
--    fails, and the error message names a Postgres error code rather than
--    anything you could act on.
--
--  ---------------------------------------------------------------------------
--  WHY public.tools IS NOT FORCED
--
--    public.increment_play_count() is SECURITY DEFINER and UPDATEs public.tools.
--    Writes to `tools` are admin-only, and a visitor pressing Play is not an
--    admin -- the function exists precisely to be the narrow, safe exception.
--    It works because the owner skips RLS.
--
--    Under FORCE, the UPDATE is filtered by tools_update_admin, matches zero
--    rows, and returns successfully having done nothing. This is the worse of
--    the two failures because there is NO error: play counts simply stop going
--    up, on every game, forever, and nothing anywhere says so.
--
--  ---------------------------------------------------------------------------
--  WHAT FORCE WOULD ACTUALLY BUY HERE
--
--    Protection against a connection that is already authenticated as
--    `postgres`. Anyone holding that password can also run
--    `ALTER TABLE ... NO FORCE ROW LEVEL SECURITY` as their first statement.
--    Note also that `service_role` has the BYPASSRLS attribute, which overrides
--    FORCE as well -- so FORCE does not constrain the service role either.
--
--    Real benefit: small. Cost of getting it wrong: the admin panel or the play
--    counter, broken silently, in a project whose owner does not read SQL.
--
--    That trade is why the two tables below are deliberately left unforced, and
--    why this is written down instead of just done.
-- ============================================================================

-- Safe: nothing runs as the owner against this table.
alter table public.messages force row level security;

-- Deliberately NOT forced -- see the two blocks above:
--   alter table public.profiles force row level security;   -- 42P17 recursion
--   alter table public.tools    force row level security;   -- kills play_count
--
-- If you ever do want FORCE on these two, the prerequisite is to stop relying
-- on the owner's RLS bypass: create a dedicated role WITH BYPASSRLS, reassign
-- is_admin() and increment_play_count() to it, and re-test the admin panel and
-- the play counter before trusting it.


-- ============================================================================
--  PART 3 -- VERIFY. Run this and read the last column.
--
--  Every row should say 'RLS ON'. A row saying 'RLS OFF -- EXPOSED' means that
--  table can be read by anyone holding the anon key, which is published in the
--  browser bundle of every page.
-- ============================================================================

select
  c.relname                                as table_name,
  case when c.relrowsecurity then 'yes' else 'NO'  end  as rls_enabled,
  case when c.relforcerowsecurity then 'yes' else 'no' end as rls_forced,
  count(p.polname)                         as policy_count,
  case
    when not c.relrowsecurity              then 'RLS OFF -- EXPOSED'
    when count(p.polname) = 0              then 'RLS ON but NO POLICIES -- nothing is readable'
    else                                        'RLS ON'
  end                                      as verdict
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policy p on p.polrelid = c.oid
where n.nspname = 'public'
  and c.relkind = 'r'
group by c.relname, c.relrowsecurity, c.relforcerowsecurity
order by c.relname;


-- ============================================================================
--  PART 4 -- POLICY PERFORMANCE CHECK.
--
--  A policy written `auth.uid() = user_id` re-evaluates auth.uid() once PER ROW.
--  Written `(select auth.uid()) = user_id` it is evaluated once per statement,
--  and Postgres can use an index. On a large table the difference is orders of
--  magnitude; Supabase's own linter flags the unwrapped form.
--
--  This query lists any policy still using the slow form. As of the last check
--  it returns ZERO rows -- supabase_migration.sql already writes every policy
--  the fast way. Run it after adding a policy of your own.
-- ============================================================================

select
  c.relname   as table_name,
  p.polname   as policy_name,
  'uses bare auth.uid() -- wrap it as (select auth.uid())' as issue
from pg_policy p
join pg_class c     on c.oid = p.polrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and (
    pg_get_expr(p.polqual,       p.polrelid) ~ 'auth\.uid\(\)'
    and pg_get_expr(p.polqual,   p.polrelid) !~ 'select auth\.uid\(\)'
  )
order by c.relname, p.polname;
