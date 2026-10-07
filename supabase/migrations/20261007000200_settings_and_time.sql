-- Shelter settings and the shelter's notion of "today".

create table public.settings (
  key        text primary key,
  value      jsonb not null,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

revoke all on table public.settings from anon;

create function app.validate_setting()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.key = 'timezone' and (
       jsonb_typeof(new.value) <> 'string'
       or not exists (
         select 1 from pg_catalog.pg_timezone_names tz where tz.name = new.value #>> '{}'))
  then
    raise exception using errcode = 'P0001', message = 'validation';
  end if;
  return new;
end;
$$;

create trigger settings_stamp
  before insert or update on public.settings
  for each row execute function app.stamp();

create trigger settings_validate
  before insert or update on public.settings
  for each row execute function app.validate_setting();

alter table public.settings enable row level security;

create policy settings_select on public.settings
  for select to authenticated
  using ((select app.current_app_role()) is not null);

create policy settings_insert on public.settings
  for insert to authenticated
  with check ((select app.current_app_role()) = 'admin');

create policy settings_update on public.settings
  for update to authenticated
  using ((select app.current_app_role()) = 'admin')
  with check ((select app.current_app_role()) = 'admin');

insert into public.settings (key, value) values ('timezone', '"America/Mexico_City"');

create function app.shelter_timezone()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select s.value #>> '{}' from public.settings s where s.key = 'timezone'),
    'America/Mexico_City')
$$;

create function app.local_date(p_at timestamptz)
returns date
language sql
stable
set search_path = ''
as $$
  select (p_at at time zone app.shelter_timezone())::date
$$;

create function app.today()
returns date
language sql
stable
set search_path = ''
as $$
  select app.local_date(now())
$$;

create function app.age_on(p_birth_date date, p_on date)
returns integer
language sql
immutable
set search_path = ''
as $$
  select extract(year from age(p_on::timestamp, p_birth_date::timestamp))::integer
$$;
