-- Final review hardening: admin-only merges, check-in lock, lock order, privileges, photo names.

-- 1. Only admins can merge people or move a stay to another person. RLS only checks that the
-- caller has a role, so these guards close the direct-update path around merge_people.
-- Calls without a JWT (migrations, seed.sql, pgTAP fixtures, service-key scripts) are not blocked.
-- The guards sort before the prepare and stamp triggers by name.
create function app.guard_person_merge()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.merged_into_id is null then
      return new;
    end if;
  elsif new.merged_into_id is not distinct from old.merged_into_id then
    return new;
  end if;
  if auth.uid() is not null and app.current_app_role() is distinct from 'admin' then
    raise exception using errcode = 'P0001', message = 'not_authorized';
  end if;
  return new;
end;
$$;

create trigger people_guard_merge
  before insert or update on public.people
  for each row execute function app.guard_person_merge();

create function app.guard_stay_person()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.person_id is distinct from old.person_id
     and auth.uid() is not null
     and app.current_app_role() is distinct from 'admin' then
    raise exception using errcode = 'P0001', message = 'not_authorized';
  end if;
  return new;
end;
$$;

create trigger stays_guard_person
  before update on public.stays
  for each row execute function app.guard_stay_person();

-- 2. A check-in cannot land on a person that a merge is working on: the share lock waits for
-- the merge, then the re-check sees merged_into_id and reports not_found.
create or replace function public.check_in(p_person_id uuid, p_stay jsonb default '{}'::jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform app.require_role();
  perform 1 from public.people p where p.id = p_person_id and p.merged_into_id is null for share;
  if not found then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  return app.insert_stay(p_person_id, coalesce(p_stay, '{}'::jsonb));
end;
$$;

revoke all on function public.check_in(uuid, jsonb) from public, anon;
grant execute on function public.check_in(uuid, jsonb) to authenticated;

-- 3. merge_people locks both people in id order, so two merges never deadlock.
create or replace function public.merge_people(p_survivor_id uuid, p_duplicate_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if app.current_app_role() is distinct from 'admin' then
    raise exception using errcode = 'P0001', message = 'not_authorized';
  end if;
  if p_survivor_id = p_duplicate_id then
    raise exception using errcode = 'P0001', message = 'merge_same_person';
  end if;

  perform 1
  from public.people p
  where p.id in (p_survivor_id, p_duplicate_id)
  order by p.id
  for update;

  if (
    select count(*)
    from public.people p
    where p.id in (p_survivor_id, p_duplicate_id)
      and p.merged_into_id is null
  ) <> 2 then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;

  if exists (
    select 1
    from public.stays a
    join public.stays b
      on app.stay_range(a.entry_date, a.exit_date) && app.stay_range(b.entry_date, b.exit_date)
    where a.person_id = p_survivor_id
      and b.person_id = p_duplicate_id
  ) then
    raise exception using errcode = 'P0001', message = 'overlapping_stays';
  end if;

  update public.stays
  set person_id = p_survivor_id
  where person_id = p_duplicate_id;

  update public.people
  set carer_id = case when id = p_survivor_id then null else p_survivor_id end
  where carer_id = p_duplicate_id;

  update public.people
  set merged_into_id = p_survivor_id
  where merged_into_id = p_duplicate_id;

  update public.people
  set merged_into_id = p_survivor_id
  where id = p_duplicate_id;

  perform app.write_audit(
    'people',
    p_duplicate_id::text,
    'merge',
    null,
    jsonb_build_object('survivor_id', p_survivor_id, 'duplicate_id', p_duplicate_id));
end;
$$;

revoke all on function public.merge_people(uuid, uuid) from public, anon;
grant execute on function public.merge_people(uuid, uuid) to authenticated;

-- 4. Authenticated never needs truncate, references, trigger or maintain on any table.
revoke truncate, references, trigger on all tables in schema public from authenticated;
do $$
begin
  if current_setting('server_version_num')::int >= 170000 then
    execute 'revoke maintain on all tables in schema public from authenticated';
  end if;
end $$;
alter default privileges for role postgres in schema public
  revoke truncate, references, trigger on tables from authenticated;

-- 5. Service-key scripts (for example the Google Sheets import) fire the app.* triggers.
grant usage on schema app to service_role;

-- 6. Photo object names are UUID paths only, never names (spec 7.3).
drop policy person_photos_insert on storage.objects;
create policy person_photos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'person-photos'
    and (select app.current_app_role()) is not null
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(_thumb)?\.jpg$');

drop policy person_photos_update on storage.objects;
create policy person_photos_update on storage.objects
  for update to authenticated
  using (bucket_id = 'person-photos' and (select app.current_app_role()) is not null)
  with check (
    bucket_id = 'person-photos'
    and (select app.current_app_role()) is not null
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(_thumb)?\.jpg$');
