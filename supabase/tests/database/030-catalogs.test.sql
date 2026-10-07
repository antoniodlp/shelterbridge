begin;
select plan(10);

select tests.create_user('t-admin@example.test', 'admin');
select tests.create_user('t-volunteer@example.test', 'volunteer');

select is((select count(*)::int from public.countries), 249, 'all ISO 3166-1 countries are loaded');
select is((select labels ->> 'es' from public.countries where code = 'MX'), 'México', 'country labels are in Spanish');
select is((select sort_order from public.countries where code = 'MX'), 1, 'common origin countries sort first');

select tests.authenticate_as('t-volunteer@example.test');
select is((select count(*)::int from public.countries), 249, 'a volunteer can read catalogs');
select throws_ok(
  $$insert into public.case_types (code, labels) values ('x_case', '{"es": "X"}')$$,
  '42501', null,
  'a volunteer cannot edit catalogs');

select tests.authenticate_as('t-admin@example.test');
select lives_ok(
  $$insert into public.case_types (code, labels) values ('t_case', '{"es": "Caso de prueba"}')$$,
  'an admin can add a catalog value');
select throws_ok(
  $$insert into public.genders (code, labels) values ('t_gender', '{"en": "Only English"}')$$,
  '23514', null,
  'a label without Spanish is rejected');
select throws_ok(
  $$insert into public.genders (code, labels) values ('Bad Code', '{"es": "X"}')$$,
  '23514', null,
  'codes must be lowercase slugs');
select throws_ok(
  $$update public.case_types set code = 't_case_renamed' where code = 't_case'$$,
  'P0001', 'validation',
  'codes cannot change');

select tests.authenticate_as_anon();
select throws_ok($$select count(*) from public.countries$$, '42501', null, 'anon has no access');

select * from finish();
rollback;
