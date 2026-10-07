begin;
select plan(28);

select tests.create_user('t-admin@example.test', 'admin');
select tests.create_user('t-volunteer@example.test', 'volunteer');

insert into public.people (id, first_name, last_name) values
  ('00000000-0000-4000-8000-000000001001', 'Primera', 'Persona'),
  ('00000000-0000-4000-8000-000000001002', 'Segunda', 'Persona'),
  ('00000000-0000-4000-8000-000000001003', 'Duplicada', 'Persona'),
  ('00000000-0000-4000-8000-000000001004', 'Sobreviviente', 'Admin'),
  ('00000000-0000-4000-8000-000000001005', 'Duplicado', 'Admin'),
  ('00000000-0000-4000-8000-000000001006', 'Solapa', 'Uno'),
  ('00000000-0000-4000-8000-000000001007', 'Solapa', 'Dos'),
  ('00000000-0000-4000-8000-000000001008', 'Con', 'Estancia'),
  ('00000000-0000-4000-8000-000000001009', 'Libre', 'Persona');
update public.people set merged_into_id = '00000000-0000-4000-8000-000000001001'
where id = '00000000-0000-4000-8000-000000001003';

insert into public.stays (id, person_id, entry_date) values
  ('00000000-0000-4000-8000-000000001011', '00000000-0000-4000-8000-000000001008', app.today() - 3),
  ('00000000-0000-4000-8000-000000001015', '00000000-0000-4000-8000-000000001005', app.today() - 4),
  ('00000000-0000-4000-8000-000000001016', '00000000-0000-4000-8000-000000001006', app.today() - 5),
  ('00000000-0000-4000-8000-000000001017', '00000000-0000-4000-8000-000000001007', app.today() - 2);

-- Volunteers cannot merge, unmerge or move stays between people.
select tests.authenticate_as('t-volunteer@example.test');
select throws_ok(
  $$update public.people set merged_into_id = '00000000-0000-4000-8000-000000001002'
    where id = '00000000-0000-4000-8000-000000001001'$$,
  'P0001', 'not_authorized',
  'a volunteer cannot set merged_into_id');
select is(
  (select merged_into_id from public.people where id = '00000000-0000-4000-8000-000000001001'),
  null::uuid,
  'a rejected merge attempt leaves the person untouched');
select throws_ok(
  $$update public.people set merged_into_id = null
    where id = '00000000-0000-4000-8000-000000001003'$$,
  'P0001', 'not_authorized',
  'a volunteer cannot unmerge a person');
select throws_ok(
  $$insert into public.people (first_name, merged_into_id)
    values ('Nacida', '00000000-0000-4000-8000-000000001001')$$,
  'P0001', 'not_authorized',
  'a volunteer cannot insert a person that is already merged');
select lives_ok(
  $$update public.people set region = 'Jalisco'
    where id = '00000000-0000-4000-8000-000000001001'$$,
  'a volunteer can still edit other person fields');
select throws_ok(
  $$update public.stays set person_id = '00000000-0000-4000-8000-000000001002'
    where id = '00000000-0000-4000-8000-000000001011'$$,
  'P0001', 'not_authorized',
  'a volunteer cannot move a stay to another person');
select is(
  (select person_id from public.stays where id = '00000000-0000-4000-8000-000000001011'),
  '00000000-0000-4000-8000-000000001008'::uuid,
  'a rejected stay move leaves the stay with its person');
select lives_ok(
  $$update public.stays set bed = 'B2' where id = '00000000-0000-4000-8000-000000001011'$$,
  'a volunteer can still edit other stay fields');

-- check_in
select throws_ok(
  $$select public.check_in('00000000-0000-4000-8000-000000001003')$$,
  'P0001', 'not_found',
  'check_in rejects a merged person');
select lives_ok(
  $$select public.check_in('00000000-0000-4000-8000-000000001009')$$,
  'check_in still works for an active person');

-- A volunteer cannot promote themselves.
with u as (
  update public.app_users set role = 'admin'
  where email = 't-volunteer@example.test'
  returning 1)
select is((select count(*)::int from u), 0, 'a volunteer cannot update their own app_users row');
select is(
  (select role::text from public.app_users where email = 't-volunteer@example.test'),
  'volunteer',
  'a volunteer keeps the volunteer role');

-- Photo object names must be UUID paths.
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('person-photos', 'Juan Perez.jpg')$$,
  '42501', null,
  'a photo named after a person is rejected');
select throws_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('person-photos', '00000000-0000-4000-8000-000000001a02.png')$$,
  '42501', null,
  'a photo with the wrong extension is rejected');
select lives_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('person-photos', '00000000-0000-4000-8000-000000001a01.jpg')$$,
  'a photo with a UUID name is accepted');
select lives_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('person-photos', '00000000-0000-4000-8000-000000001a01_thumb.jpg')$$,
  'a thumbnail with a UUID name is accepted');
select throws_ok(
  $$update storage.objects set name = 'Juan Perez.jpg'
    where name = '00000000-0000-4000-8000-000000001a01.jpg'$$,
  '42501', null,
  'a photo cannot be renamed to a person name');

-- Admins can still merge.
select tests.authenticate_as('t-admin@example.test');
select throws_ok(
  $$select public.merge_people('00000000-0000-4000-8000-000000001006', '00000000-0000-4000-8000-000000001007')$$,
  'P0001', 'overlapping_stays',
  'overlapping stays still block a merge');
select lives_ok(
  $$select public.merge_people('00000000-0000-4000-8000-000000001004', '00000000-0000-4000-8000-000000001005')$$,
  'an admin can still merge duplicates');
select is(
  (select merged_into_id from public.people where id = '00000000-0000-4000-8000-000000001005'),
  '00000000-0000-4000-8000-000000001004'::uuid,
  'the duplicate points to the survivor');
select is(
  (select person_id from public.stays where id = '00000000-0000-4000-8000-000000001015'),
  '00000000-0000-4000-8000-000000001004'::uuid,
  'the stay of the duplicate moves to the survivor');

-- Privileges.
select tests.reset_auth();
select ok(
  not has_table_privilege('authenticated', 'public.people', 'truncate'),
  'authenticated cannot truncate people');
select ok(
  not has_table_privilege('authenticated', 'public.stays', 'truncate'),
  'authenticated cannot truncate stays');
select ok(
  not has_table_privilege('authenticated', 'public.people', 'references')
    and not has_table_privilege('authenticated', 'public.people', 'trigger'),
  'authenticated has no references or trigger privilege on people');
create table public.zz_probe (id int);
select ok(
  not has_table_privilege('authenticated', 'public.zz_probe', 'truncate'),
  'future tables do not grant truncate to authenticated');
select ok(
  has_schema_privilege('service_role', 'app', 'usage'),
  'service_role can use the app schema');
select ok(
  has_function_privilege('authenticated', 'public.check_in(uuid, jsonb)', 'execute')
    and has_function_privilege('authenticated', 'public.merge_people(uuid, uuid)', 'execute'),
  'authenticated can still execute check_in and merge_people');
select ok(
  pg_get_functiondef('public.merge_people(uuid, uuid)'::regprocedure) ~ 'order by p\.id\s+for update',
  'merge_people locks both people in id order');

select * from finish();
rollback;
