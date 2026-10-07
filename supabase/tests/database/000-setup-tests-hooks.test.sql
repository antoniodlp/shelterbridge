-- Shared pgTAP helpers. This file sorts first, and the statements outside the
-- transaction below persist in the local database for the other test files.
create extension if not exists pgtap with schema extensions;

create schema if not exists tests;
grant usage on schema tests to anon, authenticated;

-- Creates an auth user. When p_role is given, also creates an active invitation.
create or replace function tests.create_user(p_email text, p_role text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into auth.users (
    id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (
    v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_email,
    '{"provider": "email", "providers": ["email"]}', '{}', now(), now());
  if p_role is not null then
    insert into public.app_users (email, role, display_name)
    values (p_email, p_role::public.app_role, p_email);
  end if;
  return v_id;
end;
$$;

create or replace function tests.user_id(p_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id from auth.users u where u.email = p_email
$$;

-- No SET clause on the next four functions: it would undo set_config on exit.
create or replace function tests.authenticate_as(p_email text)
returns void
language plpgsql
as $$
declare
  v_id uuid := tests.user_id(p_email);
begin
  if v_id is null then
    raise exception 'tests.authenticate_as: no user %', p_email;
  end if;
  perform pg_catalog.set_config('role', 'authenticated', true);
  perform pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.json_build_object('sub', v_id, 'role', 'authenticated', 'email', p_email)::text,
    true);
end;
$$;

create or replace function tests.authenticate_as_anon()
returns void
language plpgsql
as $$
begin
  perform pg_catalog.set_config('role', 'anon', true);
  perform pg_catalog.set_config('request.jwt.claims', '{"role": "anon"}', true);
end;
$$;

create or replace function tests.reset_auth()
returns void
language plpgsql
as $$
begin
  perform pg_catalog.set_config('role', 'postgres', true);
  perform pg_catalog.set_config('request.jwt.claims', '', true);
end;
$$;

create or replace function tests.set_operator_name(p_name text)
returns void
language plpgsql
as $$
begin
  perform pg_catalog.set_config(
    'request.headers',
    pg_catalog.json_build_object(
      'x-operator-name',
      pg_catalog.replace(pg_catalog.encode(pg_catalog.convert_to(p_name, 'UTF8'), 'base64'), E'\n', ''))::text,
    true);
end;
$$;

begin;
select plan(1);
select ok(true, 'test helpers are installed');
select * from finish();
rollback;
