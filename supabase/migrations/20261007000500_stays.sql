-- Stays: one arrival until check-out. The range [entry_date, exit_date) excludes
-- the exit day so a person checked out today can be checked in again today.

create table public.stays (
  id             uuid primary key default gen_random_uuid(),
  person_id      uuid not null references public.people (id) on delete restrict,
  entry_date     date not null default app.today(),
  exit_date      date,
  case_type_code text references public.case_types (code),
  bed            text,
  phone_status   text not null default 'none' check (phone_status in ('none', 'with_person', 'in_custody')),
  notes          text,
  source         text not null default 'app' check (source in ('app', 'import')),
  created_at     timestamptz not null default now(),
  created_by     uuid,
  updated_at     timestamptz not null default now(),
  updated_by     uuid,
  constraint stays_exit_after_entry check (exit_date is null or exit_date >= entry_date),
  constraint stays_no_overlap exclude using gist (
    person_id with =,
    daterange(entry_date, exit_date, '[)') with &&
  )
);

revoke all on table public.stays from anon;

create unique index stays_one_open_per_person on public.stays (person_id) where exit_date is null;
create index stays_person_id on public.stays (person_id);

-- Trims text, turns blank optional fields into null, rejects future dates.
create function app.prepare_stay()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.bed := nullif(app.trim_text(new.bed), '');
  new.notes := nullif(app.trim_text(new.notes), '');
  if new.entry_date > app.today() or new.exit_date > app.today() then
    raise exception using errcode = 'P0001', message = 'validation';
  end if;
  return new;
end;
$$;

create trigger stays_prepare
  before insert or update on public.stays
  for each row execute function app.prepare_stay();

create trigger stays_stamp
  before insert or update on public.stays
  for each row execute function app.stamp();

alter table public.stays enable row level security;

create policy stays_select on public.stays for select to authenticated
  using ((select app.current_app_role()) is not null);
create policy stays_insert on public.stays for insert to authenticated
  with check ((select app.current_app_role()) is not null);
create policy stays_update on public.stays for update to authenticated
  using ((select app.current_app_role()) is not null)
  with check ((select app.current_app_role()) is not null);
create policy stays_delete on public.stays for delete to authenticated
  using ((select app.current_app_role()) = 'admin');
