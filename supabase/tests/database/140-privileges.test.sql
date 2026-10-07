begin;
select plan(5);

select is(
  (select count(*)::int
   from pg_catalog.pg_class c
   join pg_catalog.pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind in ('r', 'v')
     and has_table_privilege('anon', c.oid, 'select, insert, update, delete')),
  0,
  'anon has no privileges on public tables or views');
select is(
  (select count(*)::int
   from pg_catalog.pg_class c
   join pg_catalog.pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  0,
  'every public table has row level security enabled');
select is(
  (select count(*)::int
   from pg_catalog.pg_proc p
   join pg_catalog.pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')),
  0,
  'anon cannot execute any public function');
select ok(
  not has_function_privilege('authenticated', 'public.hook_before_user_created(jsonb)', 'execute'),
  'clients cannot call the sign-up hook');
select ok(
  has_function_privilege('supabase_auth_admin', 'public.hook_before_user_created(jsonb)', 'execute'),
  'the auth server can call the sign-up hook');

select * from finish();
rollback;
