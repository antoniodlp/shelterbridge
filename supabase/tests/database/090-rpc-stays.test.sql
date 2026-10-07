begin;
select plan(23);

select tests.create_user('t-volunteer@example.test', 'volunteer');
select tests.create_user('t-norole@example.test');

insert into public.people (id, first_name) values
  ('00000000-0000-4000-8000-000000000601', 'Con Estancia'),
  ('00000000-0000-4000-8000-000000000602', 'Fusionada'),
  ('00000000-0000-4000-8000-000000000603', 'Historial'),
  ('00000000-0000-4000-8000-000000000604', 'Afuera'),
  ('00000000-0000-4000-8000-000000000605', 'Con Salida');
update public.people set merged_into_id = '00000000-0000-4000-8000-000000000601'
where id = '00000000-0000-4000-8000-000000000602';

insert into public.stays (id, person_id, entry_date) values
  ('00000000-0000-4000-8000-000000000611', '00000000-0000-4000-8000-000000000601', app.today() - 2),
  ('00000000-0000-4000-8000-000000000614', '00000000-0000-4000-8000-000000000604', app.today() - 2),
  ('00000000-0000-4000-8000-000000000615', '00000000-0000-4000-8000-000000000605', app.today() - 5);
insert into public.stays (person_id, entry_date, exit_date)
values ('00000000-0000-4000-8000-000000000603', app.today() - 30, app.today() - 20);

insert into public.outings (stay_id, left_at)
values ('00000000-0000-4000-8000-000000000614', now() - interval '1 minute');
insert into public.outings (stay_id, left_at, returned_at)
values ('00000000-0000-4000-8000-000000000615',
        ((app.today() - 1)::timestamp at time zone app.shelter_timezone()) + interval '12 hours',
        ((app.today() - 1)::timestamp at time zone app.shelter_timezone()) + interval '13 hours');

select tests.authenticate_as('t-volunteer@example.test');

-- register_person_and_check_in
select ok(
  public.register_person_and_check_in(
    '{"first_name": "Nueva", "last_name": "Persona", "birth_date": "1995-06-15", "country_code": "HN"}'::jsonb,
    '{"bed": "A1"}'::jsonb) ?& array['person_id', 'stay_id'],
  'register returns the new person and stay ids');
select is(
  (select count(*)::int from public.people where first_name = 'Nueva' and last_name = 'Persona'),
  1,
  'register creates the person');
select is(
  (select s.bed from public.stays s join public.people p on p.id = s.person_id
   where p.first_name = 'Nueva' and s.exit_date is null),
  'A1',
  'register opens a stay');
select is(
  (select s.entry_date from public.stays s join public.people p on p.id = s.person_id
   where p.first_name = 'Nueva'),
  app.today(),
  'the entry date defaults to today');
select throws_ok(
  $$select public.register_person_and_check_in('{"first_name": "Atómica"}'::jsonb, '{"phone_status": "lost"}'::jsonb)$$,
  '23514', null,
  'an invalid stay rejects the whole registration');
select is(
  (select count(*)::int from public.people where first_name = 'Atómica'),
  0,
  'no person is left behind when registration fails');
select throws_ok(
  $$select public.register_person_and_check_in('{"first_name": "  "}'::jsonb, '{}'::jsonb)$$,
  '23514', null,
  'a blank first name is rejected');
select throws_ok(
  $$select public.register_person_and_check_in(
      '{"first_name": "Mañana"}'::jsonb,
      format('{"entry_date": "%s"}', app.today() + 1)::jsonb)$$,
  'P0001', 'validation',
  'a future entry date is rejected');

-- check_in
select throws_ok(
  $$select public.check_in('00000000-0000-4000-8000-000000000601', '{}'::jsonb)$$,
  'P0001', 'already_checked_in',
  'a person with an open stay cannot check in again');
select throws_ok(
  $$select public.check_in('00000000-0000-4000-8000-000000000602', '{}'::jsonb)$$,
  'P0001', 'not_found',
  'a merged person cannot check in');
select throws_ok(
  $$select public.check_in('00000000-0000-4000-8000-000000000699', '{}'::jsonb)$$,
  'P0001', 'not_found',
  'an unknown person cannot check in');
select throws_ok(
  $$select public.check_in(
      '00000000-0000-4000-8000-000000000603',
      format('{"entry_date": "%s"}', app.today() - 25)::jsonb)$$,
  'P0001', 'overlapping_stays',
  'a stay overlapping the history is rejected');
select lives_ok(
  $$select public.check_in('00000000-0000-4000-8000-000000000603', '{"bed": "B2"}'::jsonb)$$,
  'a returning person can check in');

-- check_out
select throws_ok(
  $$select public.check_out('00000000-0000-4000-8000-000000000611', app.today() - 5)$$,
  'P0001', 'validation',
  'a check-out before the entry is rejected');
select throws_ok(
  $$select public.check_out('00000000-0000-4000-8000-000000000611', app.today() + 1)$$,
  'P0001', 'validation',
  'a check-out in the future is rejected');
select lives_ok(
  $$select public.check_out('00000000-0000-4000-8000-000000000611')$$,
  'an open stay can be checked out');
select is(
  (select exit_date from public.stays where id = '00000000-0000-4000-8000-000000000611'),
  app.today(),
  'the check-out date defaults to today');
select throws_ok(
  $$select public.check_out('00000000-0000-4000-8000-000000000611')$$,
  'P0001', 'stay_not_open',
  'a closed stay cannot be checked out again');
select lives_ok(
  $$select public.check_in('00000000-0000-4000-8000-000000000601', '{}'::jsonb)$$,
  'a person checked out today can be checked in again today');
select lives_ok(
  $$select public.check_out('00000000-0000-4000-8000-000000000614')$$,
  'a person who is out can be checked out');
select is(
  (select count(*)::int from public.outings
   where stay_id = '00000000-0000-4000-8000-000000000614' and returned_at is null),
  1,
  'their outing stays open as left and did not return');
select throws_ok(
  $$select public.check_out('00000000-0000-4000-8000-000000000615', app.today() - 3)$$,
  'P0001', 'validation',
  'a check-out before a recorded outing is rejected');

select tests.authenticate_as('t-norole@example.test');
select throws_ok(
  $$select public.check_in('00000000-0000-4000-8000-000000000603', '{}'::jsonb)$$,
  'P0001', 'not_authorized',
  'a user without a role cannot check in');

select * from finish();
rollback;
