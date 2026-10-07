-- Merge a duplicate person into a survivor. Nothing is deleted.

create function public.merge_people(p_survivor_id uuid, p_duplicate_id uuid)
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
