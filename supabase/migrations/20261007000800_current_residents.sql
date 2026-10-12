-- Who is staying right now, with derived presence, age and minor flags.

create view public.current_residents
with (security_invoker = true)
as
select
  s.id                                         as stay_id,
  p.id                                         as person_id,
  p.first_name,
  p.last_name,
  p.photo_path,
  p.gender_code,
  p.country_code,
  p.region,
  p.birth_date,
  app.age_on(p.birth_date, app.today())        as age,
  p.carer_id,
  s.bed,
  s.entry_date,
  app.today() - s.entry_date                   as days_in_shelter,
  s.case_type_code,
  s.phone_status,
  s.notes,
  s.updated_at                                 as stay_updated_at,
  case when o.id is null then 'inside' else 'outside' end as presence,
  o.left_at                                    as out_since,
  o.id                                         as open_outing_id,
  (
    select count(*)::integer
    from public.outings t
    where t.stay_id = s.id
      and app.local_date(t.left_at) = app.today()
  )                                            as outings_today,
  app.age_on(p.birth_date, app.today()) < 18   as is_minor,
  coalesce(
    app.age_on(p.birth_date, app.today()) < 18
    and not exists (
      select 1
      from public.stays cs
      where cs.person_id = p.carer_id
        and cs.exit_date is null),
    false)                                     as is_unaccompanied_minor
from public.stays s
join public.people p on p.id = s.person_id and p.merged_into_id is null
left join public.outings o on o.stay_id = s.id and o.returned_at is null
where s.exit_date is null;

revoke all on public.current_residents from anon, authenticated;
grant select on public.current_residents to authenticated;
