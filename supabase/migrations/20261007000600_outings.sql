-- Outings: temporary exits during a stay ("salida"). Not to be confused with check-out.

create table public.outings (
  id           uuid primary key default gen_random_uuid(),
  stay_id      uuid not null references public.stays (id) on delete cascade,
  left_at      timestamptz not null default now(),
  returned_at  timestamptz,
  is_exception boolean not null default false,
  comment      text,
  created_at   timestamptz not null default now(),
  created_by   uuid,
  updated_at   timestamptz not null default now(),
  updated_by   uuid,
  constraint outings_return_after_leave check (returned_at is null or returned_at > left_at)
);

revoke all on table public.outings from anon;

create unique index outings_one_open_per_stay on public.outings (stay_id) where returned_at is null;
create index outings_stay_id on public.outings (stay_id);

create function app.check_outing()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_entry date;
  v_exit date;
begin
  new.comment := nullif(app.trim_text(new.comment), '');
  if new.left_at > now() or new.returned_at > now() then
    raise exception using errcode = 'P0001', message = 'validation';
  end if;
  select s.entry_date, s.exit_date into v_entry, v_exit
  from public.stays s
  where s.id = new.stay_id;
  if app.local_date(new.left_at) < v_entry
     or (v_exit is not null and app.local_date(new.left_at) > v_exit) then
    raise exception using errcode = 'P0001', message = 'outing_outside_stay';
  end if;
  return new;
end;
$$;

create trigger outings_check
  before insert or update on public.outings
  for each row execute function app.check_outing();

create trigger outings_stamp
  before insert or update on public.outings
  for each row execute function app.stamp();

-- The other direction: editing a stay's dates may not strand one of its outings.
create function app.check_stay_keeps_outings()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.outings o
    where o.stay_id = new.id
      and (app.local_date(o.left_at) < new.entry_date
           or (new.exit_date is not null and app.local_date(o.left_at) > new.exit_date))
  ) then
    raise exception using errcode = 'P0001', message = 'outing_outside_stay';
  end if;
  return new;
end;
$$;

create trigger stays_keep_outings
  before update of entry_date, exit_date on public.stays
  for each row execute function app.check_stay_keeps_outings();

alter table public.outings enable row level security;

create policy outings_select on public.outings for select to authenticated
  using ((select app.current_app_role()) is not null);
create policy outings_insert on public.outings for insert to authenticated
  with check ((select app.current_app_role()) is not null);
create policy outings_update on public.outings for update to authenticated
  using ((select app.current_app_role()) is not null)
  with check ((select app.current_app_role()) is not null);
create policy outings_delete on public.outings for delete to authenticated
  using ((select app.current_app_role()) = 'admin');
