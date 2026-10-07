begin;
select plan(9);

select tests.create_user('t-volunteer@example.test', 'volunteer');
select tests.create_user('t-admin@example.test', 'admin');
select tests.create_user('t-norole@example.test');

select is(
  (select public from storage.buckets where id = 'person-photos'),
  false,
  'the photo bucket is private');

select tests.authenticate_as('t-volunteer@example.test');
select lives_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('person-photos', '00000000-0000-4000-8000-000000000a01.jpg')$$,
  'a volunteer can upload a photo');
select is(
  (select count(*)::int from storage.objects where name = '00000000-0000-4000-8000-000000000a01.jpg'),
  1,
  'a volunteer can read photos');
with u as (
  update storage.objects set metadata = '{"note": "x"}'
  where name = '00000000-0000-4000-8000-000000000a01.jpg'
  returning 1)
select is((select count(*)::int from u), 1, 'a volunteer can replace a photo');

-- Storage blocks plain SQL deletes unless this setting is on (the Storage API sets it).
-- With it on, the delete policy alone decides who can delete.
select set_config('storage.allow_delete_query', 'true', true);
delete from storage.objects where name = '00000000-0000-4000-8000-000000000a01.jpg';
select is(
  (select count(*)::int from storage.objects where name = '00000000-0000-4000-8000-000000000a01.jpg'),
  1,
  'a volunteer cannot delete a photo');

select tests.authenticate_as('t-admin@example.test');
select set_config('storage.allow_delete_query', 'true', true);
delete from storage.objects where name = '00000000-0000-4000-8000-000000000a01.jpg';
select is(
  (select count(*)::int from storage.objects where name = '00000000-0000-4000-8000-000000000a01.jpg'),
  0,
  'an admin can delete a photo');
select set_config('storage.allow_delete_query', 'false', true);

select tests.authenticate_as('t-norole@example.test');
select is(
  (select count(*)::int from storage.objects where bucket_id = 'person-photos'),
  0,
  'a user without a role cannot read photos');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('person-photos', 'x.jpg')$$,
  '42501', null,
  'a user without a role cannot upload photos');

select tests.authenticate_as_anon();
select is(
  (select count(*)::int from storage.objects where bucket_id = 'person-photos'),
  0,
  'anon cannot read photos');

select * from finish();
rollback;
