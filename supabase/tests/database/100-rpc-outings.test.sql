begin;
select plan(16);

select tests.create_user('t-volunteer@example.test', 'volunteer');
select tests.create_user('t-norole@example.test');

insert into public.people (id, first_name) values
  ('00000000-0000-4000-8000-000000000701', 'Sale'),
  ('00000000-0000-4000-8000-000000000702', 'Cerrada'),
  ('00000000-0000-4000-8000-000000000703', 'Ayer'),
  ('00000000-0000-4000-8000-000000000704', 'Medianoche');
insert into public.stays (id, person_id, entry_date) values
  ('00000000-0000-4000-8000-000000000711', '00000000-0000-4000-8000-000000000701', app.today() - 3),
  ('00000000-0000-4000-8000-000000000713', '00000000-0000-4000-8000-000000000703', app.today() - 3),
  ('00000000-0000-4000-8000-000000000714', '00000000-0000-4000-8000-000000000704', app.today() - 3);
insert into public.stays (id, person_id, entry_date, exit_date) values
  ('00000000-0000-4000-8000-000000000712', '00000000-0000-4000-8000-000000000702', app.today() - 10, app.today() - 5);

-- 703 went out one second before local midnight (yesterday). 704 went out at local midnight (today).
insert into public.outings (stay_id, left_at, returned_at) values
  ('00000000-0000-4000-8000-000000000713',
   (app.today()::timestamp at time zone app.shelter_timezone()) - interval '1 second',
   app.today()::timestamp at time zone app.shelter_timezone()),
  ('00000000-0000-4000-8000-000000000714',
   app.today()::timestamp at time zone app.shelter_timezone(),
   (app.today()::timestamp at time zone app.shelter_timezone()) + interval '1 second');

select tests.authenticate_as('t-volunteer@example.test');
select lives_ok(
  $$select public.start_outing('00000000-0000-4000-8000-000000000711', 'Va al consulado')$$,
  'a person can go out');
select is(
  (select is_exception from public.outings where stay_id = '00000000-0000-4000-8000-000000000711'),
  false,
  'the first outing of the day is not an exception');
select is(
  (select presence from public.current_residents where stay_id = '00000000-0000-4000-8000-000000000711'),
  'outside',
  'the person is shown as outside');
select throws_ok(
  $$select public.start_outing('00000000-0000-4000-8000-000000000711')$$,
  'P0001', 'outing_already_open',
  'a person who is out cannot leave again');

-- Move the departure to local midnight so the return happens strictly later in this transaction.
select tests.reset_auth();
update public.outings
set left_at = app.today()::timestamp at time zone app.shelter_timezone()
where stay_id = '00000000-0000-4000-8000-000000000711';
select tests.authenticate_as('t-volunteer@example.test');

select lives_ok(
  $$select public.end_outing('00000000-0000-4000-8000-000000000711')$$,
  'the return can be recorded');
select is(
  (select presence from public.current_residents where stay_id = '00000000-0000-4000-8000-000000000711'),
  'inside',
  'the person is shown as inside again');
select throws_ok(
  $$select public.end_outing('00000000-0000-4000-8000-000000000711')$$,
  'P0001', 'no_open_outing',
  'a person who is inside cannot return');
select throws_ok(
  $$select public.start_outing('00000000-0000-4000-8000-000000000711')$$,
  'P0001', 'outing_exception_needs_confirmation',
  'a second outing on the same day needs confirmation');
select lives_ok(
  $$select public.start_outing('00000000-0000-4000-8000-000000000711', null, true)$$,
  'a confirmed second outing is recorded');
select is(
  (select count(*)::int from public.outings
   where stay_id = '00000000-0000-4000-8000-000000000711' and is_exception),
  1,
  'the confirmed outing is marked as an exception');
select lives_ok(
  $$select public.start_outing('00000000-0000-4000-8000-000000000713')$$,
  'an outing just before local midnight belongs to the previous day');
select throws_ok(
  $$select public.start_outing('00000000-0000-4000-8000-000000000714')$$,
  'P0001', 'outing_exception_needs_confirmation',
  'an outing at local midnight belongs to today');
select throws_ok(
  $$select public.start_outing('00000000-0000-4000-8000-000000000712')$$,
  'P0001', 'stay_not_open',
  'a closed stay cannot start an outing');
select throws_ok(
  $$select public.end_outing('00000000-0000-4000-8000-000000000712')$$,
  'P0001', 'stay_not_open',
  'a closed stay cannot end an outing');
select throws_ok(
  $$select public.start_outing('00000000-0000-4000-8000-000000000799')$$,
  'P0001', 'not_found',
  'an unknown stay is reported');

select tests.authenticate_as('t-norole@example.test');
select throws_ok(
  $$select public.start_outing('00000000-0000-4000-8000-000000000711')$$,
  'P0001', 'not_authorized',
  'a user without a role cannot record outings');

select * from finish();
rollback;
