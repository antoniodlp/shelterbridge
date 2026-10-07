-- Duplicate detection at registration and free-text search over the whole history.

create function public.find_possible_duplicates(
  p_first_name text,
  p_last_name text default null,
  p_birth_date date default null,
  p_country_code text default null)
returns table (
  person_id uuid,
  first_name text,
  last_name text,
  birth_date date,
  birth_date_estimated boolean,
  country_code text,
  photo_path text,
  score real,
  last_entry_date date,
  last_exit_date date)
language plpgsql
stable
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_q1 text := app.normalize_name(p_first_name, p_last_name);
  v_q2 text := app.normalize_name(p_last_name, p_first_name);
begin
  perform app.require_role();
  if v_q1 is null or length(v_q1) < 2 then
    return;
  end if;
  return query
  with scored as (
    select
      p.id,
      p.first_name,
      p.last_name,
      p.birth_date,
      p.birth_date_estimated,
      p.country_code,
      p.photo_path,
      greatest(
        extensions.similarity(p.search_name, v_q1),
        extensions.similarity(p.search_name, v_q2)) as name_sim,
      case
        when p_birth_date is null or p.birth_date is null then 0
        when p.birth_date = p_birth_date then 0.30
        when extract(year from p.birth_date) = extract(year from p_birth_date)
         and extract(month from p.birth_date) = extract(day from p_birth_date)
         and extract(day from p.birth_date) = extract(month from p_birth_date) then 0.20
        when extract(year from p.birth_date) = extract(year from p_birth_date) then 0.10
        else 0
      end as dob_bonus,
      case when p_country_code is not null and p.country_code = p_country_code then 0.10 else 0 end as country_bonus
    from public.people p
    where p.merged_into_id is null
  )
  select
    s.id,
    s.first_name,
    s.last_name,
    s.birth_date,
    s.birth_date_estimated,
    s.country_code,
    s.photo_path,
    (s.name_sim + s.dob_bonus + s.country_bonus)::real,
    ls.entry_date,
    ls.exit_date
  from scored s
  left join lateral (
    select st.entry_date, st.exit_date
    from public.stays st
    where st.person_id = s.id
    order by st.entry_date desc
    limit 1
  ) ls on true
  where s.name_sim >= 0.30
     or (s.name_sim >= 0.20 and s.dob_bonus >= 0.20)
  order by 8 desc
  limit 5;
end;
$$;

create function public.search_people(p_query text, p_limit integer default 50)
returns table (
  person_id uuid,
  first_name text,
  last_name text,
  birth_date date,
  birth_date_estimated boolean,
  country_code text,
  photo_path text,
  score real,
  last_entry_date date,
  last_exit_date date,
  has_open_stay boolean)
language plpgsql
stable
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_q text := app.normalize_name(p_query, null);
  v_like text;
begin
  perform app.require_role();
  if v_q is null or length(v_q) < 2 then
    return;
  end if;
  v_like := '%' || replace(replace(replace(v_q, '\', '\'), '%', '\%'), '_', '\_') || '%';
  return query
  select
    p.id,
    p.first_name,
    p.last_name,
    p.birth_date,
    p.birth_date_estimated,
    p.country_code,
    p.photo_path,
    extensions.word_similarity(v_q, p.search_name)::real,
    ls.entry_date,
    ls.exit_date,
    exists (select 1 from public.stays os where os.person_id = p.id and os.exit_date is null)
  from public.people p
  left join lateral (
    select st.entry_date, st.exit_date
    from public.stays st
    where st.person_id = p.id
    order by st.entry_date desc
    limit 1
  ) ls on true
  where p.merged_into_id is null
    and (p.search_name like v_like or extensions.word_similarity(v_q, p.search_name) >= 0.5)
  order by (p.search_name like v_like) desc, 8 desc, p.search_name
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
end;
$$;

revoke all on function public.find_possible_duplicates(text, text, date, text) from public, anon;
grant execute on function public.find_possible_duplicates(text, text, date, text) to authenticated;
revoke all on function public.search_people(text, integer) from public, anon;
grant execute on function public.search_people(text, integer) to authenticated;
