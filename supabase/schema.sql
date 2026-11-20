-- Studio Nova — Supabase schema
-- Run this in Supabase Dashboard → SQL Editor.
-- Auth: Google provider must be enabled in Authentication → Providers.

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles for insert
with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- Projects (local-first IDs preserved; data is the full Studio Nova JSON)
-- ---------------------------------------------------------------------------
create table if not exists public.projects (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  name text not null default 'Projeto',
  schema_version integer not null default 2,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists projects_user_updated_idx
  on public.projects (user_id, updated_at desc);

alter table public.projects enable row level security;

drop policy if exists "projects_select_own" on public.projects;
create policy "projects_select_own"
on public.projects for select
using (auth.uid() = user_id);

drop policy if exists "projects_insert_own" on public.projects;
create policy "projects_insert_own"
on public.projects for insert
with check (auth.uid() = user_id);

drop policy if exists "projects_update_own" on public.projects;
create policy "projects_update_own"
on public.projects for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "projects_delete_own" on public.projects;
create policy "projects_delete_own"
on public.projects for delete
using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Media metadata (blobs live in the private "media" storage bucket)
-- ---------------------------------------------------------------------------
create table if not exists public.project_assets (
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id text not null,
  asset_id text not null,
  name text not null,
  kind text not null,
  mime text not null,
  size bigint not null default 0,
  width integer,
  height integer,
  duration double precision,
  storage_path text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, project_id, asset_id)
);

create index if not exists project_assets_user_project_idx
  on public.project_assets (user_id, project_id);

alter table public.project_assets enable row level security;

drop policy if exists "project_assets_select_own" on public.project_assets;
create policy "project_assets_select_own"
on public.project_assets for select
using (auth.uid() = user_id);

drop policy if exists "project_assets_insert_own" on public.project_assets;
create policy "project_assets_insert_own"
on public.project_assets for insert
with check (auth.uid() = user_id);

drop policy if exists "project_assets_update_own" on public.project_assets;
create policy "project_assets_update_own"
on public.project_assets for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "project_assets_delete_own" on public.project_assets;
create policy "project_assets_delete_own"
on public.project_assets for delete
using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Create a profile for every new auth user
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Private storage bucket for media blobs
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('media', 'media', false)
on conflict (id) do nothing;

drop policy if exists "media_select_own" on storage.objects;
create policy "media_select_own"
on storage.objects for select
using (
  bucket_id = 'media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "media_insert_own" on storage.objects;
create policy "media_insert_own"
on storage.objects for insert
with check (
  bucket_id = 'media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "media_update_own" on storage.objects;
create policy "media_update_own"
on storage.objects for update
using (
  bucket_id = 'media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "media_delete_own" on storage.objects;
create policy "media_delete_own"
on storage.objects for delete
using (
  bucket_id = 'media'
  and (storage.foldername(name))[1] = auth.uid()::text
);
