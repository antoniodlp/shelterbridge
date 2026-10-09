// Fictitious rows for component tests. None of these people exist.
// Catalogs and app users come from Plan 2: testCatalogs and fakeAppUser in tests/utils/mountWithApp.ts.
import type { AuditEntry, CurrentResident, Outing, Person, Stay } from '@/types/domain'
import type { ResidentRow } from '@/composables/useResidents'

export const STAMP = '2026-10-01T15:00:00+00:00'

/** uuid(1) is 00000000-0000-4000-8000-000000000001. */
export function uuid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
}

export function makeResident(overrides: Partial<CurrentResident> = {}): CurrentResident {
  return {
    stay_id: uuid(101),
    person_id: uuid(1),
    first_name: 'Rosa Elena',
    last_name: 'Pérez Lara',
    photo_path: null,
    gender_code: 'female',
    country_code: 'HN',
    region: null,
    birth_date: '1996-04-12',
    birth_date_estimated: false,
    age: 30,
    carer_id: null,
    bed: 'A1',
    entry_date: '2026-10-03',
    days_in_shelter: 4,
    case_type_code: 'migrant_in_transit',
    phone_status: 'none',
    notes: null,
    stay_updated_at: STAMP,
    presence: 'inside',
    out_since: null,
    open_outing_id: null,
    outings_today: 0,
    is_minor: false,
    is_unaccompanied_minor: false,
    ...overrides,
  }
}

export function makePerson(overrides: Partial<Person> = {}): Person {
  return {
    id: uuid(1),
    first_name: 'Rosa Elena',
    last_name: 'Pérez Lara',
    birth_date: '1996-04-12',
    birth_date_estimated: false,
    gender_code: 'female',
    country_code: 'HN',
    region: 'Cortés',
    carer_id: null,
    photo_path: null,
    search_name: 'rosa elena perez lara',
    merged_into_id: null,
    source: 'app',
    created_at: STAMP,
    created_by: null,
    updated_at: STAMP,
    updated_by: null,
    ...overrides,
  }
}

export function makeStay(overrides: Partial<Stay> = {}): Stay {
  return {
    id: uuid(101),
    person_id: uuid(1),
    entry_date: '2026-10-03',
    exit_date: null,
    case_type_code: 'migrant_in_transit',
    bed: 'A1',
    phone_status: 'with_person',
    notes: null,
    source: 'app',
    created_at: STAMP,
    created_by: null,
    updated_at: STAMP,
    updated_by: null,
    ...overrides,
  }
}

export function makeOuting(overrides: Partial<Outing> = {}): Outing {
  return {
    id: uuid(201),
    stay_id: uuid(101),
    left_at: '2026-10-06T16:00:00+00:00',
    returned_at: '2026-10-06T18:30:00+00:00',
    is_exception: false,
    comment: null,
    created_at: STAMP,
    created_by: null,
    updated_at: STAMP,
    updated_by: null,
    ...overrides,
  }
}

export function makeAuditEntry(overrides: Partial<AuditEntry> = {}): AuditEntry {
  return {
    id: 1,
    at: '2026-10-06T16:00:00+00:00',
    actor_user_id: uuid(301),
    actor_role: 'volunteer',
    operator_name: 'Ana, Luis',
    table_name: 'people',
    record_id: uuid(1),
    action: 'update',
    old_data: { last_name: 'Pérez' },
    new_data: { last_name: 'Pérez Lara' },
    ...overrides,
  }
}

export function makeResidentRow(overrides: Partial<ResidentRow> = {}): ResidentRow {
  return {
    stay_id: uuid(101),
    person_id: uuid(1),
    first_name: 'Rosa Elena',
    last_name: 'Pérez Lara',
    full_name: 'Rosa Elena Pérez Lara',
    photo_path: null,
    thumb_url: null,
    age: 30,
    age_label: '30',
    carer_name: '',
    bed: 'A1',
    entry_date: '2026-10-03',
    entry_date_label: '03/10/2026',
    days_in_shelter: 4,
    presence: 'inside',
    presence_label: 'Dentro',
    out_since: null,
    out_since_label: '',
    outings_today: 0,
    phone_status: 'none',
    phone_status_label: 'Sin teléfono',
    is_minor: false,
    is_unaccompanied_minor: false,
    busy: false,
    ...overrides,
  }
}
