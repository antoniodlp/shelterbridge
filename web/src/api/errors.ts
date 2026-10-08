import { isAuthApiError, isAuthError, isAuthRetryableFetchError } from '@supabase/supabase-js'

export const API_ERROR_CODES = [
  'not_authorized',
  'not_found',
  'validation',
  'stale_record',
  'already_checked_in',
  'stay_not_open',
  'outing_already_open',
  'no_open_outing',
  'outing_exception_needs_confirmation',
  'outing_outside_stay',
  'overlapping_stays',
  'merge_same_person',
  'invalid_credentials',
  'email_not_confirmed',
  'not_invited',
  'network',
  'unknown',
] as const

export type ApiErrorCode = (typeof API_ERROR_CODES)[number]

export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly i18nKey: string
  readonly details?: unknown

  constructor(code: ApiErrorCode, details?: unknown) {
    super(code)
    this.name = 'ApiError'
    this.code = code
    this.i18nKey = `errors.${code}`
    this.details = details
  }
}

export function isApiError(error: unknown, code?: ApiErrorCode): error is ApiError {
  return error instanceof ApiError && (code === undefined || error.code === code)
}

const VALIDATION_SQLSTATES = new Set(['23505', '23514', '23502', '23503', '22007', '22008', '22P02'])

function isKnownCode(value: unknown): value is ApiErrorCode {
  return typeof value === 'string' && (API_ERROR_CODES as readonly string[]).includes(value)
}

function looksLikeFetchFailure(message: unknown): boolean {
  return typeof message === 'string' && /^(TypeError|FetchError)\b/.test(message)
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error

  if (isAuthError(error)) {
    if (isAuthRetryableFetchError(error) && error.status === 0) return new ApiError('network')
    if (error.code === 'invalid_credentials') return new ApiError('invalid_credentials')
    if (error.code === 'email_not_confirmed') return new ApiError('email_not_confirmed')
    if (error.code === 'weak_password' || error.code === 'validation_failed') return new ApiError('validation')
    // A new password equal to the current one.
    if (error.code === 'same_password') return new ApiError('validation')
    if (isAuthApiError(error) && error.status === 403) return new ApiError('not_authorized')
    return new ApiError('unknown')
  }

  if (error instanceof TypeError) return new ApiError('network')

  // Storage errors carry an HTTP status and, for a failed fetch, the original TypeError.
  if (typeof error === 'object' && error !== null && '__isStorageError' in error) {
    const { status, originalError } = error as { status?: number; originalError?: unknown }
    if (originalError instanceof TypeError) return new ApiError('network')
    if (status === 401 || status === 403) return new ApiError('not_authorized')
    if (status === 400 || status === 413 || status === 415) return new ApiError('validation')
  }

  if (typeof error === 'object' && error !== null && 'code' in error) {
    const { code, message } = error as { code: unknown; message?: unknown }
    if (code === 'P0001') return new ApiError(isKnownCode(message) ? message : 'unknown')
    if (code === '42501') return new ApiError('not_authorized')
    if (code === '23P01') return new ApiError('overlapping_stays')
    if (typeof code === 'string' && VALIDATION_SQLSTATES.has(code)) return new ApiError('validation')
    if (code === 'PGRST116') return new ApiError('not_found')
    if (looksLikeFetchFailure(message)) return new ApiError('network')
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) return new ApiError('network')

  return new ApiError('unknown')
}
