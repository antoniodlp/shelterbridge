import { globalIgnores } from 'eslint/config'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import pluginVue from 'eslint-plugin-vue'

export default defineConfigWithVueTs(
  {
    name: 'app/files-to-lint',
    files: ['**/*.{ts,vue}'],
  },
  globalIgnores(['dist/**', 'coverage/**', 'playwright-report/**', 'test-results/**', 'src/types/database.ts']),
  pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,
  {
    name: 'app/supabase-only-in-api',
    files: ['src/**/*.{ts,vue}', 'tests/**/*.ts', 'e2e/**/*.ts'],
    // src/api is the boundary. tests/api unit-tests it and may build Supabase errors.
    ignores: ['src/api/**', 'tests/api/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@supabase/*'],
              message: 'Only src/api/ may import Supabase. Call a function from @/api instead.',
            },
          ],
        },
      ],
    },
  },
)
