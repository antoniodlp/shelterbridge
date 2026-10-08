import { describe, expect, it } from 'vitest'
import { cleanText } from '@/lib/text'

describe('cleanText', () => {
  it('strips ordinary leading and trailing whitespace', () => {
    expect(cleanText('  Ana María \n\t')).toBe('Ana María')
  })

  it('strips no-break, figure, narrow no-break and zero-width no-break spaces', () => {
    expect(cleanText('   ﻿Luis﻿   ')).toBe('Luis')
  })

  it('keeps inner spaces', () => {
    expect(cleanText(' José  Luis ')).toBe('José  Luis')
  })

  it('returns null for blank, null and undefined', () => {
    expect(cleanText('     ')).toBeNull()
    expect(cleanText('')).toBeNull()
    expect(cleanText(null)).toBeNull()
    expect(cleanText(undefined)).toBeNull()
  })
})
