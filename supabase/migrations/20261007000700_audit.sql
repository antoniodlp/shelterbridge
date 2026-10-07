-- Audit log of every change, attributed to the user, role and operator on shift.

create table public.audit_log (
  id            bigint generated always as identity primary key,
  at            timestamptz not null default now(),
  actor_user_id uuid,
  actor_role    public.app_role,
  operator_name text,
  table_name    text not null,
  record_id     text not null,
  action        text not null check (action in ('insert', 'update', 'delete', 'merge')),
  old_data      jsonb,
  new_data      jsonb
);

revoke all on table public.audit_log from anon;
revoke insert, update, delete, truncate on table public.audit_log from authenticated;

create index audit_log_record on public.audit_log (table_name, record_id);
create index audit_log_at on public.audit_log (at desc);

alter table public.audit_log enable row level security;

create policy audit_log_select on public.audit_log for select to authenticated
  using ((select app.current_app_role()) = 'admin');

-- The volunteer on shift, sent by the web app as base64 UTF-8. Attribution only.
create function app.operator_name()
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_encoded text;
begin
  v_encoded := nullif(current_setting('request.headers', true), '')::json ->> 'x-operator-name';
  if v_encoded is null then
    return null;
  end if;
  return nullif(trim(convert_from(decode(v_encoded, 'base64'), 'UTF8')), '');
exception
  when others then
    return null;
end;
$$;

create function app.write_audit(p_table text, p_record_id text, p_action text, p_old jsonb, p_new jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_log (
    actor_user_id, actor_role, operator_name, table_name, record_id, action, old_data, new_data)
  values (
    auth.uid(), app.current_app_role(), app.operator_name(), p_table, p_record_id, p_action, p_old, p_new);
end;
$$;

-- Trigger argument: the key column (default "id").
create function app.audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text := coalesce(tg_argv[0], 'id');
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
begin
  perform app.write_audit(tg_table_name, coalesce(v_new, v_old) ->> v_key, lower(tg_op), v_old, v_new);
  return null;
end;
$$;

create trigger audit after insert or update or delete on public.people
  for each row execute function app.audit();
create trigger audit after insert or update or delete on public.stays
  for each row execute function app.audit();
create trigger audit after insert or update or delete on public.outings
  for each row execute function app.audit();
create trigger audit after insert or update or delete on public.countries
  for each row execute function app.audit('code');
create trigger audit after insert or update or delete on public.case_types
  for each row execute function app.audit('code');
create trigger audit after insert or update or delete on public.genders
  for each row execute function app.audit('code');
create trigger audit after insert or update or delete on public.settings
  for each row execute function app.audit('key');
create trigger audit after insert or update or delete on public.app_users
  for each row execute function app.audit('email');
