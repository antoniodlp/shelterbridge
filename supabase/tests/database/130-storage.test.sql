begin;
select plan(6);

select tests.create_user('t-volunteer@example.test', 'volunteer');
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
