begin;
select plan(15);

select tests.create_user('t-volunteer@example.test', 'volunteer');
select tests.create_user('t-norole@example.test');

insert into public.people (id, first_name, birth_date, carer_id) values
  ('00000000-0000-4000-8000-000000000501', 'Adulta', date '1990-01-01', null),
  ('00000000-0000-4000-8000-000000000505', 'Cuidador Ausente', date '1980-01-01', null);
insert into public.people (id, first_name, birth_date, carer_id) values
  ('00000000-0000-4000-8000-000000000502', 'Menor Acompañada', app.today() - interval '10 years', '00000000-0000-4000-8000-000000000501'),
  ('00000000-0000-4000-8000-000000000503', 'Menor Sola', app.today() - interval '15 years', null),
  ('00000000-0000-4000-8000-000000000504', 'Menor Con Cuidador Ausente', app.today() - interval '12 years', '00000000-0000-4000-8000-000000000505'),
  ('00000000-0000-4000-8000-000000000506', 'Sin Fecha', null, null),
  ('00000000-0000-4000-8000-000000000507', 'Fusionada', date '1990-01-01', null);
update public.people set merged_into_id = '00000000-0000-4000-8000-000000000501'
where id = '00000000-0000-4000-8000-000000000507';

insert into public.stays (person_id, entry_date) values
  ('00000000-0000-4000-8000-000000000501', app.today() - 3),
  ('00000000-0000-4000-8000-000000000502', app.today() - 3),
  ('00000000-0000-4000-8000-000000000503', app.today() - 3),
  ('00000000-0000-4000-8000-000000000504', app.today() - 3),
  ('00000000-0000-4000-8000-000000000506', app.today() - 3),
  ('00000000-0000-4000-8000-000000000507', app.today() - 3);
insert into public.stays (person_id, entry_date, exit_date) values
  ('00000000-0000-4000-8000-000000000505', app.today() - 10, app.today() - 5);

-- 501 went out at local midnight today and came back; 503 is out right now.
insert into public.outings (stay_id, left_at, returned_at)
select s.id,
       app.today()::timestamp at time zone app.shelter_timezone(),
       (app.today()::timestamp at time zone app.shelter_timezone()) + interval '1 second'
from public.stays s where s.person_id = '00000000-0000-4000-8000-000000000501';
insert into public.outings (stay_id, left_at)
select s.id, now() - interval '1 minute'
from public.stays s where s.person_id = '00000000-0000-4000-8000-000000000503';

select tests.authenticate_as('t-volunteer@example.test');

select is(
  (select count(*)::int from public.current_residents
   where person_id between '00000000-0000-4000-8000-000000000501' and '00000000-0000-4000-8000-000000000507'),
  5,
  'open stays of non-merged people are listed');
select is(
  (select presence from public.current_residents where person_id = '00000000-0000-4000-8000-000000000503'),
  'outside',
  'a person with an open outing is outside');
select ok(
  (select out_since from public.current_residents where person_id = '00000000-0000-4000-8000-000000000503') is not null,
  'out_since is set while outside');
select is(
  (select presence from public.current_residents where person_id = '00000000-0000-4000-8000-000000000501'),
  'inside',
  'a person whose outings are closed is inside');
select is(
  (select outings_today from public.current_residents where person_id = '00000000-0000-4000-8000-000000000501'),
  1,
  'outings today are counted in the shelter timezone');
select is(
  (select days_in_shelter from public.current_residents where person_id = '00000000-0000-4000-8000-000000000501'),
  3,
  'days in shelter count from the entry date');
select is(
  (select age from public.current_residents where person_id = '00000000-0000-4000-8000-000000000501'),
  app.age_on(date '1990-01-01', app.today()),
  'the age is computed');
select is(
  (select is_minor from public.current_residents where person_id = '00000000-0000-4000-8000-000000000501'),
  false,
  'an adult is not a minor');
select is(
  (select is_unaccompanied_minor from public.current_residents where person_id = '00000000-0000-4000-8000-000000000502'),
  false,
  'a minor whose carer is staying is accompanied');
select is(
  (select is_unaccompanied_minor from public.current_residents where person_id = '00000000-0000-4000-8000-000000000503'),
  true,
  'a minor without a carer is unaccompanied');
select is(
  (select is_unaccompanied_minor from public.current_residents where person_id = '00000000-0000-4000-8000-000000000504'),
  true,
  'a minor whose carer is not staying is unaccompanied');
select is(
  (select age from public.current_residents where person_id = '00000000-0000-4000-8000-000000000506'),
  null::integer,
  'an unknown birth date gives an unknown age');
select is(
  (select is_unaccompanied_minor from public.current_residents where person_id = '00000000-0000-4000-8000-000000000506'),
  false,
  'an unknown birth date is never flagged as an unaccompanied minor');

select tests.authenticate_as('t-norole@example.test');
select is(
  (select count(*)::int from public.current_residents
   where person_id between '00000000-0000-4000-8000-000000000501' and '00000000-0000-4000-8000-000000000507'),
  0,
  'a user without a role sees nobody');

select tests.authenticate_as_anon();
select throws_ok($$select count(*) from public.current_residents$$, '42501', null, 'anon has no access');

select * from finish();
rollback;
