import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getOperatorName, setOperatorName, supabase } from '@/api/client'

const fetchMock = vi.fn(
  async () => new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } }),
)

function lastHeaders(): Headers {
  const call = fetchMock.mock.calls.at(-1) as unknown as [RequestInfo, RequestInit | undefined]
  return new Headers(call[1]?.headers)
}

describe('api client operator header', () => {
  beforeEach(() => {
    fetchMock.mockClear()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    setOperatorName(null)
    vi.unstubAllGlobals()
  })

  it('sends no operator header when none is set', async () => {
    await supabase.from('settings').select('key')
    expect(fetchMock).toHaveBeenCalled()
    expect(lastHeaders().has('x-operator-name')).toBe(false)
  })

  it('sends the operator name as base64 UTF-8', async () => {
    setOperatorName('José Pérez y Ñandú')
    await supabase.from('settings').select('key')
    const encoded = lastHeaders().get('x-operator-name')
    expect(encoded).toBe(Buffer.from('José Pérez y Ñandú', 'utf8').toString('base64'))
  })

  it('keeps the Supabase auth headers', async () => {
    setOperatorName('Ana')
    await supabase.from('settings').select('key')
    expect(lastHeaders().get('apikey')).toBeTruthy()
  })

  it('trims the name and treats blank as no operator', () => {
    setOperatorName('  Luis  ')
    expect(getOperatorName()).toBe('Luis')
    setOperatorName('   ')
    expect(getOperatorName()).toBeNull()
  })
})
