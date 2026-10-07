-- People: one record per human, many stays.

create function app.immutable_unaccent(p_text text)
returns text
language sql
immutable
parallel safe
strict
set search_path = ''
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, p_text)
$$;

-- Strips leading and trailing whitespace, including non-breaking and zero-width spaces.
create function app.trim_text(p_text text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select regexp_replace(p_text, '^[\s   ﻿]+|[\s   ﻿]+$', '', 'g')
$$;

-- Lowercase, unaccented, single spaced "first last". Used for search and duplicates.
create function app.normalize_name(p_first text, p_last text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select nullif(
    trim(regexp_replace(
      app.immutable_unaccent(lower(coalesce(p_first, '') || ' ' || coalesce(p_last, ''))),
      '[\s   ﻿]+', ' ', 'g')),
    '')
$$;

create table public.people (
  id                   uuid primary key default gen_random_uuid(),
  first_name           text not null check (length(first_name) > 0),
  last_name            text,
  birth_date           date check (birth_date >= date '1900-01-01'),
  birth_date_estimated boolean not null default false,
  gender_code          text references public.genders (code),
  country_code         text references public.countries (code),
  region               text,
  carer_id             uuid references public.people (id),
  photo_path           text,
  search_name          text generated always as (app.normalize_name(first_name, last_name)) stored,
  merged_into_id       uuid references public.people (id),
  source               text not null default 'app' check (source in ('app', 'import')),
  created_at           timestamptz not null default now(),
  created_by           uuid,
  updated_at           timestamptz not null default now(),
  updated_by           uuid,
  constraint people_carer_not_self check (carer_id is null or carer_id <> id),
  constraint people_not_merged_into_self check (merged_into_id is null or merged_into_id <> id)
);

revoke all on table public.people from anon;

create index people_search_name_trgm on public.people using gin (search_name extensions.gin_trgm_ops);
create index people_carer_id on public.people (carer_id);
create index people_merged_into_id on public.people (merged_into_id);

-- Trims text, turns blank optional fields into null, rejects future birth dates.
create function app.prepare_person()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.first_name := app.trim_text(new.first_name);
  new.last_name := nullif(app.trim_text(new.last_name), '');
  new.region := nullif(app.trim_text(new.region), '');
  if new.birth_date > app.today() then
    raise exception using errcode = 'P0001', message = 'validation';
  end if;
  return new;
end;
$$;

create trigger people_prepare
  before insert or update on public.people
  for each row execute function app.prepare_person();

create trigger people_stamp
  before insert or update on public.people
  for each row execute function app.stamp();

alter table public.people enable row level security;

create policy people_select on public.people for select to authenticated
  using ((select app.current_app_role()) is not null);
create policy people_insert on public.people for insert to authenticated
  with check ((select app.current_app_role()) is not null);
create policy people_update on public.people for update to authenticated
  using ((select app.current_app_role()) is not null)
  with check ((select app.current_app_role()) is not null);
