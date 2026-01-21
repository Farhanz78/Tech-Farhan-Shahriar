
-- Create a table for public profiles (if it doesn't exist)
create table if not exists public.profiles (
  id uuid references auth.users not null primary key,
  role text check (role in ('admin', 'user')) default 'user',
  full_name text,
  avatar_url text,
  skills text[] -- Array of strings for skills
);

-- Enable RLS
alter table public.profiles enable row level security;

-- Policies: Drop first to avoid errors if re-running
drop policy if exists "Public profiles are viewable by everyone." on public.profiles;
create policy "Public profiles are viewable by everyone." on public.profiles
  for select using (true);

drop policy if exists "Users can insert their own profile." on public.profiles;
create policy "Users can insert their own profile." on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "Users can update own profile." on public.profiles;
create policy "Users can update own profile." on public.profiles
  for update using (auth.uid() = id);

-- STORAGE SETUP (For Avatars)
-- 1. Create the bucket (insert into storage.buckets)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- 2. Storage Policies
drop policy if exists "Avatar images are publicly accessible." on storage.objects;
create policy "Avatar images are publicly accessible."
  on storage.objects for select
  using ( bucket_id = 'avatars' );

drop policy if exists "Anyone can upload an avatar." on storage.objects;
create policy "Anyone can upload an avatar."
  on storage.objects for insert
  with check ( bucket_id = 'avatars' and auth.role() = 'authenticated' );

drop policy if exists "Anyone can update their own avatar." on storage.objects;
create policy "Anyone can update their own avatar."
  on storage.objects for update
  using ( bucket_id = 'avatars' and auth.role() = 'authenticated' );

-- Create the Tools table
create table if not exists public.tools (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  icon_name text not null,
  html_code text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.tools enable row level security;

-- Policies for Tools
drop policy if exists "Tools are viewable by everyone." on public.tools;
create policy "Tools are viewable by everyone." on public.tools
  for select using (true);

drop policy if exists "Authenticated users can insert tools" on public.tools;
create policy "Authenticated users can insert tools" on public.tools
  for insert with check (auth.role() = 'authenticated');
  
drop policy if exists "Authenticated users can update tools" on public.tools;
create policy "Authenticated users can update tools" on public.tools
     for update using (auth.role() = 'authenticated');

-- Function to handle new user signup
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, role)
  values (new.id, 'user')
  on conflict (id) do nothing; -- Handle case where profile exists
  return new;
end;
$$ language plpgsql security definer;

-- Trigger: Drop first to avoid "already exists" error
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
