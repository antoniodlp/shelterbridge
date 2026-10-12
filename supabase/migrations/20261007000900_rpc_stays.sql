-- Registration, check-in and check-out.

create function app.require_role()
returns public.app_role
language plpgsql
stable
set search_path = ''
as $$
declare
  v_role public.app_role := app.current_app_role();
begin
  if v_role is null then
    raise exception using errcode = 'P0001', message = 'not_authorized';
  end if;
  return v_role;
end;
$$;

-- Opens a stay. The exclusion constraint rejects a second open stay. The handler
-- reports already_checked_in when the person already has an open stay (including
-- when two computers check in at the same time), otherwise overlapping_stays.
create function app.insert_stay(p_person_id uuid, p_stay jsonb)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_stay_id uuid;
begin
  insert into public.stays (person_id, entry_date, case_type_code, bed, phone_status, notes)
  values (
    p_person_id,
    coalesce((p_stay ->> 'entry_date')::date, app.today()),
    p_stay ->> 'case_type_code',
    p_stay ->> 'bed',
    coalesce(p_stay ->> 'phone_status', 'none'),
    p_stay ->> 'notes')
  returning id into v_stay_id;
  return v_stay_id;
exception
  when unique_violation then
    raise exception using errcode = 'P0001', message = 'already_checked_in';
  when exclusion_violation then
    if exists (select 1 from public.stays s where s.person_id = p_person_id and s.exit_date is null) then
      raise exception using errcode = 'P0001', message = 'already_checked_in';
    end if;
    raise exception using errcode = 'P0001', message = 'overlapping_stays';
end;
$$;

create function public.register_person_and_check_in(p_person jsonb, p_stay jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_person_id uuid;
  v_stay_id uuid;
begin
  perform app.require_role();
  insert into public.people (
    first_name, last_name, birth_date, gender_code, country_code, region, carer_id)
  values (
    p_person ->> 'first_name',
    p_person ->> 'last_name',
    (p_person ->> 'birth_date')::date,
    p_person ->> 'gender_code',
    p_person ->> 'country_code',
    p_person ->> 'region',
    (p_person ->> 'carer_id')::uuid)
  returning id into v_person_id;
  v_stay_id := app.insert_stay(v_person_id, coalesce(p_stay, '{}'::jsonb));
  return jsonb_build_object('person_id', v_person_id, 'stay_id', v_stay_id);
end;
$$;

create function public.check_in(p_person_id uuid, p_stay jsonb default '{}'::jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform app.require_role();
  if not exists (
    select 1 from public.people p where p.id = p_person_id and p.merged_into_id is null
  ) then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  return app.insert_stay(p_person_id, coalesce(p_stay, '{}'::jsonb));
end;
$$;

-- Closes a stay. An open outing is left open: the person left and did not return.
create function public.check_out(p_stay_id uuid, p_exit_date date default null)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_stay public.stays;
  v_exit date := coalesce(p_exit_date, app.today());
begin
  perform app.require_role();
  select * into v_stay from public.stays s where s.id = p_stay_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'not_found';
  end if;
  if v_stay.exit_date is not null then
    raise exception using errcode = 'P0001', message = 'stay_not_open';
  end if;
  if v_exit < v_stay.entry_date or v_exit > app.today() then
    raise exception using errcode = 'P0001', message = 'validation';
  end if;
  if exists (
    select 1 from public.outings o
    where o.stay_id = p_stay_id and app.local_date(o.left_at) > v_exit
  ) then
    raise exception using errcode = 'P0001', message = 'validation';
  end if;
  update public.stays set exit_date = v_exit where id = p_stay_id;
end;
$$;

revoke all on function public.register_person_and_check_in(jsonb, jsonb) from public, anon;
grant execute on function public.register_person_and_check_in(jsonb, jsonb) to authenticated;
revoke all on function public.check_in(uuid, jsonb) from public, anon;
grant execute on function public.check_in(uuid, jsonb) to authenticated;
revoke all on function public.check_out(uuid, date) from public, anon;
grant execute on function public.check_out(uuid, date) to authenticated;
