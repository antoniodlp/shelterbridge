begin;
select plan(13);

select tests.create_user('t-volunteer@example.test', 'volunteer');
select tests.create_user('t-norole@example.test');

insert into public.people (id, first_name, last_name, birth_date, country_code) values
  ('00000000-0000-4000-8000-000000000801', 'Xiomara', 'Zuluaga Ñáñez', date '1990-03-07', 'HN'),
  ('00000000-0000-4000-8000-000000000802', 'Wenceslao', 'Ybarra', date '1985-01-01', 'GT'),
  ('00000000-0000-4000-8000-000000000803', 'Wenceslao', 'Ybarra', date '1999-09-09', 'GT'),
  ('00000000-0000-4000-8000-000000000804', 'Quirino', null, null, 'NI'),
  ('00000000-0000-4000-8000-000000000805', 'Xiomara', 'Zuluaga Ñáñez', date '1990-03-07', 'HN');
update public.people set merged_into_id = '00000000-0000-4000-8000-000000000801'
where id = '00000000-0000-4000-8000-000000000805';
insert into public.stays (person_id, entry_date)
values ('00000000-0000-4000-8000-000000000801', app.today() - 1);

select tests.authenticate_as('t-volunteer@example.test');

select is(
  (select person_id from public.find_possible_duplicates('xiomara', 'zuluaga nanez') limit 1),
  '00000000-0000-4000-8000-000000000801'::uuid,
  'accents and case do not prevent a match');
select is(
  (select person_id from public.find_possible_duplicates('Zuluaga Ñáñez', 'Xiomara') limit 1),
  '00000000-0000-4000-8000-000000000801'::uuid,
  'swapped first and last names still match');
select ok(
  (select score from public.find_possible_duplicates('Xiomara', 'Zuluaga Ñáñez', date '1990-07-03')
   where person_id = '00000000-0000-4000-8000-000000000801')
  >
  (select score from public.find_possible_duplicates('Xiomara', 'Zuluaga Ñáñez')
   where person_id = '00000000-0000-4000-8000-000000000801'),
  'a birth date with day and month swapped raises the score');
select is(
  (select person_id from public.find_possible_duplicates('Wenceslao', 'Ybarra', date '1985-01-01') limit 1),
  '00000000-0000-4000-8000-000000000802'::uuid,
  'an exact birth date ranks first');
select is(
  (select count(*)::int from public.find_possible_duplicates('Xiomara', 'Zuluaga Ñáñez')
   where person_id = '00000000-0000-4000-8000-000000000805'),
  0,
  'merged records are not suggested');
select is(
  (select person_id from public.find_possible_duplicates('Quirino', 'Altamirano') limit 1),
  '00000000-0000-4000-8000-000000000804'::uuid,
  'a single-name record matches a full name');
select is(
  (select count(*)::int from public.find_possible_duplicates('X', null)),
  0,
  'a one-letter name returns no suggestions');

select is(
  (select person_id from public.search_people('ñáñez') limit 1),
  '00000000-0000-4000-8000-000000000801'::uuid,
  'search ignores accents');
select is(
  (select has_open_stay from public.search_people('xiomara zuluaga')
   where person_id = '00000000-0000-4000-8000-000000000801'),
  true,
  'search reports an open stay');
select is((select count(*)::int from public.search_people('%%')), 0, 'wildcards are treated as text');
select is((select count(*)::int from public.search_people('a')), 0, 'a one-letter search returns nothing');
select is(
  (select count(*)::int from public.search_people('zuluaga')
   where person_id = '00000000-0000-4000-8000-000000000805'),
  0,
  'merged records are not searchable');

select tests.authenticate_as('t-norole@example.test');
select throws_ok(
  $$select * from public.search_people('xiomara')$$,
  'P0001', 'not_authorized',
  'a user without a role cannot search');

select * from finish();
rollback;
