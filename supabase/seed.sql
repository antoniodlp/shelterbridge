-- Local development data only. Every person here is fictitious.
-- Dev sign-in: any email below with password "shelterbridge-dev".

insert into public.case_types (code, labels, sort_order) values
  ('migrant_in_transit', '{"es": "Migrante en tránsito", "en": "Migrant in transit"}', 1),
  ('asylum_seeker', '{"es": "Solicitante de asilo", "en": "Asylum seeker"}', 2),
  ('returnee', '{"es": "Persona retornada", "en": "Returnee"}', 3),
  ('internally_displaced', '{"es": "Desplazamiento interno", "en": "Internally displaced"}', 4);

insert into public.genders (code, labels, sort_order) values
  ('female', '{"es": "Mujer", "en": "Woman"}', 1),
  ('male', '{"es": "Hombre", "en": "Man"}', 2),
  ('trans_female', '{"es": "Mujer trans", "en": "Trans woman"}', 3),
  ('trans_male', '{"es": "Hombre trans", "en": "Trans man"}', 4),
  ('non_binary', '{"es": "Persona no binaria", "en": "Non-binary person"}', 5),
  ('not_stated', '{"es": "Prefiere no decir", "en": "Prefers not to say"}', 6);

insert into public.app_users (email, role, display_name) values
  ('admin@shelterbridge.test', 'admin', 'Admin Demo'),
  ('legal@shelterbridge.test', 'legal', 'Legal Demo'),
  ('psychology@shelterbridge.test', 'psychology', 'Psicología Demo'),
  ('volunteer@shelterbridge.test', 'volunteer', 'Voluntariado Demo');

do $$
declare
  v_email text;
  v_id uuid;
begin
  foreach v_email in array array[
    'admin@shelterbridge.test',
    'legal@shelterbridge.test',
    'psychology@shelterbridge.test',
    'volunteer@shelterbridge.test']
  loop
    v_id := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change)
    values (
      '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
      extensions.crypt('shelterbridge-dev', extensions.gen_salt('bf')), now(),
      '{"provider": "email", "providers": ["email"]}', '{}', now(), now(),
      '', '', '', '');
    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (
      gen_random_uuid(), v_id, v_id::text,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
      'email', now(), now(), now());
  end loop;
end $$;

insert into public.people (id, first_name, last_name, birth_date, birth_date_estimated, gender_code, country_code, region) values
  ('b0000000-0000-4000-8000-000000000001', 'María Fernanda', 'López Reyes', date '1994-05-12', false, 'female', 'HN', 'Cortés'),
  ('b0000000-0000-4000-8000-000000000003', 'Carlos Alberto', 'Mejía', date '1988-11-30', false, 'male', 'HN', 'Francisco Morazán'),
  ('b0000000-0000-4000-8000-000000000004', 'Kevin Josué', 'Ramírez', (current_date - interval '17 years')::date, false, 'male', 'GT', 'Quetzaltenango'),
  ('b0000000-0000-4000-8000-000000000005', 'Yulimar', 'Castillo', date '1999-07-21', false, 'female', 'VE', 'Zulia'),
  ('b0000000-0000-4000-8000-000000000006', 'Jean Baptiste', 'Pierre', date '1990-01-09', false, 'male', 'HT', null),
  ('b0000000-0000-4000-8000-000000000007', 'Ana Gabriela', 'Torres', date '1985-04-02', true, 'trans_female', 'SV', 'San Salvador'),
  ('b0000000-0000-4000-8000-000000000008', 'José Luis', 'Hernández', date '1979-03-11', false, 'male', 'MX', 'Michoacán'),
  ('b0000000-0000-4000-8000-000000000009', 'Wilmer', null, null, false, 'male', 'NI', null),
  ('b0000000-0000-4000-8000-000000000010', 'Jose Luis', 'Hernandez', date '1979-11-03', false, 'male', 'MX', null);

insert into public.people (id, first_name, last_name, birth_date, gender_code, country_code, region, carer_id) values
  ('b0000000-0000-4000-8000-000000000002', 'Daniela', 'López', (current_date - interval '9 years')::date,
   'female', 'HN', 'Cortés', 'b0000000-0000-4000-8000-000000000001');

insert into public.stays (person_id, entry_date, exit_date, case_type_code, bed, phone_status, notes) values
  ('b0000000-0000-4000-8000-000000000001', app.today() - 4, null, 'migrant_in_transit', 'A1', 'with_person', null),
  ('b0000000-0000-4000-8000-000000000002', app.today() - 4, null, 'migrant_in_transit', 'A2', 'none', null),
  ('b0000000-0000-4000-8000-000000000003', app.today() - 12, null, 'asylum_seeker', 'B1', 'in_custody', 'Tiene cita la próxima semana.'),
  ('b0000000-0000-4000-8000-000000000004', app.today() - 2, null, 'migrant_in_transit', 'B2', 'with_person', null),
  ('b0000000-0000-4000-8000-000000000005', app.today() - 20, null, 'asylum_seeker', 'C1', 'with_person', 'Espera respuesta de su solicitud.'),
  ('b0000000-0000-4000-8000-000000000006', app.today() - 60, app.today() - 50, 'migrant_in_transit', 'C2', 'none', null),
  ('b0000000-0000-4000-8000-000000000006', app.today() - 1, null, 'migrant_in_transit', 'C2', 'none', null),
  ('b0000000-0000-4000-8000-000000000007', app.today() - 7, null, 'asylum_seeker', 'A3', 'in_custody', null),
  ('b0000000-0000-4000-8000-000000000008', app.today() - 30, app.today() - 10, 'returnee', 'B3', 'none', null),
  ('b0000000-0000-4000-8000-000000000009', app.today() - 3, null, null, 'B4', 'none', null),
  ('b0000000-0000-4000-8000-000000000010', app.today() - 120, app.today() - 115, 'returnee', null, 'none', null);

-- Carlos is out right now. Ana went out and came back. Yulimar went out yesterday.
insert into public.outings (stay_id, left_at, returned_at, comment)
select s.id, now() - interval '2 hours', null, 'Fue a una cita médica.'
from public.stays s
where s.person_id = 'b0000000-0000-4000-8000-000000000003' and s.exit_date is null;

insert into public.outings (stay_id, left_at, returned_at, comment)
select s.id, now() - interval '5 hours', now() - interval '3 hours', null
from public.stays s
where s.person_id = 'b0000000-0000-4000-8000-000000000007' and s.exit_date is null;

insert into public.outings (stay_id, left_at, returned_at, comment)
select s.id, now() - interval '1 day 4 hours', now() - interval '1 day 1 hour', 'Trámite en el consulado.'
from public.stays s
where s.person_id = 'b0000000-0000-4000-8000-000000000005' and s.exit_date is null;
