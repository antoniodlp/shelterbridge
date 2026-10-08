// @vitest-environment node
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

const eslint = new ESLint()

async function ruleIdsFor(filePath: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath })
  return (result?.messages ?? []).map((m) => m.ruleId ?? 'parse-error')
}

// The first lint loads the parsers, which can be slow on a cold Windows cache.
describe('Supabase import boundary', { timeout: 60_000 }, () => {
  const code = "import { createClient } from '@supabase/supabase-js'\nexport const make = createClient\n"
  const typeCode = "import type { Session } from '@supabase/supabase-js'\nexport type S = Session\n"

  it('rejects supabase-js in a view', async () => {
    expect(await ruleIdsFor('src/views/Example.ts', code)).toContain('no-restricted-imports')
  })

  it('rejects type-only imports in a store', async () => {
    expect(await ruleIdsFor('src/stores/example.ts', typeCode)).toContain('no-restricted-imports')
  })

  it('rejects other Supabase packages in a component', async () => {
    const sfc =
      "<script setup lang=\"ts\">\nimport { AuthError } from '@supabase/auth-js'\nconsole.log(AuthError)\n</script>\n<template><div /></template>\n"
    expect(await ruleIdsFor('src/components/Example.vue', sfc)).toContain('no-restricted-imports')
  })

  it('allows supabase-js inside src/api', async () => {
    expect(await ruleIdsFor('src/api/example.ts', code)).not.toContain('no-restricted-imports')
  })
})
