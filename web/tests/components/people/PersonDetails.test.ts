import { afterEach, describe, expect, it } from 'vitest'
import PersonDetails from '@/components/people/PersonDetails.vue'
import { makePerson, uuid } from '../../fixtures/data'
import { mountWithApp } from '../../utils/mountWithApp'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('PersonDetails', () => {
  it('names the carer row "Persona responsable" and links to their record', async () => {
    const minor = makePerson({ id: uuid(3), birth_date: '2018-05-01', carer_id: uuid(1) })
    const carer = makePerson({ id: uuid(1) })
    const { wrapper } = await mountWithApp(PersonDetails, { props: { person: minor, carer } })
    expect(wrapper.find('dt:last-of-type').text()).toBe('Persona responsable')
    expect(wrapper.find(`a[href="/people/${uuid(1)}"]`).text()).toBe('Rosa Elena Pérez Lara')
  })

  it('has no carer row for a person without a carer', async () => {
    const { wrapper } = await mountWithApp(PersonDetails, { props: { person: makePerson(), carer: null } })
    expect(wrapper.text()).not.toContain('Persona responsable')
  })
})
