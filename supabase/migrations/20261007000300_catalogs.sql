-- Catalogs. All share one shape so a single admin editor handles them.

create function app.forbid_code_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.code is distinct from old.code then
    raise exception using errcode = 'P0001', message = 'validation';
  end if;
  return new;
end;
$$;

create table public.countries (
  code       text primary key check (code ~ '^[A-Z]{2}$'),
  labels     jsonb not null check (jsonb_typeof(labels) = 'object' and length(trim(coalesce(labels ->> 'es', ''))) > 0),
  sort_order integer not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table public.case_types (
  code       text primary key check (code ~ '^[a-z][a-z0-9_]*$'),
  labels     jsonb not null check (jsonb_typeof(labels) = 'object' and length(trim(coalesce(labels ->> 'es', ''))) > 0),
  sort_order integer not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table public.genders (
  code       text primary key check (code ~ '^[a-z][a-z0-9_]*$'),
  labels     jsonb not null check (jsonb_typeof(labels) = 'object' and length(trim(coalesce(labels ->> 'es', ''))) > 0),
  sort_order integer not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

revoke all on table public.countries from anon;
revoke all on table public.case_types from anon;
revoke all on table public.genders from anon;

create trigger countries_stamp before insert or update on public.countries
  for each row execute function app.stamp();
create trigger countries_code before update on public.countries
  for each row execute function app.forbid_code_change();

create trigger case_types_stamp before insert or update on public.case_types
  for each row execute function app.stamp();
create trigger case_types_code before update on public.case_types
  for each row execute function app.forbid_code_change();

create trigger genders_stamp before insert or update on public.genders
  for each row execute function app.stamp();
create trigger genders_code before update on public.genders
  for each row execute function app.forbid_code_change();

alter table public.countries enable row level security;
alter table public.case_types enable row level security;
alter table public.genders enable row level security;

create policy countries_select on public.countries for select to authenticated
  using ((select app.current_app_role()) is not null);
create policy countries_insert on public.countries for insert to authenticated
  with check ((select app.current_app_role()) = 'admin');
create policy countries_update on public.countries for update to authenticated
  using ((select app.current_app_role()) = 'admin')
  with check ((select app.current_app_role()) = 'admin');

create policy case_types_select on public.case_types for select to authenticated
  using ((select app.current_app_role()) is not null);
create policy case_types_insert on public.case_types for insert to authenticated
  with check ((select app.current_app_role()) = 'admin');
create policy case_types_update on public.case_types for update to authenticated
  using ((select app.current_app_role()) = 'admin')
  with check ((select app.current_app_role()) = 'admin');

create policy genders_select on public.genders for select to authenticated
  using ((select app.current_app_role()) is not null);
create policy genders_insert on public.genders for insert to authenticated
  with check ((select app.current_app_role()) = 'admin');
create policy genders_update on public.genders for update to authenticated
  using ((select app.current_app_role()) = 'admin')
  with check ((select app.current_app_role()) = 'admin');
