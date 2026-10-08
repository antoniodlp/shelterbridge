import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { listCurrentResidents } from '@/api/stays'
import PersonForm from '@/components/people/PersonForm.vue'
import { emptyPerson } from '@/components/people/personFormModel'
import { ageOn, todayIn } from '@/lib/shelterTime'
import { mountWithApp } from '../../utils/mountWithApp'
import { typeInto } from '../../utils/syncfusion'

const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('@/composables/useNotify', () => ({ useNotify: () => notify }))
vi.mock('@/api/stays', () => ({ listCurrentResidents: vi.fn() }))

const tz = 'America/Mexico_City'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(listCurrentResidents).mockResolvedValue([])
})

afterEach(() => {
  document.body.innerHTML = ''
})

function mountForm(model: ReturnType<typeof emptyPerson>) {
  return mountWithApp(PersonForm, { props: { modelValue: model } })
}

describe('PersonForm', () => {
  it('hides the carer picker for an adult and shows the age', async () => {
    const model = reactive({ ...emptyPerson(), first_name: 'Rosa', birth_date: '1996-04-12' })
    const { wrapper } = await mountForm(model)
    expect(wrapper.find('[data-testid="carer-section"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="person-age"]').text()).toBe(
      `Edad: ${ageOn('1996-04-12', todayIn(tz))}`,
    )
  })

  it('shows the carer picker once the birth date makes the person a minor', async () => {
    const model = reactive(emptyPerson())
    const { wrapper } = await mountForm(model)
    const today = todayIn(tz)
    const year = Number(today.slice(0, 4)) - 10
    await typeInto(wrapper.find('#person-birth-date'), `01/${today.slice(5, 7)}/${year}`)
    expect(model.birth_date).toBe(`${year}-${today.slice(5, 7)}-01`)
    await vi.waitFor(() => expect(wrapper.find('[data-testid="carer-section"]').exists()).toBe(true))
    expect(listCurrentResidents).toHaveBeenCalled()
    const section = wrapper.find('[data-testid="carer-section"]')
    expect(section.find('label').text()).toBe('Persona responsable')
  })

  it('marks an estimated age with a tilde', async () => {
    const model = reactive({ ...emptyPerson(), birth_date: '1996-04-12', birth_date_estimated: true })
    const { wrapper } = await mountForm(model)
    expect(wrapper.find('[data-testid="person-age"]').text()).toContain('~')
  })

  it('shows field errors', async () => {
    const model = reactive(emptyPerson())
    const { wrapper } = await mountWithApp(PersonForm, {
      props: { modelValue: model, errors: { first_name: 'validation.required' } },
    })
    expect(wrapper.find('#person-first-name').classes()).toContain('is-invalid')
    expect(wrapper.text()).toContain('Este dato es obligatorio.')
  })
})
