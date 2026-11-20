-- Studio Nova — correções para um banco que já recebeu o schema
-- Use no SQL Editor se:
--   1. o app mostra "permission denied for table projects/profiles";
--   2. o Storage não mostra o bucket "media";
--   3. o login cria usuário mas não cria o perfil.
-- É idempotente: pode rodar mais de uma vez.

-- ---------------------------------------------------------------------------
-- 1. Permissões para usuários autenticados (a RLS continua valendo)
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

grant select, insert, update, delete
  on public.profiles to authenticated;

grant select, insert, update, delete
  on public.projects to authenticated;

grant select, insert, update, delete
  on public.project_assets to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Bucket privado de mídias
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('media', 'media', false)
on conflict (id) do update set public = excluded.public;

-- ---------------------------------------------------------------------------
-- 3. Políticas do bucket (cada usuário só acessa a própria pasta)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 4. Perfil automático no primeiro login
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
-- 5. updated_at automático
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
