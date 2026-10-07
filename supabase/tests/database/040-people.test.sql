begin;
select plan(14);

select tests.create_user('t-volunteer@example.test', 'volunteer');
select tests.create_user('t-norole@example.test');

insert into public.people (id, first_name, last_name)
values ('00000000-0000-4000-8000-000000000101', '  José ', ' Ñúñez   Quiñónez ');

select is(
  (select search_name from public.people where id = '00000000-0000-4000-8000-000000000101'),
  'jose nunez quinonez',
  'search_name is lowercased, unaccented and single spaced');
select is(
  (select first_name from public.people where id = '00000000-0000-4000-8000-000000000101'),
  'José',
  'the first name is trimmed');
select throws_ok(
  $$insert into public.people (first_name) values ('   ')$$,
  '23514', null,
  'a blank first name is rejected');

insert into public.people (id, first_name, last_name, region)
values ('00000000-0000-4000-8000-000000000102', 'Wilmer', '   ', '  ');
select is(
  (select last_name from public.people where id = '00000000-0000-4000-8000-000000000102'),
  null::text,
  'a blank last name is stored as null');
select is(
  (select region from public.people where id = '00000000-0000-4000-8000-000000000102'),
  null::text,
  'a blank region is stored as null');
select throws_ok(
  $$insert into public.people (first_name, birth_date) values ('Futuro', app.today() + 1)$$,
  'P0001', 'validation',
  'a birth date in the future is rejected');
select throws_ok(
  $$insert into public.people (id, first_name, carer_id)
    values ('00000000-0000-4000-8000-000000000103', 'Self', '00000000-0000-4000-8000-000000000103')$$,
  '23514', null,
  'a person cannot be their own carer');

select tests.authenticate_as('t-volunteer@example.test');
select lives_ok(
  $$insert into public.people (id, first_name, created_by)
    values ('00000000-0000-4000-8000-000000000104', 'Ana', '00000000-0000-0000-0000-000000000000')$$,
  'a volunteer can register a person');
select is(
  (select created_by from public.people where id = '00000000-0000-4000-8000-000000000104'),
  tests.user_id('t-volunteer@example.test'),
  'created_by comes from the session, not the client');
select lives_ok(
  $$update public.people set region = 'Cortés' where id = '00000000-0000-4000-8000-000000000104'$$,
  'a volunteer can edit a person');
delete from public.people where id = '00000000-0000-4000-8000-000000000104';
select is(
  (select count(*)::int from public.people where id = '00000000-0000-4000-8000-000000000104'),
  1,
  'nobody can delete a person');

select tests.authenticate_as('t-norole@example.test');
select is(
  (select count(*)::int from public.people
   where id in ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000104')),
  0,
  'a user without a role sees nobody');
select throws_ok(
  $$insert into public.people (first_name) values ('Intruso')$$,
  '42501', null,
  'a user without a role cannot register people');

select tests.authenticate_as_anon();
select throws_ok($$select count(*) from public.people$$, '42501', null, 'anon has no access');

select * from finish();
rollback;
