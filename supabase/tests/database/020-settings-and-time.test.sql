begin;
select plan(12);

select tests.create_user('t-admin@example.test', 'admin');
select tests.create_user('t-volunteer@example.test', 'volunteer');

select is(app.shelter_timezone(), 'America/Mexico_City', 'the default shelter timezone is Mexico City');
select is(app.today(), (now() at time zone 'America/Mexico_City')::date, 'today is computed in the shelter timezone');
select is(app.local_date('2026-01-01 05:59:59+00'), date '2025-12-31', 'a UTC morning is still the previous local day');
select is(app.local_date('2026-01-01 06:00:00+00'), date '2026-01-01', 'local midnight starts the new day');
select is(app.age_on(date '2008-10-08', date '2026-10-07'), 17, 'age is 17 the day before the 18th birthday');
select is(app.age_on(date '2008-10-07', date '2026-10-07'), 18, 'age is 18 on the birthday');
select is(app.age_on(null, date '2026-10-07'), null::integer, 'an unknown birth date gives an unknown age');

select tests.authenticate_as('t-volunteer@example.test');
select is(
  (select value #>> '{}' from public.settings where key = 'timezone'),
  'America/Mexico_City',
  'a volunteer can read settings');
update public.settings set value = '"UTC"' where key = 'timezone';
select is(
  (select value #>> '{}' from public.settings where key = 'timezone'),
  'America/Mexico_City',
  'a volunteer cannot change settings');

select tests.authenticate_as('t-admin@example.test');
select throws_ok(
  $$update public.settings set value = '"Mars/Olympus"' where key = 'timezone'$$,
  'P0001', 'validation',
  'an unknown timezone is rejected');
select lives_ok(
  $$update public.settings set value = '"America/Tijuana"' where key = 'timezone'$$,
  'an admin can change the timezone');

select tests.authenticate_as_anon();
select throws_ok($$select count(*) from public.settings$$, '42501', null, 'anon has no access');

select * from finish();
rollback;
