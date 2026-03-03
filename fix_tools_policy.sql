-- RUN THIS IN SUPABASE SQL EDITOR

-- 1. Enable RLS on the tools table (security best practice)
ALTER TABLE tools ENABLE ROW LEVEL SECURITY;

-- 2. Allow everyone (public) to SEE the tools
DROP POLICY IF EXISTS "Public tools are viewable by everyone." ON tools;
CREATE POLICY "Public tools are viewable by everyone."
  ON tools FOR SELECT
  USING ( true );

-- 3. Allow logged-in users (Admin) to INSERT new tools
DROP POLICY IF EXISTS "Authenticated users can insert tools." ON tools;
CREATE POLICY "Authenticated users can insert tools."
  ON tools FOR INSERT
  WITH CHECK ( auth.role() = 'authenticated' );

-- 4. Allow logged-in users (Admin) to UPDATE existing tools
DROP POLICY IF EXISTS "Authenticated users can update tools." ON tools;
CREATE POLICY "Authenticated users can update tools."
  ON tools FOR UPDATE
  USING ( auth.role() = 'authenticated' );

-- 5. Allow logged-in users (Admin) to DELETE tools
DROP POLICY IF EXISTS "Authenticated users can delete tools." ON tools;
CREATE POLICY "Authenticated users can delete tools."
  ON tools FOR DELETE
  USING ( auth.role() = 'authenticated' );
