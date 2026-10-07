begin;
select plan(13);

select tests.create_user('t-admin@example.test', 'admin');
select tests.create_user('t-volunteer@example.test', 'volunteer');

insert into public.people (id, first_name, last_name) values
  ('00000000-0000-4000-8000-000000000901', 'Rigoberto', 'Fuentes'),
  ('00000000-0000-4000-8000-000000000902', 'Rigoberto', 'Fuentes'),
  ('00000000-0000-4000-8000-000000000903', 'Hija', 'Fuentes'),
  ('00000000-0000-4000-8000-000000000906', 'Solapa', 'Uno'),
  ('00000000-0000-4000-8000-000000000907', 'Solapa', 'Dos'),
  ('00000000-0000-4000-8000-000000000908', 'Mismo', 'Dia'),
  ('00000000-0000-4000-8000-000000000909', 'Mismo', 'Dia');
-- A child whose carer is the duplicate, and a survivor whose carer was wrongly set to the duplicate.
update public.people set carer_id = '00000000-0000-4000-8000-000000000902'
where id in ('00000000-0000-4000-8000-000000000903', '00000000-0000-4000-8000-000000000901');

insert into public.stays (person_id, entry_date, exit_date)
values ('00000000-0000-4000-8000-000000000901', app.today() - 60, app.today() - 50);
insert into public.stays (person_id, entry_date) values
  ('00000000-0000-4000-8000-000000000902', app.today() - 5),
  ('00000000-0000-4000-8000-000000000906', app.today() - 5),
  ('00000000-0000-4000-8000-000000000907', app.today() - 3);
-- A closed stay for one record and a same-day stay (entry = exit) inside it for the other.
insert into public.stays (person_id, entry_date, exit_date) values
  ('00000000-0000-4000-8000-000000000908', app.today() - 20, app.today() - 10),
  ('00000000-0000-4000-8000-000000000909', app.today() - 15, app.today() - 15);

select tests.authenticate_as('t-volunteer@example.test');
select throws_ok(
  $$select public.merge_people('00000000-0000-4000-8000-000000000901', '00000000-0000-4000-8000-000000000902')$$,
  'P0001', 'not_authorized',
  'only admins can merge');

select tests.authenticate_as('t-admin@example.test');
select throws_ok(
  $$select public.merge_people('00000000-0000-4000-8000-000000000901', '00000000-0000-4000-8000-000000000901')$$,
  'P0001', 'merge_same_person',
  'a person cannot be merged with themselves');
select throws_ok(
  $$select public.merge_people('00000000-0000-4000-8000-000000000901', '00000000-0000-4000-8000-000000000999')$$,
  'P0001', 'not_found',
  'an unknown person is reported');
select throws_ok(
  $$select public.merge_people('00000000-0000-4000-8000-000000000906', '00000000-0000-4000-8000-000000000907')$$,
  'P0001', 'overlapping_stays',
  'records with overlapping stays cannot be merged');
select is(
  (select merged_into_id from public.people where id = '00000000-0000-4000-8000-000000000907'),
  null::uuid,
  'a rejected merge changes nothing');
select throws_ok(
  $$select public.merge_people('00000000-0000-4000-8000-000000000908', '00000000-0000-4000-8000-000000000909')$$,
  'P0001', 'overlapping_stays',
  'a same-day stay inside another stay counts as overlapping');
select lives_ok(
  $$select public.merge_people('00000000-0000-4000-8000-000000000901', '00000000-0000-4000-8000-000000000902')$$,
  'an admin can merge duplicates');
select is(
  (select count(*)::int from public.stays where person_id = '00000000-0000-4000-8000-000000000901'),
  2,
  'the stays of the duplicate move to the survivor');
select is(
  (select merged_into_id from public.people where id = '00000000-0000-4000-8000-000000000902'),
  '00000000-0000-4000-8000-000000000901'::uuid,
  'the duplicate points to the survivor');
select is(
  (select carer_id from public.people where id = '00000000-0000-4000-8000-000000000903'),
  '00000000-0000-4000-8000-000000000901'::uuid,
  'carer links move to the survivor');
select is(
  (select carer_id from public.people where id = '00000000-0000-4000-8000-000000000901'),
  null::uuid,
  'a survivor never becomes their own carer');
select is(
  (select count(*)::int from public.audit_log
   where table_name = 'people' and record_id = '00000000-0000-4000-8000-000000000902' and action = 'merge'),
  1,
  'the merge is audited');
select throws_ok(
  $$select public.merge_people('00000000-0000-4000-8000-000000000901', '00000000-0000-4000-8000-000000000902')$$,
  'P0001', 'not_found',
  'an already merged record cannot be merged again');

select * from finish();
rollback;
