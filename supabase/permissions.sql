-- ADINEYY IRUPPEN PERMISSIONS
-- Participants are anonymous Supabase Auth users.
-- Each participant can read only their own row.
-- Admin is a normal Supabase Auth user and can read/delete all rows.

alter table public.songs enable row level security;

drop policy if exists "participant insert own song" on public.songs;
drop policy if exists "participant read own song" on public.songs;
drop policy if exists "admin read all songs" on public.songs;
drop policy if exists "admin delete songs" on public.songs;

create policy "participant insert own song"
on public.songs
for insert
to authenticated
with check (
  auth.uid() = owner_id
);

create policy "participant read own song"
on public.songs
for select
to authenticated
using (
  auth.uid() = owner_id
);

-- IMPORTANT:
-- Replace YOUR_ADMIN_USER_UUID with the UUID of your Supabase Auth admin user.
-- Run this after creating the admin account.

create policy "admin read all songs"
on public.songs
for select
to authenticated
using (
  auth.uid() = 'YOUR_ADMIN_USER_UUID'
);

create policy "admin delete songs"
on public.songs
for delete
to authenticated
using (
  auth.uid() = 'YOUR_ADMIN_USER_UUID'
);

-- STORAGE:
-- Participant can upload only inside their own folder.
-- Participant can download only their own folder.
-- Admin can access every object.
-- Replace YOUR_ADMIN_USER_UUID with the admin user's UUID.

drop policy if exists "participant upload own folder" on storage.objects;
drop policy if exists "participant read own folder" on storage.objects;
drop policy if exists "admin read all song files" on storage.objects;
drop policy if exists "admin delete all song files" on storage.objects;

create policy "participant upload own folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'songs'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "participant read own folder"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'songs'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "admin read all song files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'songs'
  and auth.uid() = 'YOUR_ADMIN_USER_UUID'
);

create policy "admin delete all song files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'songs'
  and auth.uid() = 'YOUR_ADMIN_USER_UUID'
);
