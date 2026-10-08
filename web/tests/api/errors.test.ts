import { AuthApiError, AuthRetryableFetchError, AuthWeakPasswordError, StorageApiError } from '@supabase/supabase-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, isApiError, toApiError, type ApiErrorCode } from '@/api/errors'

function pgError(code: string, message = 'database said no') {
  return { code, message, details: null, hint: null }
}

describe('ApiError', () => {
  it('carries the code and the i18n key', () => {
    const error = new ApiError('stale_record', { id: 'x' })
    expect(error).toBeInstanceOf(Error)
    expect(error.code).toBe('stale_record')
    expect(error.i18nKey).toBe('errors.stale_record')
    expect(error.details).toEqual({ id: 'x' })
  })

  it('isApiError checks the type and optionally the code', () => {
    const error = new ApiError('network')
    expect(isApiError(error)).toBe(true)
    expect(isApiError(error, 'network')).toBe(true)
    expect(isApiError(error, 'unknown')).toBe(false)
    expect(isApiError(new Error('x'))).toBe(false)
  })
})

describe('toApiError', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it.each<[string, ApiErrorCode]>([
    ['stay_not_open', 'stay_not_open'],
    ['outing_exception_needs_confirmation', 'outing_exception_needs_confirmation'],
    ['validation', 'validation'],
    ['not_authorized', 'not_authorized'],
  ])('maps P0001 with message %s to %s', (message, code) => {
    expect(toApiError(pgError('P0001', message)).code).toBe(code)
  })

  it('maps an unknown P0001 message to unknown', () => {
    expect(toApiError(pgError('P0001', 'something new')).code).toBe('unknown')
  })

  it.each<[string, ApiErrorCode]>([
    ['42501', 'not_authorized'],
    ['23P01', 'overlapping_stays'],
    ['23505', 'validation'],
    ['23514', 'validation'],
    ['23502', 'validation'],
    ['23503', 'validation'],
    ['22007', 'validation'],
    ['22008', 'validation'],
    ['22P02', 'validation'],
    ['PGRST116', 'not_found'],
    ['XX000', 'unknown'],
  ])('maps SQLSTATE %s to %s', (code, expected) => {
    expect(toApiError(pgError(code)).code).toBe(expected)
  })

  it('maps a PostgREST fetch failure to network', () => {
    const error = { code: '', message: 'TypeError: Failed to fetch', details: '', hint: '' }
    expect(toApiError(error).code).toBe('network')
  })

  it('maps a raw TypeError from fetch to network', () => {
    expect(toApiError(new TypeError('Failed to fetch')).code).toBe('network')
  })

  it('maps anything to network when the browser is offline', () => {
    vi.stubGlobal('navigator', { onLine: false })
    expect(toApiError(new Error('boom')).code).toBe('network')
  })

  it('maps Auth invalid_credentials', () => {
    const error = new AuthApiError('Invalid login credentials', 400, 'invalid_credentials')
    expect(toApiError(error).code).toBe('invalid_credentials')
  })

  it('maps Auth email_not_confirmed', () => {
    const error = new AuthApiError('Email not confirmed', 400, 'email_not_confirmed')
    expect(toApiError(error).code).toBe('email_not_confirmed')
  })

  it('maps a weak password to validation', () => {
    expect(toApiError(new AuthWeakPasswordError('weak', 422, ['length'])).code).toBe('validation')
  })

  it('maps a new password equal to the current one to validation', () => {
    const error = new AuthApiError('New password should be different from the old password.', 422, 'same_password')
    expect(toApiError(error).code).toBe('validation')
  })

  it('maps an Auth network failure to network', () => {
    expect(toApiError(new AuthRetryableFetchError('Failed to fetch', 0)).code).toBe('network')
  })

  it('maps other Auth 403 errors to not_authorized', () => {
    expect(toApiError(new AuthApiError('bad jwt', 403, 'bad_jwt')).code).toBe('not_authorized')
  })

  it('maps a Storage fetch failure to network', () => {
    const error = Object.assign(new Error('Failed to fetch'), {
      __isStorageError: true,
      originalError: new TypeError('Failed to fetch'),
    })
    expect(toApiError(error).code).toBe('network')
  })

  it.each([401, 403])('maps a Storage %s to not_authorized', (status) => {
    expect(toApiError(new StorageApiError('denied', status, String(status))).code).toBe('not_authorized')
  })

  it.each([400, 413, 415])('maps a Storage %s to validation', (status) => {
    expect(toApiError(new StorageApiError('rejected', status, String(status))).code).toBe('validation')
  })

  it('maps other Storage errors to unknown', () => {
    expect(toApiError(new StorageApiError('broken', 500, '500')).code).toBe('unknown')
  })

  it('returns an ApiError unchanged', () => {
    const error = new ApiError('stale_record')
    expect(toApiError(error)).toBe(error)
  })

  it('maps anything else to unknown without leaking the original message', () => {
    const error = toApiError(new Error('María López already exists'))
    expect(error.code).toBe('unknown')
    expect(error.message).toBe('unknown')
  })
})
