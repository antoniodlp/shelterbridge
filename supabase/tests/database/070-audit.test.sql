begin;
select plan(10);

select tests.create_user('t-admin@example.test', 'admin');
select tests.create_user('t-volunteer@example.test', 'volunteer');

select tests.authenticate_as('t-volunteer@example.test');
select tests.set_operator_name('José Pérez');
insert into public.people (id, first_name) values ('00000000-0000-4000-8000-000000000401', 'Auditada');
update public.people set last_name = 'Prueba' where id = '00000000-0000-4000-8000-000000000401';

select tests.authenticate_as('t-admin@example.test');
select is(
  (select actor_role::text from public.audit_log
   where table_name = 'people' and record_id = '00000000-0000-4000-8000-000000000401' and action = 'insert'),
  'volunteer',
  'the actor role is recorded');
select is(
  (select actor_user_id from public.audit_log
   where table_name = 'people' and record_id = '00000000-0000-4000-8000-000000000401' and action = 'insert'),
  tests.user_id('t-volunteer@example.test'),
  'the actor user is recorded');
select is(
  (select operator_name from public.audit_log
   where table_name = 'people' and record_id = '00000000-0000-4000-8000-000000000401' and action = 'insert'),
  'José Pérez',
  'the operator name from the header is decoded and recorded');
select is(
  (select new_data ->> 'first_name' from public.audit_log
   where table_name = 'people' and record_id = '00000000-0000-4000-8000-000000000401' and action = 'insert'),
  'Auditada',
  'the inserted row is recorded');
select is(
  (select new_data ->> 'last_name' from public.audit_log
   where table_name = 'people' and record_id = '00000000-0000-4000-8000-000000000401' and action = 'update'),
  'Prueba',
  'updates record the new values');
select ok(
  (select old_data ? 'last_name' from public.audit_log
   where table_name = 'people' and record_id = '00000000-0000-4000-8000-000000000401' and action = 'update'),
  'updates record the previous values');

select tests.authenticate_as('t-volunteer@example.test');
select set_config('request.headers', '{"x-operator-name": "***not base64***"}', true);
insert into public.people (id, first_name) values ('00000000-0000-4000-8000-000000000402', 'Sin Operador');

select tests.authenticate_as('t-admin@example.test');
select is(
  (select operator_name from public.audit_log where record_id = '00000000-0000-4000-8000-000000000402'),
  null::text,
  'an unreadable operator header is ignored');

update public.settings set value = '"America/Monterrey"' where key = 'timezone';
select is(
  (select count(*)::int from public.audit_log where table_name = 'settings' and record_id = 'timezone'),
  1,
  'settings changes are audited by key');

select tests.authenticate_as('t-volunteer@example.test');
select is((select count(*)::int from public.audit_log), 0, 'a volunteer cannot read the audit log');
select throws_ok(
  $$insert into public.audit_log (table_name, record_id, action) values ('people', 'x', 'insert')$$,
  '42501', null,
  'clients cannot write the audit log');

select * from finish();
rollback;
