begin;
select plan(16);

select tests.create_user('t-admin@example.test', 'admin');
select tests.create_user('t-volunteer@example.test', 'volunteer');
select tests.create_user('t-norole@example.test');
select tests.create_user('t-inactive@example.test', 'psychology');
update public.app_users set active = false where email = 't-inactive@example.test';

select is(
  (select user_id from public.app_users where email = 't-volunteer@example.test'),
  tests.user_id('t-volunteer@example.test'),
  'an invitation for an existing auth user is linked on insert');

insert into public.app_users (email, role, display_name)
values ('  Later@Example.TEST ', 'legal', 'Later');
select is(
  (select count(*)::int from public.app_users where email = 'later@example.test'),
  1,
  'emails are trimmed and lowercased');

select tests.create_user('later@example.test');
select is(
  (select user_id from public.app_users where email = 'later@example.test'),
  tests.user_id('later@example.test'),
  'an auth user created after the invitation is linked');

select tests.authenticate_as('t-admin@example.test');
select is(app.current_app_role(), 'admin'::public.app_role, 'an admin resolves to admin');

select tests.authenticate_as('t-volunteer@example.test');
select is(app.current_app_role(), 'volunteer'::public.app_role, 'a volunteer resolves to volunteer');

select tests.authenticate_as('t-norole@example.test');
select is(app.current_app_role(), null::public.app_role, 'a user without an invitation has no role');

select tests.authenticate_as('t-inactive@example.test');
select is(app.current_app_role(), null::public.app_role, 'an inactive user has no role');
select is(
  (select count(*)::int from public.app_users),
  1,
  'an inactive user can still read their own row');

select tests.authenticate_as('t-volunteer@example.test');
select is((select count(*)::int from public.app_users), 1, 'a non-admin reads only their own row');
select throws_ok(
  $$insert into public.app_users (email, role, display_name) values ('x@example.test', 'admin', 'X')$$,
  '42501', null,
  'a non-admin cannot invite users');

select tests.authenticate_as('t-admin@example.test');
select ok((select count(*) from public.app_users) >= 4, 'an admin reads every row');
select lives_ok(
  $$update public.app_users set role = 'legal' where email = 't-volunteer@example.test'$$,
  'an admin can change a role');

select tests.authenticate_as_anon();
select throws_ok($$select count(*) from public.app_users$$, '42501', null, 'anon has no access');

select tests.reset_auth();
select is(
  public.hook_before_user_created('{"user": {"email": "Later@Example.test"}}'::jsonb),
  '{}'::jsonb,
  'an invited active email may sign up');
select is(
  public.hook_before_user_created('{"user": {"email": "stranger@example.test"}}'::jsonb) -> 'error' ->> 'http_code',
  '403',
  'an email without an invitation is rejected');
select is(
  public.hook_before_user_created('{"user": {"email": "t-inactive@example.test"}}'::jsonb) -> 'error' ->> 'http_code',
  '403',
  'an inactive invitation is rejected');

select * from finish();
rollback;
