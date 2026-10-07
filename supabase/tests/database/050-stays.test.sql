begin;
select plan(18);

select tests.create_user('t-admin@example.test', 'admin');
select tests.create_user('t-volunteer@example.test', 'volunteer');

insert into public.people (id, first_name) values
  ('00000000-0000-4000-8000-000000000201', 'Persona Uno'),
  ('00000000-0000-4000-8000-000000000202', 'Persona Dos'),
  ('00000000-0000-4000-8000-000000000203', 'Persona Tres');

select tests.authenticate_as('t-volunteer@example.test');
select lives_ok(
  $$insert into public.stays (id, person_id, bed)
    values ('00000000-0000-4000-8000-000000000211', '00000000-0000-4000-8000-000000000201', ' A1 ')$$,
  'a volunteer can open a stay');
select is(
  (select entry_date from public.stays where id = '00000000-0000-4000-8000-000000000211'),
  app.today(),
  'the entry date defaults to today in the shelter timezone');
select is(
  (select bed from public.stays where id = '00000000-0000-4000-8000-000000000211'),
  'A1',
  'the bed is trimmed');
select is(
  (select phone_status from public.stays where id = '00000000-0000-4000-8000-000000000211'),
  'none',
  'the phone status defaults to none');

insert into public.stays (id, person_id, entry_date, exit_date, bed)
values ('00000000-0000-4000-8000-000000000213', '00000000-0000-4000-8000-000000000202', app.today() - 40, app.today() - 35, E'\t');
select is(
  (select bed from public.stays where id = '00000000-0000-4000-8000-000000000213'),
  null::text,
  'a bed of only a tab is stored as null');

select throws_ok(
  $$insert into public.stays (person_id) values ('00000000-0000-4000-8000-000000000201')$$,
  null::char(5), null,
  'a second open stay for the same person is rejected');
select throws_ok(
  $$insert into public.stays (person_id, entry_date, exit_date)
    values ('00000000-0000-4000-8000-000000000202', app.today() - 5, app.today() - 6)$$,
  '23514', null,
  'a check-out before the entry is rejected');
select throws_ok(
  $$insert into public.stays (person_id, entry_date)
    values ('00000000-0000-4000-8000-000000000202', app.today() + 1)$$,
  'P0001', 'validation',
  'an entry date in the future is rejected');

insert into public.stays (id, person_id, entry_date, exit_date)
values ('00000000-0000-4000-8000-000000000212', '00000000-0000-4000-8000-000000000202', app.today() - 30, app.today() - 20);
select throws_ok(
  $$insert into public.stays (person_id, entry_date, exit_date)
    values ('00000000-0000-4000-8000-000000000202', app.today() - 25, app.today() - 22)$$,
  '23P01', null,
  'overlapping stays are rejected');
select throws_ok(
  $$insert into public.stays (person_id, entry_date, exit_date)
    values ('00000000-0000-4000-8000-000000000202', app.today() - 25, app.today() - 25)$$,
  '23P01', null,
  'a same-day stay inside another stay is rejected');
select lives_ok(
  $$insert into public.stays (person_id, entry_date, exit_date)
    values ('00000000-0000-4000-8000-000000000202', app.today() - 20, app.today() - 18)$$,
  'a stay may start on the day the previous one ended');
select lives_ok(
  $$insert into public.stays (person_id, entry_date, exit_date)
    values ('00000000-0000-4000-8000-000000000202', app.today() - 35, app.today() - 35)$$,
  'a same-day stay may be on the day the previous one ended');
select throws_ok(
  $$insert into public.stays (person_id, entry_date, exit_date)
    values ('00000000-0000-4000-8000-000000000202', app.today() - 35, app.today() - 35)$$,
  '23P01', null,
  'two identical same-day stays are rejected');
select throws_ok(
  $$insert into public.stays (person_id, phone_status)
    values ('00000000-0000-4000-8000-000000000202', 'lost')$$,
  '23514', null,
  'an unknown phone status is rejected');

insert into public.stays (id, person_id, entry_date)
values ('00000000-0000-4000-8000-000000000214', '00000000-0000-4000-8000-000000000203', app.today() - 3);
update public.stays set exit_date = app.today() where id = '00000000-0000-4000-8000-000000000214';
select lives_ok(
  $$insert into public.stays (person_id, entry_date)
    values ('00000000-0000-4000-8000-000000000203', app.today())$$,
  'a person checked out today can be checked in again today');

delete from public.stays where id = '00000000-0000-4000-8000-000000000212';
select is(
  (select count(*)::int from public.stays where id = '00000000-0000-4000-8000-000000000212'),
  1,
  'a volunteer cannot delete a stay');

select tests.authenticate_as('t-admin@example.test');
delete from public.stays where id = '00000000-0000-4000-8000-000000000212';
select is(
  (select count(*)::int from public.stays where id = '00000000-0000-4000-8000-000000000212'),
  0,
  'an admin can delete a stay');

select tests.authenticate_as_anon();
select throws_ok($$select count(*) from public.stays$$, '42501', null, 'anon has no access');

select * from finish();
rollback;
