-- Users, roles and the sign-up allowlist.

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists btree_gist with schema extensions;

-- anon never touches application data. Each table also revokes anon explicitly.
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke all on functions from anon;

-- Internal helpers live in "app", which PostgREST does not expose.
create schema if not exists app;
grant usage on schema app to authenticated;

-- Fills audit columns. Clients cannot override them.
create function app.stamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.created_by := auth.uid();
  else
    new.created_at := old.created_at;
    new.created_by := old.created_by;
  end if;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

create type public.app_role as enum ('admin', 'legal', 'psychology', 'volunteer');

create table public.app_users (
  email        text primary key,
  user_id      uuid unique references auth.users (id) on delete set null,
  role         public.app_role not null,
  display_name text not null check (length(trim(display_name)) > 0),
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  created_by   uuid,
  updated_at   timestamptz not null default now(),
  updated_by   uuid,
  constraint app_users_email_normalized check (email = lower(trim(email)) and email like '%_@_%')
);

revoke all on table public.app_users from anon;

-- Normalizes the email and links the invitation to an existing auth user.
create function app.prepare_app_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.email := lower(trim(new.email));
  if tg_op = 'INSERT' or new.email is distinct from old.email then
    select u.id into new.user_id
    from auth.users u
    where lower(u.email) = new.email;
  end if;
  return new;
end;
$$;

create trigger app_users_prepare
  before insert or update on public.app_users
  for each row execute function app.prepare_app_user();

create trigger app_users_stamp
  before insert or update on public.app_users
  for each row execute function app.stamp();

-- Links an invitation when its auth user is created later (first sign-in).
create function app.link_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.app_users
  set user_id = new.id
  where email = lower(new.email)
    and user_id is null;
  return new;
end;
$$;

create trigger link_app_user
  after insert on auth.users
  for each row execute function app.link_new_auth_user();

-- The caller's role, read on every statement so deactivation is immediate.
create function app.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select au.role
  from public.app_users au
  where au.user_id = auth.uid()
    and au.active
$$;

alter table public.app_users enable row level security;

create policy app_users_select on public.app_users
  for select to authenticated
  using (user_id = (select auth.uid()) or (select app.current_app_role()) = 'admin');

create policy app_users_insert on public.app_users
  for insert to authenticated
  with check ((select app.current_app_role()) = 'admin');

create policy app_users_update on public.app_users
  for update to authenticated
  using ((select app.current_app_role()) = 'admin')
  with check ((select app.current_app_role()) = 'admin');

-- Auth hook: only invited, active emails may create an account (Google or password).
create function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(event -> 'user' ->> 'email'));
begin
  if exists (select 1 from public.app_users au where au.email = v_email and au.active) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 403,
      'message', 'This email has not been invited to ShelterBridge.'));
end;
$$;

revoke all on function public.hook_before_user_created(jsonb) from public, anon, authenticated;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
