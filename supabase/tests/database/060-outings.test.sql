begin;
select plan(12);

select tests.create_user('t-admin@example.test', 'admin');
select tests.create_user('t-volunteer@example.test', 'volunteer');

insert into public.people (id, first_name) values ('00000000-0000-4000-8000-000000000301', 'Persona Tres');
insert into public.stays (id, person_id, entry_date)
values ('00000000-0000-4000-8000-000000000311', '00000000-0000-4000-8000-000000000301', app.today() - 3);

select tests.authenticate_as('t-volunteer@example.test');
select lives_ok(
  $$insert into public.outings (id, stay_id, left_at, returned_at, comment)
    values ('00000000-0000-4000-8000-000000000321', '00000000-0000-4000-8000-000000000311',
            now() - interval '2 days', now() - interval '2 days' + interval '1 hour', '  ')$$,
  'a volunteer can record an outing');
select is(
  (select comment from public.outings where id = '00000000-0000-4000-8000-000000000321'),
  null::text,
  'a blank comment is stored as null');
insert into public.outings (id, stay_id, left_at, returned_at, comment)
values ('00000000-0000-4000-8000-000000000322', '00000000-0000-4000-8000-000000000311',
        now() - interval '1 day', now() - interval '1 day' + interval '1 hour', E'\t' || chr(160));
select is(
  (select comment from public.outings where id = '00000000-0000-4000-8000-000000000322'),
  null::text,
  'a comment of only a tab and a non-breaking space is stored as null');
select lives_ok(
  $$insert into public.outings (stay_id, left_at)
    values ('00000000-0000-4000-8000-000000000311', now() - interval '1 hour')$$,
  'an open outing can be recorded');
select throws_ok(
  $$insert into public.outings (stay_id, left_at)
    values ('00000000-0000-4000-8000-000000000311', now() - interval '30 minutes')$$,
  '23505', null,
  'a second open outing is rejected');
select throws_ok(
  $$insert into public.outings (stay_id, left_at, returned_at)
    values ('00000000-0000-4000-8000-000000000311', now() - interval '3 hours', now() - interval '4 hours')$$,
  '23514', null,
  'a return before leaving is rejected');
select throws_ok(
  $$insert into public.outings (stay_id, left_at, returned_at)
    values ('00000000-0000-4000-8000-000000000311', now() - interval '10 days', now() - interval '10 days' + interval '1 hour')$$,
  'P0001', 'outing_outside_stay',
  'an outing before the stay began is rejected');
select throws_ok(
  $$insert into public.outings (stay_id, left_at)
    values ('00000000-0000-4000-8000-000000000311', now() + interval '1 hour')$$,
  'P0001', 'validation',
  'an outing in the future is rejected');
select throws_ok(
  $$update public.stays set exit_date = app.today() - 3 where id = '00000000-0000-4000-8000-000000000311'$$,
  'P0001', 'outing_outside_stay',
  'a check-out date before an existing outing is rejected');

delete from public.outings where id = '00000000-0000-4000-8000-000000000321';
select is(
  (select count(*)::int from public.outings where id = '00000000-0000-4000-8000-000000000321'),
  1,
  'a volunteer cannot delete an outing');

select tests.authenticate_as('t-admin@example.test');
delete from public.stays where id = '00000000-0000-4000-8000-000000000311';
select is(
  (select count(*)::int from public.outings where stay_id = '00000000-0000-4000-8000-000000000311'),
  0,
  'deleting a stay deletes its outings');

select tests.authenticate_as_anon();
select throws_ok($$select count(*) from public.outings$$, '42501', null, 'anon has no access');

select * from finish();
rollback;
