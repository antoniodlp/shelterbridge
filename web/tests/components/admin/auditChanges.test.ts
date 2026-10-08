import { describe, expect, it } from 'vitest'
import { changedFields } from '@/components/admin/auditChanges'

describe('changedFields', () => {
  it('lists the fields an update changed, ignoring bookkeeping columns', () => {
    expect(
      changedFields({
        action: 'update',
        old_data: { bed: 'A1', notes: null, updated_at: 'x', updated_by: 'a' },
        new_data: { bed: 'B2', notes: null, updated_at: 'y', updated_by: 'b' },
      }),
    ).toEqual(['bed'])
  })

  it('lists the filled fields of an insert or a delete', () => {
    expect(changedFields({ action: 'insert', old_data: null, new_data: { first_name: 'Ana', region: null } })).toEqual([
      'first_name',
    ])
    expect(changedFields({ action: 'delete', old_data: { bed: 'C1' }, new_data: null })).toEqual(['bed'])
  })

  it('shows the ids involved in a merge', () => {
    expect(
      changedFields({ action: 'merge', old_data: null, new_data: { survivor_id: 'a', duplicate_id: 'b' } }),
    ).toEqual(['survivor_id', 'duplicate_id'])
  })
})
