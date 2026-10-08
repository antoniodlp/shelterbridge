import { describe, expectTypeOf, it } from 'vitest'
import type { AppRole, AppUser, CatalogName, CurrentResident, Person, Stay } from '@/types/domain'

// Checked by the typecheck script; at runtime these assertions do nothing.
describe('domain types', () => {
  it('follow the generated database types', () => {
    expectTypeOf<AppRole>().toEqualTypeOf<'admin' | 'legal' | 'psychology' | 'volunteer'>()
    expectTypeOf<AppUser['role']>().toEqualTypeOf<AppRole>()
    expectTypeOf<Person['first_name']>().toEqualTypeOf<string>()
    expectTypeOf<Person['last_name']>().toEqualTypeOf<string | null>()
    expectTypeOf<Stay['exit_date']>().toEqualTypeOf<string | null>()
    expectTypeOf<CurrentResident>().toHaveProperty('is_unaccompanied_minor')
    expectTypeOf<CurrentResident>().toHaveProperty('stay_updated_at')
    expectTypeOf<CatalogName>().toEqualTypeOf<'countries' | 'case_types' | 'genders'>()
  })
})
