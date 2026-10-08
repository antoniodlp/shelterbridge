import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DuplicateCandidate } from '@/api/people'
import DuplicatePanel from '@/components/people/DuplicatePanel.vue'
import { uuid } from '../../fixtures/data'
import { mountWithApp } from '../../utils/mountWithApp'

vi.mock('@/api/photos', () => ({
  photoPathFor: (id: string) => `${id}.jpg`,
  thumbPathFor: (path: string) => path.replace(/\.jpg$/, '_thumb.jpg'),
  getSignedPhotoUrls: vi.fn(async () => ({})),
  uploadPersonPhoto: vi.fn(),
}))

const returning: DuplicateCandidate = {
  person_id: uuid(7),
  first_name: 'Rosa Elena',
  last_name: 'Pérez Lara',
  birth_date: '1996-04-12',
  birth_date_estimated: true,
  country_code: 'HN',
  photo_path: null,
  score: 0.92,
  last_entry_date: '2026-08-01',
  last_exit_date: '2026-08-15',
}

function mountPanel(candidates: DuplicateCandidate[]) {
  return mountWithApp(DuplicatePanel, { props: { candidates, checking: false, failed: false } })
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('DuplicatePanel', () => {
  it('shows each candidate with name, estimated age, country and last stay', async () => {
    const { wrapper } = await mountPanel([returning])
    const item = wrapper.find('[data-testid="duplicate-candidate"]')
    expect(item.text()).toContain('Rosa Elena Pérez Lara')
    expect(item.text()).toContain('~')
    expect(item.text()).toContain('Honduras')
    expect(item.text()).toContain('Última estancia: 01/08/2026 a 15/08/2026')
  })

  it('says when the candidate is staying right now', async () => {
    const { wrapper } = await mountPanel([{ ...returning, last_exit_date: null }])
    expect(wrapper.text()).toContain('En el albergue desde 01/08/2026')
  })

  it('emits the chosen person or the decision that this is someone new', async () => {
    const { wrapper } = await mountPanel([returning])
    await wrapper.find('[data-testid="duplicate-candidate"] button').trigger('click')
    expect(wrapper.emitted('select')).toEqual([[uuid(7)]])
    const newPerson = wrapper.findAll('button').find((button) => button.text() === 'Es una persona nueva')
    await newPerson?.trigger('click')
    expect(wrapper.emitted('dismiss')).toHaveLength(1)
  })
})
