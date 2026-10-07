-- Outings: leave and return. One per local day unless the exception is confirmed.

create function public.start_outing(
  p_stay_id uuid,
  p_comment text default null,
  p_confirm_exception boolean default false)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_stay public.stays;
  v_today_count integer;
  v_outing_id uuid;
begin
  perform app.require_role();
  select * into v_stay from public.stays s where s.id = p_stay_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  if v_stay.exit_date is not null then
    raise exception using errcode = 'P0001', message = 'stay_not_open';
  end if;
  if exists (select 1 from public.outings o where o.stay_id = p_stay_id and o.returned_at is null) then
    raise exception using errcode = 'P0001', message = 'outing_already_open';
  end if;
  select count(*) into v_today_count
  from public.outings o
  where o.stay_id = p_stay_id
    and app.local_date(o.left_at) = app.today();
  if v_today_count > 0 and not coalesce(p_confirm_exception, false) then
    raise exception using errcode = 'P0001', message = 'outing_exception_needs_confirmation';
  end if;
  insert into public.outings (stay_id, left_at, is_exception, comment)
  values (p_stay_id, now(), v_today_count > 0, p_comment)
  returning id into v_outing_id;
  return v_outing_id;
end;
$$;

create function public.end_outing(p_stay_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_stay public.stays;
  v_outing_id uuid;
begin
  perform app.require_role();
  select * into v_stay from public.stays s where s.id = p_stay_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  if v_stay.exit_date is not null then
    raise exception using errcode = 'P0001', message = 'stay_not_open';
  end if;
  update public.outings o
  set returned_at = now()
  where o.stay_id = p_stay_id
    and o.returned_at is null
  returning o.id into v_outing_id;
  if v_outing_id is null then
    raise exception using errcode = 'P0001', message = 'no_open_outing';
  end if;
  return v_outing_id;
end;
$$;

revoke all on function public.start_outing(uuid, text, boolean) from public, anon;
grant execute on function public.start_outing(uuid, text, boolean) to authenticated;
revoke all on function public.end_outing(uuid) from public, anon;
grant execute on function public.end_outing(uuid) to authenticated;
