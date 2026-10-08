# Registry and Stays, Plan 2: Web Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Vue web app foundation for sub-project 1, so that a user can sign in (email and password, or Google), be routed by role and status, name the operator on the volunteer shift screen, and see the app shell in Spanish with placeholder pages for every feature screen.

**Architecture:** A Vite + Vue 3 + TypeScript SPA in `web/`. Only `web/src/api/` talks to Supabase; it returns typed data or throws `ApiError`. Pinia setup stores hold the session, catalogs and settings. The router guard is UX only, because Postgres RLS (Plan 1) is the real authorization. All UI text comes from `web/src/i18n/locales/es-MX.json` through vue-i18n, and Syncfusion components get Spanish texts and es-MX CLDR formats from the same `setLocale()` call.

**Tech Stack (versions verified by installing and running them on 2026-10-07):**
- Vue 3.5, Vue Router 5.4 (no breaking changes from 4), Pinia 4.0 and `@pinia/testing` 2.0
- Vite 8.3 with `@vitejs/plugin-vue` 6, TypeScript 6.0 (`typescript-eslint` does not support 7 yet), `vue-tsc` 3.3, `@vue/tsconfig` 0.9
- vue-i18n 11.4
- `@supabase/supabase-js` 2.117
- Syncfusion EJ2 Vue 35.1: `@syncfusion/ej2-base`, `ej2-vue-dropdowns`, `ej2-vue-popups`, `ej2-vue-notifications`, `ej2-locale`, and the theme package `@syncfusion/ej2-bootstrap5.3-theme`
- CLDR JSON: `cldr-core`, `cldr-dates-full`, `cldr-numbers-full` 48
- Bootstrap 5.3 (CSS only, no Bootstrap JavaScript)
- Vitest 4.1 (the version create-vue pairs with Vite 8), `@vue/test-utils` 2.5, jsdom 30
- Playwright 1.64
- ESLint 10 flat config with `eslint-plugin-vue` 10.11 and `@vue/eslint-config-typescript` 14.9

**Spec:** [docs/superpowers/specs/2026-10-07-shelterbridge-registry-and-stays-design.md](../specs/2026-10-07-shelterbridge-registry-and-stays-design.md)

**Contract:** [docs/superpowers/plans/2026-10-07-registry-and-stays-web-contract.md](2026-10-07-registry-and-stays-web-contract.md). This plan produces every item marked **[P2]** there, with the exact names, paths and signatures. The "Contract notes" section at the end lists the few places where this plan had to add to the contract.

**Depends on:** Plan 1 ([2026-10-07-registry-and-stays-1-database.md](2026-10-07-registry-and-stays-1-database.md)) is fully implemented, including the seed data and the four dev users from its Task 15.

## Global Constraints

- **Language:** code, identifiers, comments and commit messages are in English. Never use em dashes or en dashes in any file, comment, UI string or commit message.
- **UI text:** every user-facing string goes through vue-i18n. `es-MX` is the source locale and `web/src/i18n/locales/es-MX.json` is the only place UI text lives. Never hardcode UI text in a template or script.
- **vue-i18n message syntax:** never put `@`, `|`, `$`, `{` or `}` in a message except for `{name}`-style placeholders, because vue-i18n gives them meaning.
- **Supabase boundary:** only files under `web/src/api/` import `@supabase/*`. ESLint enforces this (Task 1). Views, components, composables and stores call `@/api/*` functions. Types from Supabase are re-exported by `api/` when other layers need them (for example `Session` from `@/api/auth`).
- **api/ contract:** every exported `api/` function returns typed data or throws an `ApiError` whose `i18nKey` is `errors.<code>`. Data objects keep the database's snake_case field names.
- **Authorization:** route guards are UX only. Never hide data in the UI as a security measure; RLS in Postgres is the enforcement.
- **Time:** dates are shown as `dd/MM/yyyy` and times as `HH:mm`, always in the shelter timezone from the settings store (default `America/Mexico_City`), never the browser's timezone. Date-only values (`YYYY-MM-DD`) are never shifted by a timezone.
- **Privacy:** no personal data in URLs (UUIDs only), console output or error messages. All test, fixture and e2e data is fictitious. Dev users and passwords are the seeded `@shelterbridge.test` ones.
- **Text input:** trim with `cleanText()` from `web/src/lib/text.ts` before sending. It strips the same whitespace the database strips.
- **Layout:** desktop first (reception computers), but every screen must work at phone width with the Bootstrap grid. No Bootstrap JavaScript: toggles (navbar collapse, dropdowns) are driven by Vue state.
- **Syncfusion:** CSS comes from `@syncfusion/ej2-bootstrap5.3-theme`, one component file per import in `web/src/main.ts` (`styles/<component>/<component>.css`, never `index.css`, which re-imports the base styles each time). Do not put `v-if` on a Syncfusion Dialog; keep it mounted and bind `visible`. Syncfusion string properties such as a Toast's or Dialog's `content` render HTML, so text that can hold names typed by staff is either rendered by Vue (as a child of the component) or HTML-escaped first.
- **Node.js:** 24.15 or later, or 22.22.2 or later (jsdom 30, vue-i18n 11 and supabase-js 2.117 require it). Node 24 is installed.
- **Commands** run from the repository root in Git Bash on Windows 11. `npm --prefix web run <script>` runs a web script from the root.
- **Tests:** TDD in every task. Component tests mock `@/api/*` modules with `vi.mock`. Integration tests (`web/tests/integration/`) run `api/` against the local Supabase stack with the seeded users. A missing i18n key fails the unit test suite.
- **Local database:** integration and end-to-end tests assume a freshly reset database (`npm run db:reset`). They create uniquely named fictitious rows.

## Review Focus

1. **Date-only values in a timezone west of UTC.** `new Date('2026-03-05')` is UTC midnight, which is 4 March in Mexico City, so a birth date or entry date could display one day early. Expected: date-only strings always display as the same calendar day. Test: Task 2 ("never shifts a date-only value").
2. **Operator names with accents and ñ.** `btoa()` throws on characters outside Latin-1 and mangles UTF-8 if called on the raw string. Expected: "Ana Pérez y Ñandú" reaches `audit_log.operator_name` unchanged. Tests: Task 3 (header bytes) and Task 6 (read back from the audit log).
3. **A redirect target that points to another site.** `?redirect=//evil.example` (or `/\evil.example`, which browsers treat the same way) after sign-in or after the shift screen must not leave the app. Expected: anything that is not a same-app path goes to `/residents`. Tests: Task 10 (`safeRedirect`), Task 12 (LoginView) and Task 13 (ShiftView).
4. **The password recovery link signs the user in.** Supabase opens `/reset-password` with a recovery session, and the contract's guard step 2 sends signed-in users away from public pages. Expected: `/reset-password` stays reachable while signed in. Test: Task 10.
5. **A deactivated user.** `app_users.active = false` still lets the user read their own row. Expected: status `pending`, no role, every app route goes to `/pending`, and an edit attempted with a still-open page fails with `not_authorized` rather than "someone else changed this record". Tests: Task 7 (store), Task 10 (guard) and Task 6 (`updateVersioned` after deactivation).

## File Structure

```
package.json                          root: adds web:* scripts and db:types (Tasks 1, 3)
supabase/config.toml                  local auth rate limits (Task 5), Google provider (Task 14)
web/
  package.json, package-lock.json     the web app package (Task 1)
  index.html, env.d.ts                (Task 1)
  tsconfig.json                       one config for src, tests, e2e and tool configs (Task 1)
  vite.config.ts                      Vite plus Vitest projects "unit" and "integration" (Task 1)
  eslint.config.js                    flat config with the Supabase import boundary (Task 1)
  .env.example                        committed; .env.local is git-ignored by the root .gitignore (Task 1)
  playwright.config.ts                (Task 15)
  src/
    main.ts                           bootstrap: styles, license, locale, Pinia, router, session (Tasks 1, 4, 11)
    App.vue                           picks the layout from route meta (Tasks 1, 11)
    api/
      errors.ts                       ApiError, toApiError, isApiError, API_ERROR_CODES (Task 3)
      client.ts                       the one Supabase client, operator header (Task 3)
      auth.ts                         sign-in, sign-up, reset, session, own app user (Task 5)
      rows.ts                         updateVersioned (Task 6)
      catalogs.ts                     listCatalog (Task 6)
      settings.ts                     getSettings (Task 6)
    i18n/
      index.ts                        i18n instance, AppLocale, setLocale (Task 4)
      syncfusion.ts                   Syncfusion L10n and es-MX CLDR (Task 4)
      locales/es-MX.json              all UI text (Task 4)
    lib/
      text.ts                         cleanText (Task 2)
      shelterTime.ts                  formatDate, formatTime, formatDateTime, todayIn, ageOn (Task 2)
    stores/
      session.ts, catalogs.ts, settings.ts   (Task 7)
    composables/
      useOnline.ts, useNotify.ts, useConfirm.ts   (Task 8)
      useShelterTime.ts                           (Task 9)
    components/
      common/ToastHost.vue, common/ConfirmHost.vue     (Task 8)
      common/PageHeader.vue, common/CatalogSelect.vue  (Task 9)
      layout/OfflineBanner.vue, layout/AppNavbar.vue, layout/AppShell.vue   (Task 11)
    router/
      routes.ts, guards.ts, index.ts  (Task 10)
    views/
      LoginView.vue, ResetPasswordView.vue        placeholder (Task 10), real (Task 12)
      PendingView.vue, ShiftView.vue              placeholder (Task 10), real (Task 13)
      ResidentsView.vue, PeopleSearchView.vue, PersonNewView.vue, PersonView.vue,
      admin/UsersView.vue, admin/CatalogsView.vue, admin/SettingsView.vue,
      admin/AuditView.vue, admin/MergeView.vue    placeholders for Plan 3 (Task 10)
    types/
      database.ts                     generated by npm run db:types (Task 3)
      domain.ts                       app-facing type aliases (Task 3)
  tests/
    setup.ts                          Vitest unit setup (Tasks 1, 4)
    utils/i18nGuard.ts                missing i18n keys fail tests (Task 4)
    utils/mountWithApp.ts             component mounting helper (Task 10)
    lint/restrictedImports.test.ts    (Task 1)
    lib/, types/, api/, i18n/, stores/, composables/, components/, router/, views/   unit and component tests
    integration/setup.ts              checks web/.env.local (Task 1)
    integration/helpers.ts            signInAs and friends (Task 5)
    integration/auth.test.ts          (Task 5)
    integration/data.test.ts          (Task 6)
  e2e/
    fixtures.ts                       signIn, uniqueName, dismissLicenseBanner (Task 15)
    sign-in.spec.ts                   (Task 15)
```

---

### Task 1: Scaffold the web app with the Supabase import boundary

**Files:**
- Create: `web/package.json`, `web/index.html`, `web/env.d.ts`, `web/tsconfig.json`, `web/vite.config.ts`, `web/eslint.config.js`, `web/.env.example`
- Create: `web/src/main.ts`, `web/src/App.vue`
- Create: `web/tests/setup.ts`, `web/tests/integration/setup.ts`, `web/tests/lint/restrictedImports.test.ts`
- Modify: `package.json` (root `scripts`)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - **web scripts:** `dev` (Vite on port 5173), `build`, `preview`, `test` (Vitest project `unit`), `test:integration` (Vitest project `integration`), `lint`, `typecheck` (`vue-tsc --noEmit`), `e2e` (`playwright test`).
  - **root scripts:** `web:dev`, `web:test`, `web:test:integration`, `web:e2e`, `web:lint`, `web:typecheck`.
  - **Path alias** `@` for `web/src`.
  - **Vitest projects:** `unit` (jsdom, `tests/**/*.test.ts` except `tests/integration/**`, setup `tests/setup.ts`, 15 second test timeout) and `integration` (node, `tests/integration/**/*.test.ts`, setup `tests/integration/setup.ts`, files run one after another, 20 second test timeout).
  - **Integration setup:** fails fast without `web/.env.local`, and stubs `window` as `{ location: { origin: 'http://localhost:5173' } }` because `api/auth.ts` builds redirect URLs from `window.location.origin`. With no `document`, supabase-js still treats the run as a non-browser runtime.
  - **ESLint rule:** `no-restricted-imports` of `@supabase/*` in `src/`, `tests/` and `e2e/`, except `src/api/**` and `tests/api/**`.

- [ ] **Step 1: Check Node**

Run: `node --version`

Expected: `v24.15.0` or later (or `v22.22.2` or later on Node 22).

- [ ] **Step 2: Create `web/package.json`**

```json
{
  "name": "shelterbridge-web",
  "private": true,
  "type": "module",
  "engines": {
    "node": "^22.22.2 || >=24.15.0"
  },
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run --project unit",
    "test:integration": "vitest run --project integration",
    "lint": "eslint .",
    "typecheck": "vue-tsc --noEmit",
    "e2e": "playwright test"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.117.0",
    "@syncfusion/ej2-base": "~35.1.37",
    "@syncfusion/ej2-bootstrap5.3-theme": "~35.1.39",
    "@syncfusion/ej2-locale": "~35.1.37",
    "@syncfusion/ej2-vue-dropdowns": "~35.1.39",
    "@syncfusion/ej2-vue-notifications": "~35.1.37",
    "@syncfusion/ej2-vue-popups": "~35.1.39",
    "bootstrap": "^5.3.8",
    "cldr-core": "^48.2.0",
    "cldr-dates-full": "^48.2.0",
    "cldr-numbers-full": "^48.2.0",
    "pinia": "^4.0.3",
    "vue": "^3.5.43",
    "vue-i18n": "^11.4.13",
    "vue-router": "^5.4.0"
  },
  "devDependencies": {
    "@pinia/testing": "^2.0.1",
    "@playwright/test": "^1.64.0",
    "@types/node": "^24.13.4",
    "@vitejs/plugin-vue": "^6.0.9",
    "@vue/eslint-config-typescript": "^14.9.0",
    "@vue/test-utils": "^2.5.1",
    "@vue/tsconfig": "^0.9.1",
    "eslint": "^10.12.0",
    "eslint-plugin-vue": "~10.11.0",
    "jsdom": "^30.1.2",
    "typescript": "~6.0.3",
    "vite": "^8.3.3",
    "vitest": "^4.1.11",
    "vue-tsc": "^3.3.12"
  }
}
```

Syncfusion packages use `~` so they all stay on the same 35.1 release; mixing Syncfusion releases can install two copies of `@syncfusion/ej2-base`, and then the license and the locale are registered on the wrong copy.

- [ ] **Step 3: Install**

Run: `npm --prefix web install`

Expected: `web/node_modules/` and `web/package-lock.json` exist. Then run `npm --prefix web ls @syncfusion/ej2-base` and check that every line shows the same version (`deduped`).

- [ ] **Step 4: Create the Vite, TypeScript and HTML files**

`web/vite.config.ts`:

```ts
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  define: {
    __VUE_I18N_FULL_INSTALL__: true,
    __VUE_I18N_LEGACY_API__: false,
    __INTLIFY_PROD_DEVTOOLS__: false,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'jsdom',
          include: ['tests/**/*.test.ts'],
          exclude: ['tests/integration/**'],
          setupFiles: ['tests/setup.ts'],
          // Syncfusion components and lazy imports can be slow on a cold Windows cache.
          testTimeout: 15_000,
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          environment: 'node',
          include: ['tests/integration/**/*.test.ts'],
          setupFiles: ['tests/integration/setup.ts'],
          fileParallelism: false,
          testTimeout: 20000,
        },
      },
    ],
  },
})
```

`web/tsconfig.json`:

```json
{
  "extends": "@vue/tsconfig/tsconfig.dom.json",
  "include": [
    "env.d.ts",
    "src/**/*",
    "src/**/*.vue",
    "tests/**/*",
    "e2e/**/*",
    "vite.config.ts",
    "playwright.config.ts"
  ],
  "compilerOptions": {
    "types": ["node", "vite/client"],
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

`web/env.d.ts`:

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_SYNCFUSION_LICENSE_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

`web/index.html`:

```html
<!doctype html>
<html lang="es-MX">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ShelterBridge</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`web/src/main.ts` (Tasks 4 and 11 grow it):

```ts
import { createApp } from 'vue'
import App from './App.vue'

createApp(App).mount('#app')
```

`web/src/App.vue` (Task 11 replaces it):

```vue
<template>
  <div />
</template>
```

- [ ] **Step 5: Create the test setup files**

`web/tests/setup.ts` (Task 4 adds the missing-key guard):

```ts
import { vi } from 'vitest'

// Unit tests never talk to Supabase, but src/api/client.ts needs a URL and key
// to construct the client when a test imports it.
if (!import.meta.env.VITE_SUPABASE_URL) vi.stubEnv('VITE_SUPABASE_URL', 'http://127.0.0.1:54321')
if (!import.meta.env.VITE_SUPABASE_ANON_KEY) vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'unit-test-anon-key')

// jsdom lacks these browser APIs, which Syncfusion components use.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList
}
if (typeof window !== 'undefined' && !('ResizeObserver' in window)) {
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
}
if (typeof window !== 'undefined') {
  // jsdom does not implement pseudo-element styles and logs every call; Syncfusion asks for them.
  const getComputedStyle = window.getComputedStyle.bind(window)
  window.getComputedStyle = (element: Element) => getComputedStyle(element)
}
```

`web/tests/integration/setup.ts`:

```ts
import { vi } from 'vitest'

// Integration tests use the real local stack through web/.env.local.
if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  throw new Error('Integration tests need web/.env.local with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. See README.md.')
}

// api/auth builds redirect URLs from window.location.origin, which Node does not have.
// No document is defined, so supabase-js still treats this as a non-browser runtime.
if (typeof window === 'undefined') vi.stubGlobal('window', { location: { origin: 'http://localhost:5173' } })
```

- [ ] **Step 6: Write the failing lint boundary test**

`web/tests/lint/restrictedImports.test.ts`:

```ts
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
```

- [ ] **Step 7: Run it to verify it fails**

Run: `npm --prefix web run test`

Expected: FAIL, `4 failed`, each with `Error: Could not find config file.`

- [ ] **Step 8: Create the ESLint flat config**

`web/eslint.config.js`:

```js
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
```

- [ ] **Step 9: Run the checks**

Run: `npm --prefix web run test`

Expected: `Test Files  1 passed (1)`, `Tests  4 passed (4)`.

Run: `npm --prefix web run lint`, then `npm --prefix web run typecheck`, then `npm --prefix web run build`

Expected: lint and typecheck print no errors; the build ends with `built in`.

- [ ] **Step 10: Add the environment example and the root scripts**

`web/.env.example`:

```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=
VITE_SYNCFUSION_LICENSE_KEY=
```

In the root `package.json`, keep every existing script and add these six to `scripts`:

```json
    "web:dev": "npm --prefix web run dev",
    "web:test": "npm --prefix web run test",
    "web:test:integration": "npm --prefix web run test:integration",
    "web:e2e": "npm --prefix web run e2e",
    "web:lint": "npm --prefix web run lint",
    "web:typecheck": "npm --prefix web run typecheck"
```

Run: `npm run web:test`

Expected: `Tests  4 passed (4)`.

Run: `git check-ignore web/.env.local web/.env.example web/node_modules`

Expected: it prints `web/.env.local` (ignored by the root `.env.*` rule) and `web/node_modules`, but not `web/.env.example`, which the root `!.env.example` rule keeps. No change to `.gitignore` is needed.

- [ ] **Step 11: Commit**

```bash
git add package.json web/package.json web/package-lock.json web/index.html web/env.d.ts web/tsconfig.json web/vite.config.ts web/eslint.config.js web/.env.example web/src/main.ts web/src/App.vue web/tests/setup.ts web/tests/integration/setup.ts web/tests/lint/restrictedImports.test.ts
git commit -m "chore(web): scaffold Vue app with Vitest, ESLint boundary and typecheck"
```

---

### Task 2: Text cleaning and shelter time helpers

**Files:**
- Create: `web/src/lib/text.ts`, `web/src/lib/shelterTime.ts`
- Test: `web/tests/lib/text.test.ts`, `web/tests/lib/shelterTime.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `cleanText(value: string | null | undefined): string | null`
  - `formatDate(value: string | Date | null | undefined, timeZone: string): string` (`dd/MM/yyyy`, `''` for null or invalid)
  - `formatTime(value: string | Date | null | undefined, timeZone: string): string` (`HH:mm`, `''` for null, invalid or date-only)
  - `formatDateTime(value: string | Date | null | undefined, timeZone: string): string` (`dd/MM/yyyy HH:mm`)
  - `todayIn(timeZone: string): string` (`YYYY-MM-DD`)
  - `ageOn(birthDate: string | null, onDate: string): number | null` (same result as the database's `app.age_on`)

- [ ] **Step 1: Write the failing tests**

`web/tests/lib/text.test.ts`:

```ts
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
```

`web/tests/lib/shelterTime.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ageOn, formatDate, formatDateTime, formatTime, todayIn } from '@/lib/shelterTime'

const MX = 'America/Mexico_City'

describe('formatDate', () => {
  it('formats a timestamp as dd/MM/yyyy in the shelter timezone', () => {
    expect(formatDate('2026-03-05T18:00:00Z', MX)).toBe('05/03/2026')
  })

  it('uses the shelter day, not the UTC day, late in the evening', () => {
    // 03:30 UTC on 6 March is 21:30 on 5 March in Mexico City.
    expect(formatDate('2026-03-06T03:30:00Z', MX)).toBe('05/03/2026')
  })

  it('never shifts a date-only value', () => {
    expect(formatDate('2026-03-05', MX)).toBe('05/03/2026')
    expect(formatDate('2026-03-05', 'Pacific/Kiritimati')).toBe('05/03/2026')
    expect(formatDate('2026-03-05', 'Pacific/Pago_Pago')).toBe('05/03/2026')
  })

  it('returns an empty string for missing or invalid values', () => {
    expect(formatDate(null, MX)).toBe('')
    expect(formatDate(undefined, MX)).toBe('')
    expect(formatDate('', MX)).toBe('')
    expect(formatDate('not a date', MX)).toBe('')
  })

  it('accepts Date objects', () => {
    expect(formatDate(new Date('2026-12-31T23:00:00Z'), MX)).toBe('31/12/2026')
  })
})

describe('formatTime and formatDateTime', () => {
  it('formats HH:mm on a 24 hour clock', () => {
    expect(formatTime('2026-03-05T21:07:00Z', MX)).toBe('15:07')
    expect(formatTime('2026-03-05T06:00:00Z', MX)).toBe('00:00')
  })

  it('has no daylight saving time in Mexico City', () => {
    // Mexico City stays at UTC-6 all year; Tijuana moves to UTC-7 in summer.
    expect(formatTime('2026-07-15T18:30:00Z', MX)).toBe('12:30')
    expect(formatTime('2026-01-15T18:30:00Z', MX)).toBe('12:30')
    expect(formatTime('2026-07-15T18:30:00Z', 'America/Tijuana')).toBe('11:30')
  })

  it('formats date and time together', () => {
    expect(formatDateTime('2026-03-06T03:30:00Z', MX)).toBe('05/03/2026 21:30')
  })

  it('returns an empty string for missing values', () => {
    expect(formatTime(null, MX)).toBe('')
    expect(formatDateTime(null, MX)).toBe('')
  })
})

describe('todayIn', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('is still yesterday one second before shelter midnight', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T05:59:59Z'))
    expect(todayIn(MX)).toBe('2025-12-31')
  })

  it('turns over exactly at shelter midnight', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T06:00:00Z'))
    expect(todayIn(MX)).toBe('2026-01-01')
  })

  it('depends on the timezone it is given', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T05:00:00Z'))
    expect(todayIn('UTC')).toBe('2026-01-01')
    expect(todayIn(MX)).toBe('2025-12-31')
  })
})

describe('ageOn', () => {
  it('is 17 the day before the 18th birthday and 18 on it', () => {
    expect(ageOn('2008-10-08', '2026-10-07')).toBe(17)
    expect(ageOn('2008-10-07', '2026-10-07')).toBe(18)
  })

  it('handles a 29 February birthday like the database', () => {
    expect(ageOn('2008-02-29', '2026-02-28')).toBe(17)
    expect(ageOn('2008-02-29', '2026-03-01')).toBe(18)
  })

  it('returns null for an unknown birth date', () => {
    expect(ageOn(null, '2026-10-07')).toBeNull()
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm --prefix web run test -- tests/lib`

Expected: FAIL with `Failed to resolve import "@/lib/text"` and `Failed to resolve import "@/lib/shelterTime"`.

- [ ] **Step 3: Write the helpers**

`web/src/lib/text.ts`:

```ts
// Same whitespace the database strips (app.trim_text): \s plus no-break,
// figure, narrow no-break and zero-width no-break spaces.
const EDGE_WHITESPACE = /^[\s   ﻿]+|[\s   ﻿]+$/g

export function cleanText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  const cleaned = value.replace(EDGE_WHITESPACE, '')
  return cleaned === '' ? null : cleaned
}
```

`web/src/lib/shelterTime.ts`:

```ts
// Dates and times are always shown in the shelter timezone, never the browser's.
// Date-only values (YYYY-MM-DD, such as birth_date or entry_date) are calendar
// days with no time, so they are formatted as-is and never shifted.

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

interface Parts {
  year: string
  month: string
  day: string
  hour: string
  minute: string
}

const formatters = new Map<string, Intl.DateTimeFormat>()

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
    formatters.set(timeZone, formatter)
  }
  return formatter
}

function partsIn(date: Date, timeZone: string): Parts {
  const parts: Record<string, string> = {}
  for (const part of formatterFor(timeZone).formatToParts(date)) parts[part.type] = part.value
  return {
    year: parts.year ?? '',
    month: parts.month ?? '',
    day: parts.day ?? '',
    hour: parts.hour ?? '',
    minute: parts.minute ?? '',
  }
}

function toDate(value: string | Date): Date | null {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatDate(value: string | Date | null | undefined, timeZone: string): string {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value === 'string') {
    const match = DATE_ONLY.exec(value)
    if (match) return `${match[3]}/${match[2]}/${match[1]}`
  }
  const date = toDate(value)
  if (!date) return ''
  const p = partsIn(date, timeZone)
  return `${p.day}/${p.month}/${p.year}`
}

export function formatTime(value: string | Date | null | undefined, timeZone: string): string {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value === 'string' && DATE_ONLY.test(value)) return ''
  const date = toDate(value)
  if (!date) return ''
  const p = partsIn(date, timeZone)
  return `${p.hour}:${p.minute}`
}

export function formatDateTime(value: string | Date | null | undefined, timeZone: string): string {
  const date = formatDate(value, timeZone)
  const time = formatTime(value, timeZone)
  return time === '' ? date : `${date} ${time}`
}

export function todayIn(timeZone: string): string {
  const p = partsIn(new Date(), timeZone)
  return `${p.year}-${p.month}-${p.day}`
}

export function ageOn(birthDate: string | null, onDate: string): number | null {
  if (!birthDate) return null
  const birth = DATE_ONLY.exec(birthDate)
  const on = DATE_ONLY.exec(onDate)
  if (!birth || !on) return null
  const [by, bm, bd] = [Number(birth[1]), Number(birth[2]), Number(birth[3])]
  const [oy, om, od] = [Number(on[1]), Number(on[2]), Number(on[3])]
  let age = oy - by
  if (om < bm || (om === bm && od < bd)) age -= 1
  return age
}
```

- [ ] **Step 4: Run them to verify they pass**

Run: `npm --prefix web run test -- tests/lib`

Expected: `Test Files  2 passed (2)`, `Tests  19 passed (19)`.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib web/tests/lib
git commit -m "feat(web): add text cleaning and shelter time helpers"
```

---

### Task 3: Generated types, API errors and the Supabase client

**Files:**
- Modify: `package.json` (root, add `db:types`)
- Create (generated): `web/src/types/database.ts`
- Create: `web/src/types/domain.ts`, `web/src/api/errors.ts`, `web/src/api/client.ts`
- Test: `web/tests/types/domain.test.ts`, `web/tests/api/errors.test.ts`, `web/tests/api/client.test.ts`

**Interfaces:**
- Consumes: the local database from Plan 1.
- Produces:
  - **root script** `db:types`: `supabase gen types typescript --local > web/src/types/database.ts`.
  - **`@/types/domain`:** `AppRole`, `AppUser`, `Person`, `Stay`, `Outing`, `CurrentResident`, `AuditEntry`, `PhoneStatus`, `Presence`, `CatalogName`, `CatalogItem`, exactly as in the contract.
  - **`@/api/errors`:**
    - `API_ERROR_CODES` (readonly array of every code) and `type ApiErrorCode = (typeof API_ERROR_CODES)[number]`
    - `class ApiError extends Error { readonly code: ApiErrorCode; readonly i18nKey: string; readonly details?: unknown; constructor(code: ApiErrorCode, details?: unknown) }`. Its `message` is the code, never server text.
    - `toApiError(error: unknown): ApiError` (the contract's mapping, plus Storage errors: a failed fetch is `network`, HTTP 401 or 403 is `not_authorized`, and HTTP 400, 413 or 415 is `validation`)
    - `isApiError(error: unknown, code?: ApiErrorCode): error is ApiError`
  - **`@/api/client`:** `supabase: SupabaseClient<Database>`, `setOperatorName(name: string | null): void` (trims; blank means none), `getOperatorName(): string | null`.

- [ ] **Step 1: Write the failing type test**

`web/tests/types/domain.test.ts`:

```ts
import { describe, expectTypeOf, it } from 'vitest'
import type { AppRole, AppUser, CatalogName, CurrentResident, Person, Stay } from '@/types/domain'

// Checked by the typecheck script; at runtime these assertions do nothing.
describe('domain types', () => {
  it('follow the generated database types', () => {
    expectTypeOf<AppRole>().toEqualTypeOf<'admin' | 'legal' | 'psychology' | 'volunteer'>()
    expectTypeOf<AppUser['role']>().toEqualTypeOf<AppRole>()
    expectTypeOf<Person['first_name']>().toEqualTypeOf<string>()
    expectTypeOf<Person['last_name']>().toEqualTypeOf<string | null>()
    expectTypeOf<Stay['exit_date']>().toEqualTypeOf<string | null>()
    expectTypeOf<CurrentResident>().toHaveProperty('is_unaccompanied_minor')
    expectTypeOf<CurrentResident>().toHaveProperty('stay_updated_at')
    expectTypeOf<CatalogName>().toEqualTypeOf<'countries' | 'case_types' | 'genders'>()
  })
})
```

- [ ] **Step 2: Run the typecheck to verify it fails**

Run: `npm --prefix web run typecheck`

Expected: FAIL with `Cannot find module '@/types/domain'`.

- [ ] **Step 3: Generate the database types**

In the root `package.json`, add to `scripts`:

```json
    "db:types": "supabase gen types typescript --local > web/src/types/database.ts"
```

Run: `npm run db:start` (if the stack is not running), then `npm run db:reset`, then `mkdir -p web/src/types` (the redirect cannot create the folder), then `npm run db:types`

Expected: `web/src/types/database.ts` exists, its first line is `export type Json =`, and it contains `app_role: "admin" | "legal" | "psychology" | "volunteer"`, a `current_residents` entry under `Views`, and the `Tables` helper type. If the first line is anything else (for example a CLI message), the CLI wrote to stdout: delete the file, fix the cause, and run the script again.

- [ ] **Step 4: Write the domain types**

`web/src/types/domain.ts`:

```ts
import type { Database, Tables } from './database'

export type AppRole = Database['public']['Enums']['app_role']
export type AppUser = Tables<'app_users'>
export type Person = Tables<'people'>
export type Stay = Tables<'stays'>
export type Outing = Tables<'outings'>
export type CurrentResident = Tables<'current_residents'>
export type AuditEntry = Tables<'audit_log'>
export type PhoneStatus = 'none' | 'with_person' | 'in_custody'
export type Presence = 'inside' | 'outside'
export type CatalogName = 'countries' | 'case_types' | 'genders'
export interface CatalogItem {
  code: string
  labels: Record<string, string>
  sort_order: number
  active: boolean
  updated_at: string
}
```

Run: `npm --prefix web run typecheck`

Expected: no errors.

- [ ] **Step 5: Write the failing error mapping tests**

`web/tests/api/errors.test.ts`:

```ts
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
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npm --prefix web run test -- tests/api/errors.test.ts`

Expected: FAIL with `Failed to resolve import "@/api/errors"`.

- [ ] **Step 7: Write `api/errors.ts`**

`web/src/api/errors.ts`:

```ts
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
```

PostgREST returns errors as plain `{ code, message, details, hint }` objects, and turns a failed `fetch` into one whose `message` starts with `TypeError:` and whose `code` is empty. Storage errors have no SQLSTATE: they carry `__isStorageError`, an HTTP `status`, and for a failed fetch the original `TypeError` in `originalError`, so an offline photo upload (Plan 3) still shows "Sin conexión". The sign-up hook's 403 is mapped to `not_invited` in `api/auth.ts` (Task 5), because only that call knows the 403 came from the allowlist.

- [ ] **Step 8: Run it to verify it passes**

Run: `npm --prefix web run test -- tests/api/errors.test.ts`

Expected: `Tests  35 passed (35)`.

- [ ] **Step 9: Write the failing client test**

`web/tests/api/client.test.ts`:

```ts
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
```

- [ ] **Step 10: Run it to verify it fails**

Run: `npm --prefix web run test -- tests/api/client.test.ts`

Expected: FAIL with `Failed to resolve import "@/api/client"`.

- [ ] **Step 11: Write `api/client.ts`**

`web/src/api/client.ts`:

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

let operatorName: string | null = null

export function setOperatorName(name: string | null): void {
  const trimmed = name?.trim() ?? ''
  operatorName = trimmed === '' ? null : trimmed
}

export function getOperatorName(): string | null {
  return operatorName
}

function base64Utf8(text: string): string {
  let binary = ''
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte)
  return btoa(binary)
}

// Adds the self-declared operator on shift to every request, for the audit log.
const fetchWithOperator: typeof fetch = (input, init) => {
  if (operatorName === null) return globalThis.fetch(input, init)
  const headers = new Headers(init?.headers)
  headers.set('x-operator-name', base64Utf8(operatorName))
  return globalThis.fetch(input, { ...init, headers })
}

export const supabase: SupabaseClient<Database> = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { global: { fetch: fetchWithOperator } },
)
```

`fetchWithOperator` reads `globalThis.fetch` on every call, so tests can stub it, and supabase-js passes it the auth headers in `init.headers`, which are kept.

- [ ] **Step 12: Run the checks**

Run: `npm --prefix web run test`, then `npm --prefix web run lint`, then `npm --prefix web run typecheck`

Expected: all unit tests pass (`Test Files  6 passed (6)`); lint and typecheck print no errors.

- [ ] **Step 13: Commit**

```bash
git add package.json web/src/types web/src/api/errors.ts web/src/api/client.ts web/tests/types web/tests/api/errors.test.ts web/tests/api/client.test.ts
git commit -m "feat(web): add generated types, ApiError mapping and Supabase client with operator header"
```

---

### Task 4: i18n, Syncfusion locale, license and styles

**Files:**
- Create: `web/src/i18n/locales/es-MX.json`, `web/src/i18n/syncfusion.ts`, `web/src/i18n/index.ts`
- Create: `web/tests/utils/i18nGuard.ts`
- Modify: `web/tests/setup.ts`, `web/src/main.ts`
- Test: `web/tests/i18n/i18n.test.ts`

**Interfaces:**
- Consumes: `API_ERROR_CODES` from `@/api/errors` (Task 3).
- Produces:
  - **`@/i18n`:** `type AppLocale = 'es-MX'`; `i18n` (vue-i18n in composition mode, locale and fallback `es-MX`); `setLocale(locale: AppLocale): Promise<void>` switches vue-i18n, Syncfusion texts and culture, and `<html lang>`.
  - **`@/i18n/syncfusion`:** `loadSyncfusionLocale(locale: AppLocale): Promise<void>` loads `@syncfusion/ej2-locale` Spanish texts under the `es-MX` key, loads es-MX CLDR data (numbering systems, week data, Gregorian calendar, time zone names, numbers, currencies) and calls `setCulture`.
  - **`es-MX.json` namespaces:** `common`, `nav`, `auth`, `shift`, `errors` (one key per `ApiErrorCode`), `validation`, `phoneStatus`, `presence`. The full key list is in the file below and in "Interfaces for Plan 3".
  - **`tests/utils/i18nGuard.ts`:** `missingI18nKeys: string[]` and `installMissingKeyGuard(): void`. A test that looks up a missing key on purpose must empty `missingI18nKeys` afterwards (`missingI18nKeys.splice(0)`).
  - **`main.ts`** imports Bootstrap and the Syncfusion theme CSS, registers the Syncfusion license from `VITE_SYNCFUSION_LICENSE_KEY` when it is set, and awaits `setLocale('es-MX')` before mounting.

- [ ] **Step 1: Write the failing test**

`web/tests/i18n/i18n.test.ts`:

```ts
import { Internationalization, L10n } from '@syncfusion/ej2-base'
import { describe, expect, it } from 'vitest'
import { API_ERROR_CODES } from '@/api/errors'
import { i18n, setLocale } from '@/i18n'
import esMX from '@/i18n/locales/es-MX.json'
import { missingI18nKeys } from '../utils/i18nGuard'

describe('i18n', () => {
  it('translates with es-MX by default', () => {
    expect(i18n.global.locale.value).toBe('es-MX')
    expect(i18n.global.t('shift.title')).toBe('¿Quién está de turno?')
  })

  it('throws on a missing key', () => {
    expect(() => i18n.global.t('nav.doesNotExist')).toThrow(/nav\.doesNotExist/)
    expect(missingI18nKeys.splice(0)).toEqual(['nav.doesNotExist'])
  })

  it('has a message for every API error code', () => {
    const errors = esMX.errors as Record<string, string>
    for (const code of API_ERROR_CODES) expect(errors[code], code).toBeTruthy()
  })

  it('has labels for every phone status and presence value', () => {
    expect(Object.keys(esMX.phoneStatus).sort()).toEqual(['in_custody', 'none', 'with_person'])
    expect(Object.keys(esMX.presence).sort()).toEqual(['inside', 'outside'])
  })
})

describe('setLocale', () => {
  it('sets <html lang>, Syncfusion texts and es-MX formats', async () => {
    await setLocale('es-MX')
    expect(document.documentElement.lang).toBe('es-MX')
    const texts = new L10n('dropdowns', { noRecordsTemplate: 'No records found' })
    expect(texts.getConstant('noRecordsTemplate')).toBe('No se encontraron registros')
    const intl = new Internationalization()
    expect(intl.formatDate(new Date(2026, 2, 5), { format: 'dd MMMM yyyy' })).toBe('05 marzo 2026')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm --prefix web run test -- tests/i18n`

Expected: FAIL with `Failed to resolve import "@/i18n"`.

- [ ] **Step 3: Write the Spanish messages**

`web/src/i18n/locales/es-MX.json`:

```json
{
  "common": {
    "appName": "ShelterBridge",
    "save": "Guardar",
    "cancel": "Cancelar",
    "confirm": "Confirmar",
    "continue": "Continuar",
    "retry": "Reintentar",
    "reload": "Volver a cargar",
    "close": "Cerrar",
    "loading": "Cargando...",
    "select": "Selecciona una opción",
    "personRecord": "Ficha de la persona",
    "offline": "Sin conexión",
    "offlineHint": "Revisa el internet de este equipo. Mientras tanto no se puede guardar nada."
  },
  "nav": {
    "menu": "Menú",
    "residents": "Residentes",
    "search": "Buscar",
    "newPerson": "Registrar persona",
    "admin": "Administración",
    "users": "Usuarios",
    "catalogs": "Catálogos",
    "settings": "Configuración",
    "audit": "Bitácora de cambios",
    "merge": "Unir duplicados",
    "onShift": "De turno: {name}",
    "changeShift": "Cambiar turno",
    "signOut": "Cerrar sesión"
  },
  "auth": {
    "title": "Entrar a ShelterBridge",
    "subtitle": "Solo para el personal y el voluntariado del albergue.",
    "google": "Entrar con Google",
    "or": "o con tu correo",
    "email": "Correo electrónico",
    "password": "Contraseña",
    "signIn": "Entrar",
    "firstTime": "¿Es tu primera vez? Crea tu contraseña",
    "signUpTitle": "Crear tu contraseña",
    "signUpHelp": "Usa el correo con el que te invitaron.",
    "signUp": "Crear contraseña",
    "signUpSent": "Te enviamos un correo para confirmar tu cuenta. Ábrelo y sigue el enlace.",
    "forgot": "¿Olvidaste tu contraseña?",
    "resetTitle": "Recuperar tu contraseña",
    "resetHelp": "Escribe tu correo y te enviaremos un enlace para crear una contraseña nueva.",
    "resetSend": "Enviar enlace",
    "resetSent": "Si el correo está registrado, en unos minutos te llegará un enlace.",
    "backToSignIn": "Volver a entrar",
    "newPasswordTitle": "Crea una contraseña nueva",
    "newPassword": "Contraseña nueva",
    "confirmPassword": "Repite la contraseña",
    "savePassword": "Guardar contraseña",
    "passwordSaved": "Listo, tu contraseña quedó guardada.",
    "resetLinkInvalid": "El enlace no es válido o ya venció. Pide uno nuevo.",
    "googleFailed": "No se pudo entrar con Google. Si tu correo no ha sido invitado, pide acceso a una persona de administración.",
    "pendingTitle": "Tu acceso está pendiente",
    "pendingBody": "Tu cuenta ya existe, pero todavía no tiene un rol activo. Pide a una persona de administración que te dé acceso.",
    "pendingRetry": "Ya me dieron acceso"
  },
  "shift": {
    "title": "¿Quién está de turno?",
    "help": "Escribe el nombre de quienes atienden en este turno, por ejemplo \"Ana y Luis\". Se guardará junto con cada cambio que hagan.",
    "name": "Nombres de quienes están de turno",
    "start": "Empezar turno"
  },
  "errors": {
    "not_authorized": "No tienes permiso para hacer esto.",
    "not_found": "No encontramos ese registro. Puede que ya no exista.",
    "validation": "Revisa los datos, hay algo que no es válido.",
    "stale_record": "Alguien más cambió este registro mientras lo editabas. Vuelve a cargarlo para ver los cambios.",
    "already_checked_in": "Esta persona ya tiene una estancia abierta.",
    "stay_not_open": "Esta estancia ya está cerrada.",
    "outing_already_open": "Esta persona ya tiene una salida sin regreso.",
    "no_open_outing": "Esta persona no tiene una salida abierta.",
    "outing_exception_needs_confirmation": "Ya salió hoy, ¿registrar como excepción?",
    "outing_outside_stay": "La fecha de la salida queda fuera de la estancia.",
    "overlapping_stays": "Las fechas se cruzan con otra estancia de esta persona.",
    "merge_same_person": "Elige dos registros distintos para unir.",
    "invalid_credentials": "El correo o la contraseña no son correctos.",
    "email_not_confirmed": "Todavía no confirmas tu correo. Busca el mensaje que te enviamos y sigue el enlace.",
    "not_invited": "Este correo no tiene invitación a ShelterBridge. Pide acceso a una persona de administración.",
    "network": "Sin conexión. Revisa el internet e inténtalo de nuevo.",
    "unknown": "Algo salió mal. Inténtalo de nuevo."
  },
  "validation": {
    "required": "Este dato es obligatorio.",
    "email": "Escribe un correo válido.",
    "passwordTooShort": "La contraseña debe tener al menos {min} caracteres.",
    "passwordsDontMatch": "Las contraseñas no coinciden.",
    "dateInFuture": "La fecha no puede ser posterior a hoy.",
    "birthDateImplausible": "Revisa la fecha de nacimiento.",
    "exitBeforeEntry": "La fecha de egreso no puede ser anterior a la de ingreso."
  },
  "phoneStatus": {
    "none": "Sin teléfono",
    "with_person": "Lo tiene la persona",
    "in_custody": "En resguardo"
  },
  "presence": {
    "inside": "Dentro",
    "outside": "Fuera"
  }
}
```

`validation.dateInFuture`, `validation.birthDateImplausible` and `validation.exitBeforeEntry` are the client-side checks from spec section 10; Plan 3's forms use them.

- [ ] **Step 4: Write the i18n modules**

`web/src/i18n/syncfusion.ts`:

```ts
import { L10n, loadCldr, setCulture } from '@syncfusion/ej2-base'
import type { AppLocale } from './index'

// Spanish text for Syncfusion's built-in labels plus es-MX CLDR data for
// date and number formats. Loaded on demand so only es-MX is bundled.
export async function loadSyncfusionLocale(locale: AppLocale): Promise<void> {
  const [numberingSystems, weekData, gregorian, timeZoneNames, numbers, currencies, texts] = await Promise.all([
    import('cldr-core/supplemental/numberingSystems.json'),
    import('cldr-core/supplemental/weekData.json'),
    import('cldr-dates-full/main/es-MX/ca-gregorian.json'),
    import('cldr-dates-full/main/es-MX/timeZoneNames.json'),
    import('cldr-numbers-full/main/es-MX/numbers.json'),
    import('cldr-numbers-full/main/es-MX/currencies.json'),
    import('@syncfusion/ej2-locale/src/es.json'),
  ])
  loadCldr(
    numberingSystems.default,
    weekData.default,
    gregorian.default,
    timeZoneNames.default,
    numbers.default,
    currencies.default,
  )
  L10n.load({ [locale]: texts.default.es })
  setCulture(locale)
}
```

`web/src/i18n/index.ts`:

```ts
import { createI18n } from 'vue-i18n'
import esMX from './locales/es-MX.json'
import { loadSyncfusionLocale } from './syncfusion'

export type AppLocale = 'es-MX'

export const i18n = createI18n({
  legacy: false,
  locale: 'es-MX',
  fallbackLocale: 'es-MX',
  messages: { 'es-MX': esMX },
})

// The one place that switches language: app strings, Syncfusion and <html lang>.
export async function setLocale(locale: AppLocale): Promise<void> {
  i18n.global.locale.value = locale
  await loadSyncfusionLocale(locale)
  document.documentElement.lang = locale
}
```

- [ ] **Step 5: Make missing keys fail the tests**

`web/tests/utils/i18nGuard.ts`:

```ts
import { afterEach } from 'vitest'
import { i18n } from '@/i18n'

// Keys that were looked up but do not exist in es-MX.json during the current test.
export const missingI18nKeys: string[] = []

// A missing translation throws where it happens and also fails the test in
// afterEach, in case the code that hit it swallowed the error.
export function installMissingKeyGuard(): void {
  i18n.global.setMissingHandler((locale, key) => {
    missingI18nKeys.push(key)
    throw new Error(`Missing i18n key "${key}" for locale ${locale}`)
  })
  afterEach(() => {
    if (missingI18nKeys.length > 0) {
      const keys = missingI18nKeys.splice(0)
      throw new Error(`Missing i18n keys: ${keys.join(', ')}`)
    }
  })
}
```

Replace `web/tests/setup.ts` with (the guard import and call are new; the rest is unchanged from Task 1):

```ts
import { vi } from 'vitest'
import { installMissingKeyGuard } from './utils/i18nGuard'

// Unit tests never talk to Supabase, but src/api/client.ts needs a URL and key
// to construct the client when a test imports it.
if (!import.meta.env.VITE_SUPABASE_URL) vi.stubEnv('VITE_SUPABASE_URL', 'http://127.0.0.1:54321')
if (!import.meta.env.VITE_SUPABASE_ANON_KEY) vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'unit-test-anon-key')

installMissingKeyGuard()

// jsdom lacks these browser APIs, which Syncfusion components use.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList
}
if (typeof window !== 'undefined' && !('ResizeObserver' in window)) {
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
}
if (typeof window !== 'undefined') {
  // jsdom does not implement pseudo-element styles and logs every call; Syncfusion asks for them.
  const getComputedStyle = window.getComputedStyle.bind(window)
  window.getComputedStyle = (element: Element) => getComputedStyle(element)
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm --prefix web run test`

Expected: `Test Files  7 passed (7)`. The i18n file shows `5 passed`.

- [ ] **Step 7: Load the styles, license and locale at startup**

Replace `web/src/main.ts` with:

```ts
import 'bootstrap/dist/css/bootstrap.min.css'
// Syncfusion Bootstrap 5.3 theme, one file per component (each file once, no index.css).
import '@syncfusion/ej2-bootstrap5.3-theme/styles/base/base.css'
import '@syncfusion/ej2-bootstrap5.3-theme/styles/button/button.css'
import '@syncfusion/ej2-bootstrap5.3-theme/styles/popup/popup.css'
import '@syncfusion/ej2-bootstrap5.3-theme/styles/dialog/dialog.css'
import '@syncfusion/ej2-bootstrap5.3-theme/styles/toast/toast.css'
import '@syncfusion/ej2-bootstrap5.3-theme/styles/input/input.css'
import '@syncfusion/ej2-bootstrap5.3-theme/styles/spinner/spinner.css'
import '@syncfusion/ej2-bootstrap5.3-theme/styles/drop-down-base/drop-down-base.css'
import '@syncfusion/ej2-bootstrap5.3-theme/styles/drop-down-list/drop-down-list.css'

import { registerLicense } from '@syncfusion/ej2-base'
import { createApp } from 'vue'
import App from './App.vue'
import { i18n, setLocale } from './i18n'

async function bootstrap(): Promise<void> {
  const licenseKey = import.meta.env.VITE_SYNCFUSION_LICENSE_KEY
  if (licenseKey) registerLicense(licenseKey)

  await setLocale('es-MX')

  const app = createApp(App)
  app.use(i18n)
  app.mount('#app')
}

void bootstrap()
```

Since version 35, Syncfusion ships its themes in separate packages, not inside each component package. Each Syncfusion component a later task adds needs its CSS file from `@syncfusion/ej2-bootstrap5.3-theme/styles/<component>/<component>.css` added here, plus any dependency it lists in that folder's `index.css` that is not imported yet.

- [ ] **Step 8: Build**

Run: `npm --prefix web run build`

Expected: it ends with `built in`, and the generated CSS asset (`dist/assets/index-*.css`) is about 1 MB. It also emits separate chunks for `ca-gregorian`, `numbers`, `timeZoneNames` and `es`, which shows that only the es-MX locale data is bundled.

Run: `npm --prefix web run lint`, then `npm --prefix web run typecheck`

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add web/src/i18n web/src/main.ts web/tests/utils/i18nGuard.ts web/tests/setup.ts web/tests/i18n
git commit -m "feat(web): add es-MX i18n, Syncfusion locale and theme, and fail tests on missing keys"
```

---

### Task 5: Auth API

**Files:**
- Modify: `supabase/config.toml` (`[auth.rate_limit]`)
- Create (local only, never committed): `web/.env.local`
- Create: `web/src/api/auth.ts`, `web/tests/integration/helpers.ts`
- Test: `web/tests/api/auth.test.ts`, `web/tests/integration/auth.test.ts`

**Interfaces:**
- Consumes: `supabase`, `setOperatorName` from `@/api/client`; `ApiError`, `toApiError` from `@/api/errors` (Task 3); `AppUser`, `AppRole` from `@/types/domain`; the integration setup's `window.location.origin` stub (Task 1), which `signUp` needs under Node.
- Produces:
  - **`@/api/auth`** (contract signatures):
    - `signInWithPassword(email: string, password: string): Promise<void>`
    - `signInWithGoogle(): Promise<void>` (redirectTo `${origin}/residents`)
    - `signUp(email: string, password: string): Promise<void>` (emailRedirectTo `${origin}/residents`; HTTP 403 from the allowlist hook throws `ApiError('not_invited')`)
    - `requestPasswordReset(email: string): Promise<void>` (redirectTo `${origin}/reset-password`)
    - `updatePassword(newPassword: string): Promise<void>`
    - `signOut(): Promise<void>`
    - `getSession(): Promise<Session | null>`
    - `onAuthChange(callback: (session: Session | null) => void): () => void` (the callback runs in a `setTimeout`, outside the Supabase auth lock)
    - `getMyAppUser(): Promise<AppUser | null>` (filtered by the signed-in user's id, because an admin can read every row)
    - `export type { Session }` re-exported from supabase-js, for stores and tests.
  - **`tests/integration/helpers.ts`:** `signInAs(role: AppRole): Promise<void>`, `signOutQuietly(): Promise<void>`, `devEmail(role: AppRole): string`, `uniqueSuffix(): string`, `DEV_PASSWORD`, and a re-export of `supabase`.

- [ ] **Step 1: Raise the local auth rate limits**

The integration and end-to-end suites sign in about 25 times per run, and the local default allows 30 sign-ins per 5 minutes. In `supabase/config.toml`, in the `[auth.rate_limit]` section, change these two values and add the comment lines above them:

```toml
# Local only: raised so repeated test runs are not throttled.
email_sent = 100
```

```toml
# Local only: the web integration and end-to-end tests sign in many times.
sign_in_sign_ups = 1000
```

Run: `npm run db:stop`, then `npm run db:start`, then `npm run db:reset`

Expected: the stack starts without config errors and the reset finishes with the seed loaded.

- [ ] **Step 2: Create `web/.env.local`**

```bash
cp web/.env.example web/.env.local
ANON_KEY=$(npx supabase status -o env | sed -n 's/^ANON_KEY="\{0,1\}\([^"]*\)"\{0,1\}$/\1/p')
sed -i "s|^VITE_SUPABASE_ANON_KEY=.*|VITE_SUPABASE_ANON_KEY=${ANON_KEY}|" web/.env.local
grep -c '^VITE_SUPABASE_ANON_KEY=.\+' web/.env.local
```

Expected: `1`. If it prints `0`, run `npx supabase status -o env`, copy the value of the `ANON_KEY` line (without quotes) and paste it after `VITE_SUPABASE_ANON_KEY=` in `web/.env.local`. Leave `VITE_SYNCFUSION_LICENSE_KEY` empty unless you have a Syncfusion key. This file is git-ignored; never commit it.

- [ ] **Step 3: Write the failing unit test**

`web/tests/api/auth.test.ts`:

```ts
import { AuthApiError } from '@supabase/supabase-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as auth from '@/api/auth'
import { isApiError } from '@/api/errors'

const supabaseAuth = vi.hoisted(() => ({
  signInWithOAuth: vi.fn(),
  signUp: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
  onAuthStateChange: vi.fn(),
}))

vi.mock('@/api/client', () => ({ supabase: { auth: supabaseAuth } }))

afterEach(() => {
  vi.resetAllMocks()
  vi.useRealTimers()
})

describe('api/auth redirects', () => {
  it('Google sign-in comes back to the residents page', async () => {
    supabaseAuth.signInWithOAuth.mockResolvedValue({ data: {}, error: null })
    await auth.signInWithGoogle()
    expect(supabaseAuth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/residents` },
    })
  })

  it('the confirmation email comes back to the residents page', async () => {
    supabaseAuth.signUp.mockResolvedValue({ data: {}, error: null })
    await auth.signUp('legal@shelterbridge.test', 'una-clave-larga')
    expect(supabaseAuth.signUp).toHaveBeenCalledWith({
      email: 'legal@shelterbridge.test',
      password: 'una-clave-larga',
      options: { emailRedirectTo: `${window.location.origin}/residents` },
    })
  })

  it('the reset email comes back to the reset-password page', async () => {
    supabaseAuth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null })
    await auth.requestPasswordReset('admin@shelterbridge.test')
    expect(supabaseAuth.resetPasswordForEmail).toHaveBeenCalledWith('admin@shelterbridge.test', {
      redirectTo: `${window.location.origin}/reset-password`,
    })
  })

  it('updatePassword sets the new password', async () => {
    supabaseAuth.updateUser.mockResolvedValue({ data: {}, error: null })
    await auth.updatePassword('una-clave-nueva')
    expect(supabaseAuth.updateUser).toHaveBeenCalledWith({ password: 'una-clave-nueva' })
  })
})

describe('api/auth errors', () => {
  it('maps the sign-up hook rejection (403) to not_invited', async () => {
    supabaseAuth.signUp.mockResolvedValue({ data: {}, error: new AuthApiError('not invited', 403, undefined) })
    const error = await auth.signUp('stranger@example.test', 'una-clave-larga').catch((e: unknown) => e)
    expect(isApiError(error, 'not_invited')).toBe(true)
  })

  it('maps other sign-up errors through toApiError', async () => {
    supabaseAuth.signUp.mockResolvedValue({ data: {}, error: new AuthApiError('weak', 422, 'weak_password') })
    const error = await auth.signUp('legal@shelterbridge.test', 'x').catch((e: unknown) => e)
    expect(isApiError(error, 'validation')).toBe(true)
  })
})

describe('onAuthChange', () => {
  it('calls back outside the Supabase auth lock and can unsubscribe', () => {
    vi.useFakeTimers()
    const unsubscribe = vi.fn()
    let handler: ((event: string, session: unknown) => void) | undefined
    supabaseAuth.onAuthStateChange.mockImplementation((callback: (event: string, session: unknown) => void) => {
      handler = callback
      return { data: { subscription: { unsubscribe } } }
    })
    const callback = vi.fn()
    const stop = auth.onAuthChange(callback)
    handler?.('SIGNED_OUT', null)
    expect(callback).not.toHaveBeenCalled()
    vi.runAllTimers()
    expect(callback).toHaveBeenCalledWith(null)
    stop()
    expect(unsubscribe).toHaveBeenCalled()
  })
})
```

- [ ] **Step 4: Write the failing integration test and its helpers**

`web/tests/integration/helpers.ts`:

```ts
import { signInWithPassword, signOut } from '@/api/auth'
import { setOperatorName, supabase } from '@/api/client'
import type { AppRole } from '@/types/domain'

// Seeded by supabase/seed.sql for local development only.
export const DEV_PASSWORD = 'shelterbridge-dev'

export function devEmail(role: AppRole): string {
  return `${role}@shelterbridge.test`
}

// Signs the shared client in as the seeded user for a role, with no operator name.
export async function signInAs(role: AppRole): Promise<void> {
  setOperatorName(null)
  await signInWithPassword(devEmail(role), DEV_PASSWORD)
}

export async function signOutQuietly(): Promise<void> {
  setOperatorName(null)
  await signOut().catch(() => undefined)
}

// Makes fictitious test data unique across runs.
export function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

export { supabase }
```

`web/tests/integration/auth.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest'
import { getMyAppUser, getSession, signInWithPassword, signUp } from '@/api/auth'
import { isApiError } from '@/api/errors'
import type { AppRole } from '@/types/domain'
import { devEmail, signInAs, signOutQuietly, supabase, uniqueSuffix } from './helpers'

afterEach(async () => {
  await signOutQuietly()
})

describe('api/auth against local Supabase', () => {
  it.each<AppRole>(['admin', 'legal', 'psychology', 'volunteer'])(
    'signs in as %s and reads their own app user',
    async (role) => {
      await signInAs(role)
      const appUser = await getMyAppUser()
      expect(appUser?.role).toBe(role)
      expect(appUser?.email).toBe(devEmail(role))
      expect(appUser?.active).toBe(true)
    },
  )

  it('rejects a wrong password with invalid_credentials', async () => {
    const error = await signInWithPassword(devEmail('volunteer'), 'not-the-password').catch((e: unknown) => e)
    expect(isApiError(error, 'invalid_credentials')).toBe(true)
  })

  it('rejects the sign-up of an email that was not invited with not_invited', async () => {
    const error = await signUp(`stranger-${uniqueSuffix()}@example.test`, 'una-clave-larga').catch((e: unknown) => e)
    expect(isApiError(error, 'not_invited')).toBe(true)
  })

  it('lets an invited email sign up, but not sign in before confirming', async () => {
    const email = `t-invited-${uniqueSuffix()}@example.test`
    await signInAs('admin')
    const { error: inviteError } = await supabase
      .from('app_users')
      .insert({ email, role: 'legal', display_name: 'Persona Invitada de Prueba' })
    expect(inviteError).toBeNull()
    await signOutQuietly()

    await signUp(email, 'una-clave-larga')
    const error = await signInWithPassword(email, 'una-clave-larga').catch((e: unknown) => e)
    expect(isApiError(error, 'email_not_confirmed')).toBe(true)
  })

  it('signs out', async () => {
    await signInAs('legal')
    expect(await getSession()).not.toBeNull()
    await signOutQuietly()
    expect(await getSession()).toBeNull()
    expect(await getMyAppUser()).toBeNull()
  })
})
```

- [ ] **Step 5: Run both to verify they fail**

Run: `npm --prefix web run test -- tests/api/auth.test.ts`

Expected: FAIL with `Failed to resolve import "@/api/auth"`.

Run: `npm --prefix web run test:integration -- tests/integration/auth.test.ts`

Expected: FAIL with `Failed to resolve import "@/api/auth"`.

- [ ] **Step 6: Write `api/auth.ts`**

`web/src/api/auth.ts`:

```ts
import { isAuthApiError, type Session } from '@supabase/supabase-js'
import type { AppUser } from '@/types/domain'
import { supabase } from './client'
import { ApiError, toApiError } from './errors'

export type { Session }

function appUrl(path: string): string {
  return `${window.location.origin}${path}`
}

export async function signInWithPassword(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw toApiError(error)
}

export async function signInWithGoogle(): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: appUrl('/residents') },
  })
  if (error) throw toApiError(error)
}

export async function signUp(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: appUrl('/residents') },
  })
  // The Before User Created hook answers 403 for emails that were not invited.
  if (isAuthApiError(error) && error.status === 403) throw new ApiError('not_invited')
  if (error) throw toApiError(error)
}

export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: appUrl('/reset-password'),
  })
  if (error) throw toApiError(error)
}

export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw toApiError(error)
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut()
  if (error) throw toApiError(error)
}

export async function getSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw toApiError(error)
  return data.session
}

// Supabase runs auth callbacks while holding its auth lock. Calling back into
// Supabase from inside one can deadlock, so the callback is deferred.
export function onAuthChange(callback: (session: Session | null) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    setTimeout(() => callback(session), 0)
  })
  return () => data.subscription.unsubscribe()
}

export async function getMyAppUser(): Promise<AppUser | null> {
  const session = await getSession()
  if (!session) return null
  const { data, error } = await supabase
    .from('app_users')
    .select('*')
    .eq('user_id', session.user.id)
    .maybeSingle()
  if (error) throw toApiError(error)
  return data
}
```

- [ ] **Step 7: Run both to verify they pass**

Run: `npm --prefix web run test -- tests/api/auth.test.ts`

Expected: `Tests  7 passed (7)`.

Run: `npm --prefix web run test:integration -- tests/integration/auth.test.ts`

Expected: `Tests  8 passed (8)`. If the sign-up tests fail with a 429 status, the rate limits from Step 1 are not active: run `npm run db:stop` and `npm run db:start` again.

- [ ] **Step 8: Run lint and typecheck**

Run: `npm --prefix web run lint`, then `npm --prefix web run typecheck`

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add supabase/config.toml web/src/api/auth.ts web/tests/api/auth.test.ts web/tests/integration/helpers.ts web/tests/integration/auth.test.ts
git commit -m "feat(web): add auth api with invitation-aware sign-up and integration tests"
```

---

### Task 6: Rows, catalogs and settings API, and the operator name in the audit log

**Files:**
- Create: `web/src/api/rows.ts`, `web/src/api/catalogs.ts`, `web/src/api/settings.ts`
- Test: `web/tests/integration/data.test.ts`

**Interfaces:**
- Consumes: `supabase`, `setOperatorName` (Task 3); `ApiError`, `toApiError` (Task 3); `getMyAppUser` (Task 5); `signInAs`, `signOutQuietly`, `devEmail`, `uniqueSuffix` (Task 5).
- Produces:
  - `updateVersioned<T extends keyof Database['public']['Tables']>(table: T, key: { column: string; value: string }, expectedUpdatedAt: string, patch: Database['public']['Tables'][T]['Update']): Promise<Database['public']['Tables'][T]['Row']>`. Zero rows back throws `ApiError('stale_record')`, or `ApiError('not_authorized')` when the caller's own app user is no longer active (RLS then hides every row, which would otherwise look like a stale version).
  - `listCatalog(name: CatalogName): Promise<CatalogItem[]>`, including inactive items, ordered by `sort_order` then `code`.
  - `interface ShelterSettings { timezone: string; timezone_updated_at: string }` and `getSettings(): Promise<ShelterSettings>`.

- [ ] **Step 1: Write the failing integration test**

`web/tests/integration/data.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest'
import { listCatalog } from '@/api/catalogs'
import { setOperatorName } from '@/api/client'
import { isApiError } from '@/api/errors'
import { updateVersioned } from '@/api/rows'
import { getSettings } from '@/api/settings'
import type { AppRole } from '@/types/domain'
import { devEmail, signInAs, signOutQuietly, supabase, uniqueSuffix } from './helpers'

const ROLES: AppRole[] = ['admin', 'legal', 'psychology', 'volunteer']

afterEach(async () => {
  await signOutQuietly()
})

async function insertPerson(firstName: string): Promise<{ id: string; updated_at: string }> {
  const { data, error } = await supabase.from('people').insert({ first_name: firstName }).select('id, updated_at').single()
  if (error) throw error
  return data
}

// Signs in as admin and switches the seeded volunteer account on or off.
async function setVolunteerActive(active: boolean): Promise<void> {
  await signInAs('admin')
  const { data, error } = await supabase
    .from('app_users')
    .select('updated_at')
    .eq('email', devEmail('volunteer'))
    .single()
  if (error) throw error
  await updateVersioned('app_users', { column: 'email', value: devEmail('volunteer') }, data.updated_at, { active })
}

describe('api/catalogs', () => {
  it.each(ROLES)('lists every country in sort order with Spanish labels as %s', async (role) => {
    await signInAs(role)
    const countries = await listCatalog('countries')
    expect(countries).toHaveLength(249)
    expect(countries[0]).toMatchObject({ code: 'MX', sort_order: 1, active: true })
    expect(countries[0]?.labels.es).toBe('México')
  })

  it('lists the seeded genders and case types', async () => {
    await signInAs('legal')
    expect((await listCatalog('genders')).map((g) => g.code)).toContain('female')
    expect((await listCatalog('case_types')).map((c) => c.code)).toContain('asylum_seeker')
  })
})

describe('error mapping against the real server', () => {
  it('maps a signed-out read to not_authorized', async () => {
    const error = await listCatalog('countries').catch((e: unknown) => e)
    expect(isApiError(error, 'not_authorized')).toBe(true)
  })

  it('maps a business error raised by Postgres (P0001) to its code', async () => {
    await signInAs('admin')
    const { data, error: readError } = await supabase.from('settings').select('updated_at').eq('key', 'timezone').single()
    expect(readError).toBeNull()
    const error = await updateVersioned('settings', { column: 'key', value: 'timezone' }, data?.updated_at ?? '', {
      value: 'Mars/Olympus',
    }).catch((e: unknown) => e)
    expect(isApiError(error, 'validation')).toBe(true)
  })
})

describe('api/settings', () => {
  it.each(ROLES)('reads the shelter timezone as %s', async (role) => {
    await signInAs(role)
    const settings = await getSettings()
    expect(settings.timezone).toBe('America/Mexico_City')
    expect(Number.isNaN(Date.parse(settings.timezone_updated_at))).toBe(false)
  })
})

describe('api/rows updateVersioned', () => {
  it('updates a row that has not changed and returns it', async () => {
    await signInAs('volunteer')
    const person = await insertPerson(`Prueba Versionada ${uniqueSuffix()}`)
    const updated = await updateVersioned('people', { column: 'id', value: person.id }, person.updated_at, {
      region: 'Jalisco',
    })
    expect(updated.region).toBe('Jalisco')
    expect(updated.updated_at).not.toBe(person.updated_at)
  })

  it('throws stale_record when someone else changed the row first', async () => {
    await signInAs('volunteer')
    const person = await insertPerson(`Prueba Concurrente ${uniqueSuffix()}`)
    await updateVersioned('people', { column: 'id', value: person.id }, person.updated_at, { region: 'Jalisco' })
    const error = await updateVersioned('people', { column: 'id', value: person.id }, person.updated_at, {
      region: 'Zacatecas',
    }).catch((e: unknown) => e)
    expect(isApiError(error, 'stale_record')).toBe(true)
  })

  it('throws not_authorized, not stale_record, for a user deactivated mid-session', async () => {
    await signInAs('volunteer')
    const person = await insertPerson(`Prueba Desactivada ${uniqueSuffix()}`)
    try {
      await setVolunteerActive(false)
      // A deactivated user can still sign in with a password; RLS then hides every row.
      await signInAs('volunteer')
      const error = await updateVersioned('people', { column: 'id', value: person.id }, person.updated_at, {
        region: 'Jalisco',
      }).catch((e: unknown) => e)
      expect(isApiError(error, 'not_authorized')).toBe(true)
    } finally {
      await setVolunteerActive(true)
    }
  })

  it('maps a rejected value to validation', async () => {
    await signInAs('volunteer')
    const person = await insertPerson(`Prueba Validación ${uniqueSuffix()}`)
    const error = await updateVersioned('people', { column: 'id', value: person.id }, person.updated_at, {
      first_name: '   ',
    }).catch((e: unknown) => e)
    expect(isApiError(error, 'validation')).toBe(true)
  })
})

describe('operator name header', () => {
  it('reaches the audit log through the shared client', async () => {
    await signInAs('volunteer')
    setOperatorName('Ana Pérez y Ñandú')
    const person = await insertPerson(`Prueba Auditoría ${uniqueSuffix()}`)
    await signInAs('admin')
    const { data, error } = await supabase
      .from('audit_log')
      .select('operator_name, actor_role')
      .eq('table_name', 'people')
      .eq('record_id', person.id)
      .eq('action', 'insert')
      .single()
    expect(error).toBeNull()
    expect(data).toEqual({ operator_name: 'Ana Pérez y Ñandú', actor_role: 'volunteer' })
  })

  it('records no operator name when none is set', async () => {
    await signInAs('legal')
    const person = await insertPerson(`Prueba Sin Operador ${uniqueSuffix()}`)
    await signInAs('admin')
    const { data, error } = await supabase
      .from('audit_log')
      .select('operator_name')
      .eq('table_name', 'people')
      .eq('record_id', person.id)
      .eq('action', 'insert')
      .single()
    expect(error).toBeNull()
    expect(data?.operator_name).toBeNull()
  })
})
```

`signInAs` clears the operator name, so the admin's read in the first operator test does not carry the volunteer's name. The deactivation test switches `volunteer@shelterbridge.test` back on in `finally`, so a failure there cannot break the other tests. A deactivated user can still sign in with a password (the allowlist hook only blocks sign-up); RLS is what shuts them out.

- [ ] **Step 2: Run it to verify it fails**

Run: `npm --prefix web run test:integration -- tests/integration/data.test.ts`

Expected: FAIL with `Failed to resolve import "@/api/catalogs"`.

- [ ] **Step 3: Write the three modules**

`web/src/api/rows.ts`:

```ts
import type { Database } from '@/types/database'
import { getMyAppUser } from './auth'
import { supabase } from './client'
import { ApiError, toApiError } from './errors'

type TableName = keyof Database['public']['Tables']

// Optimistic concurrency: the update only applies if the row still has the
// updated_at value that was loaded. Zero rows back means someone else changed it.
export async function updateVersioned<T extends TableName>(
  table: T,
  key: { column: string; value: string },
  expectedUpdatedAt: string,
  patch: Database['public']['Tables'][T]['Update'],
): Promise<Database['public']['Tables'][T]['Row']> {
  const { data, error } = await supabase
    .from(table as TableName)
    .update(patch as never)
    .eq(key.column as never, key.value as never)
    .eq('updated_at' as never, expectedUpdatedAt as never)
    .select()
  if (error) throw toApiError(error)
  const rows = (data ?? []) as unknown as Database['public']['Tables'][T]['Row'][]
  const [row] = rows
  if (row === undefined) {
    // RLS hides every row from a user deactivated mid-session, which looks like a stale version.
    const me = await getMyAppUser().catch(() => null)
    throw new ApiError(me?.active ? 'stale_record' : 'not_authorized')
  }
  return row
}
```

The casts are needed because supabase-js cannot type a query over a table name that is only known as a generic parameter; the public signature stays fully typed. On zero rows, `getMyAppUser()` tells a stale version (the caller is still active) from a user deactivated mid-session (`not_authorized`). `rows.ts` imports `./auth`, which does not import `rows.ts`, so there is no import cycle.

`web/src/api/catalogs.ts`:

```ts
import type { CatalogItem, CatalogName } from '@/types/domain'
import { supabase } from './client'
import { toApiError } from './errors'

// Includes inactive items: existing records may still point at them.
export async function listCatalog(name: CatalogName): Promise<CatalogItem[]> {
  const { data, error } = await supabase
    .from(name)
    .select('code, labels, sort_order, active, updated_at')
    .order('sort_order')
    .order('code')
  if (error) throw toApiError(error)
  return (data ?? []).map((row) => ({
    code: row.code,
    labels: row.labels as Record<string, string>,
    sort_order: row.sort_order,
    active: row.active,
    updated_at: row.updated_at,
  }))
}
```

`web/src/api/settings.ts`:

```ts
import { supabase } from './client'
import { toApiError } from './errors'

export interface ShelterSettings {
  timezone: string
  timezone_updated_at: string
}

export async function getSettings(): Promise<ShelterSettings> {
  const { data, error } = await supabase
    .from('settings')
    .select('value, updated_at')
    .eq('key', 'timezone')
    .single()
  if (error) throw toApiError(error)
  return { timezone: String(data.value), timezone_updated_at: data.updated_at }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm --prefix web run test:integration`

Expected: both integration files pass, `Tests  25 passed (25)` (8 in `auth.test.ts`, 17 in `data.test.ts`).

- [ ] **Step 5: Run the unit tests, lint and typecheck**

Run: `npm --prefix web run test`, then `npm --prefix web run lint`, then `npm --prefix web run typecheck`

Expected: all pass with no errors.

- [ ] **Step 6: Commit**

```bash
git add web/src/api/rows.ts web/src/api/catalogs.ts web/src/api/settings.ts web/tests/integration/data.test.ts
git commit -m "feat(web): add versioned updates, catalogs and settings api with audit attribution test"
```

---

### Task 7: Session, catalogs and settings stores

**Files:**
- Create: `web/src/stores/session.ts`, `web/src/stores/catalogs.ts`, `web/src/stores/settings.ts`
- Test: `web/tests/stores/session.test.ts`, `web/tests/stores/catalogs.test.ts`, `web/tests/stores/settings.test.ts`

**Interfaces:**
- Consumes: `getSession`, `getMyAppUser`, `onAuthChange`, `signOut`, `Session` from `@/api/auth` (Task 5); `setOperatorName` from `@/api/client` (Task 3); `listCatalog` (Task 6); `getSettings` (Task 6); `i18n` (Task 4).
- Produces (Pinia setup stores, contract names):
  - **`useSessionStore`** (id `session`):
    - state `status: SessionStatus` (`'loading' | 'signedOut' | 'pending' | 'ready'`), `session: Session | null`, `appUser: AppUser | null`, `operatorName: string | null` (restored from sessionStorage key `sb.operatorName` when the store is created, and passed to the api client);
    - getters `role: AppRole | null` (null unless `appUser.active`), `isAdmin: boolean`, `needsOperatorName: boolean`;
    - actions `init(): Promise<void>` (runs once, subscribes to auth changes), `refreshAppUser(): Promise<void>` (reloads the session and the app user), `setOperatorName(name: string | null): void`, `signOut(): Promise<void>`.
    - Whenever the session becomes null (our `signOut()`, or a sign-out Supabase starts itself, such as an expired refresh token), the operator name is cleared too.
    - Also exports `type SessionStatus`.
  - **`useCatalogsStore`** (id `catalogs`): state `items: Record<CatalogName, CatalogItem[]>`, `loaded: boolean`; actions `load()` (no-op once loaded), `reload(name)`; getters `label(name, code)` and `options(name, keepCode?)` returning `CatalogOption[]` (`{ value: string; text: string }`, exported).
  - **`useSettingsStore`** (id `settings`): state `timezone: string` (default `'America/Mexico_City'`), `timezoneUpdatedAt: string | null`, `loaded: boolean`; action `load()` (always fetches). Also exports `DEFAULT_TIMEZONE`.

- [ ] **Step 1: Write the failing tests**

`web/tests/stores/session.test.ts`:

```ts
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as auth from '@/api/auth'
import * as client from '@/api/client'
import { useSessionStore } from '@/stores/session'
import type { AppUser } from '@/types/domain'

vi.mock('@/api/auth')
vi.mock('@/api/client')

function fakeSession(userId: string): auth.Session {
  return { access_token: 'token', user: { id: userId } } as unknown as auth.Session
}

function fakeAppUser(patch: Partial<AppUser> = {}): AppUser {
  return {
    email: 'volunteer@shelterbridge.test',
    user_id: 'user-1',
    role: 'volunteer',
    display_name: 'Voluntariado Demo',
    active: true,
    created_at: '2026-10-07T12:00:00Z',
    created_by: null,
    updated_at: '2026-10-07T12:00:00Z',
    updated_by: null,
    ...patch,
  }
}

let authListener: ((session: auth.Session | null) => void) | null = null

beforeEach(() => {
  setActivePinia(createPinia())
  sessionStorage.clear()
  authListener = null
  vi.mocked(auth.onAuthChange).mockImplementation((callback) => {
    authListener = callback
    return () => undefined
  })
})

afterEach(() => {
  vi.resetAllMocks()
})

describe('session store', () => {
  it('is signed out when there is no session', async () => {
    vi.mocked(auth.getSession).mockResolvedValue(null)
    const store = useSessionStore()
    await store.init()
    expect(store.status).toBe('signedOut')
    expect(store.role).toBeNull()
  })

  it('is ready with the role of an active app user', async () => {
    vi.mocked(auth.getSession).mockResolvedValue(fakeSession('user-1'))
    vi.mocked(auth.getMyAppUser).mockResolvedValue(fakeAppUser({ role: 'admin' }))
    const store = useSessionStore()
    await store.init()
    expect(store.status).toBe('ready')
    expect(store.role).toBe('admin')
    expect(store.isAdmin).toBe(true)
  })

  it('is pending when the user has no app user row', async () => {
    vi.mocked(auth.getSession).mockResolvedValue(fakeSession('user-1'))
    vi.mocked(auth.getMyAppUser).mockResolvedValue(null)
    const store = useSessionStore()
    await store.init()
    expect(store.status).toBe('pending')
    expect(store.role).toBeNull()
  })

  it('is pending when the app user was deactivated', async () => {
    vi.mocked(auth.getSession).mockResolvedValue(fakeSession('user-1'))
    vi.mocked(auth.getMyAppUser).mockResolvedValue(fakeAppUser({ active: false }))
    const store = useSessionStore()
    await store.init()
    expect(store.status).toBe('pending')
    expect(store.role).toBeNull()
  })

  it('init runs only once', async () => {
    vi.mocked(auth.getSession).mockResolvedValue(null)
    const store = useSessionStore()
    await Promise.all([store.init(), store.init()])
    await store.init()
    expect(auth.getSession).toHaveBeenCalledTimes(1)
    expect(auth.onAuthChange).toHaveBeenCalledTimes(1)
  })

  it('follows sign-out events from Supabase and forgets the operator name', async () => {
    vi.mocked(auth.getSession).mockResolvedValue(fakeSession('user-1'))
    vi.mocked(auth.getMyAppUser).mockResolvedValue(fakeAppUser())
    const store = useSessionStore()
    await store.init()
    store.setOperatorName('Ana')
    authListener?.(null)
    await vi.waitFor(() => expect(store.status).toBe('signedOut'))
    expect(store.appUser).toBeNull()
    expect(store.operatorName).toBeNull()
    expect(sessionStorage.getItem('sb.operatorName')).toBeNull()
  })

  it('does not reload the app user on a token refresh for the same user', async () => {
    vi.mocked(auth.getSession).mockResolvedValue(fakeSession('user-1'))
    vi.mocked(auth.getMyAppUser).mockResolvedValue(fakeAppUser())
    const store = useSessionStore()
    await store.init()
    authListener?.(fakeSession('user-1'))
    await Promise.resolve()
    expect(auth.getMyAppUser).toHaveBeenCalledTimes(1)
  })

  it('refreshAppUser reloads the session and the app user', async () => {
    vi.mocked(auth.getSession).mockResolvedValue(null)
    const store = useSessionStore()
    await store.init()
    vi.mocked(auth.getSession).mockResolvedValue(fakeSession('user-2'))
    vi.mocked(auth.getMyAppUser).mockResolvedValue(fakeAppUser({ role: 'legal' }))
    await store.refreshAppUser()
    expect(store.status).toBe('ready')
    expect(store.role).toBe('legal')
  })

  it('needs an operator name only for the volunteer role', async () => {
    vi.mocked(auth.getSession).mockResolvedValue(fakeSession('user-1'))
    vi.mocked(auth.getMyAppUser).mockResolvedValue(fakeAppUser({ role: 'volunteer' }))
    const store = useSessionStore()
    await store.init()
    expect(store.needsOperatorName).toBe(true)
    store.setOperatorName('Ana y Luis')
    expect(store.needsOperatorName).toBe(false)
  })

  it('stores the operator name in sessionStorage and the api client', () => {
    const store = useSessionStore()
    store.setOperatorName('  Ana y Luis ')
    expect(store.operatorName).toBe('Ana y Luis')
    expect(sessionStorage.getItem('sb.operatorName')).toBe('Ana y Luis')
    expect(client.setOperatorName).toHaveBeenLastCalledWith('Ana y Luis')
  })

  it('treats a blank operator name as none', () => {
    const store = useSessionStore()
    store.setOperatorName('Ana')
    store.setOperatorName('   ')
    expect(store.operatorName).toBeNull()
    expect(sessionStorage.getItem('sb.operatorName')).toBeNull()
    expect(client.setOperatorName).toHaveBeenLastCalledWith(null)
  })

  it('restores the operator name after a page reload', () => {
    sessionStorage.setItem('sb.operatorName', 'Turno de noche')
    const store = useSessionStore()
    expect(store.operatorName).toBe('Turno de noche')
    expect(client.setOperatorName).toHaveBeenCalledWith('Turno de noche')
  })

  it('signOut clears the session and the operator name', async () => {
    vi.mocked(auth.getSession).mockResolvedValue(fakeSession('user-1'))
    vi.mocked(auth.getMyAppUser).mockResolvedValue(fakeAppUser())
    const store = useSessionStore()
    await store.init()
    store.setOperatorName('Ana')
    await store.signOut()
    expect(auth.signOut).toHaveBeenCalled()
    expect(store.status).toBe('signedOut')
    expect(store.operatorName).toBeNull()
    expect(sessionStorage.getItem('sb.operatorName')).toBeNull()
  })
})
```

`web/tests/stores/catalogs.test.ts`:

```ts
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as catalogsApi from '@/api/catalogs'
import { useCatalogsStore } from '@/stores/catalogs'
import type { CatalogItem, CatalogName } from '@/types/domain'

vi.mock('@/api/catalogs')

function item(code: string, es: string, sort_order: number, active = true, extra: Record<string, string> = {}): CatalogItem {
  return { code, labels: { es, ...extra }, sort_order, active, updated_at: '2026-10-07T12:00:00Z' }
}

const data: Record<CatalogName, CatalogItem[]> = {
  countries: [
    item('ZA', 'Sudáfrica', 1000),
    item('HN', 'Honduras', 2),
    item('MX', 'México', 1),
    item('AR', 'Argentina', 1000),
    item('XK', 'Kosovo', 1000, false),
  ],
  case_types: [item('asylum_seeker', 'Solicitante de asilo', 2), item('returnee', 'Persona retornada', 3, false)],
  genders: [item('female', 'Mujer', 1, true, { en: 'Woman' })],
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.mocked(catalogsApi.listCatalog).mockImplementation(async (name) => data[name])
})

afterEach(() => {
  vi.resetAllMocks()
})

describe('catalogs store', () => {
  it('loads every catalog once', async () => {
    const store = useCatalogsStore()
    await store.load()
    await store.load()
    expect(store.loaded).toBe(true)
    expect(catalogsApi.listCatalog).toHaveBeenCalledTimes(3)
    expect(store.items.countries).toHaveLength(5)
  })

  it('reload refreshes one catalog', async () => {
    const store = useCatalogsStore()
    await store.load()
    vi.mocked(catalogsApi.listCatalog).mockResolvedValueOnce([item('male', 'Hombre', 1)])
    await store.reload('genders')
    expect(store.items.genders.map((g) => g.code)).toEqual(['male'])
  })

  it('label uses the Spanish label for es-MX', async () => {
    const store = useCatalogsStore()
    await store.load()
    expect(store.label('genders', 'female')).toBe('Mujer')
  })

  it('label falls back to the code, and to an empty string for no code', async () => {
    const store = useCatalogsStore()
    await store.load()
    expect(store.label('countries', 'QQ')).toBe('QQ')
    expect(store.label('countries', null)).toBe('')
    expect(store.label('countries', undefined)).toBe('')
  })

  it('options lists active items by sort order, then label', async () => {
    const store = useCatalogsStore()
    await store.load()
    expect(store.options('countries')).toEqual([
      { value: 'MX', text: 'México' },
      { value: 'HN', text: 'Honduras' },
      { value: 'AR', text: 'Argentina' },
      { value: 'ZA', text: 'Sudáfrica' },
    ])
  })

  it('options keeps the current value even when it is inactive', async () => {
    const store = useCatalogsStore()
    await store.load()
    expect(store.options('case_types', 'returnee').map((o) => o.value)).toEqual(['asylum_seeker', 'returnee'])
    expect(store.options('case_types').map((o) => o.value)).toEqual(['asylum_seeker'])
  })
})
```

`web/tests/stores/settings.test.ts`:

```ts
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as settingsApi from '@/api/settings'
import { useSettingsStore } from '@/stores/settings'

vi.mock('@/api/settings')

beforeEach(() => {
  setActivePinia(createPinia())
})

afterEach(() => {
  vi.resetAllMocks()
})

describe('settings store', () => {
  it('defaults to Mexico City before loading', () => {
    const store = useSettingsStore()
    expect(store.timezone).toBe('America/Mexico_City')
    expect(store.loaded).toBe(false)
  })

  it('loads the shelter timezone', async () => {
    vi.mocked(settingsApi.getSettings).mockResolvedValue({
      timezone: 'America/Tijuana',
      timezone_updated_at: '2026-10-07T12:00:00Z',
    })
    const store = useSettingsStore()
    await store.load()
    expect(store.timezone).toBe('America/Tijuana')
    expect(store.timezoneUpdatedAt).toBe('2026-10-07T12:00:00Z')
    expect(store.loaded).toBe(true)
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm --prefix web run test -- tests/stores`

Expected: FAIL with `Failed to resolve import "@/stores/session"` (and the same for the other two stores).

- [ ] **Step 3: Write the stores**

`web/src/stores/session.ts`:

```ts
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  getMyAppUser,
  getSession,
  onAuthChange,
  signOut as apiSignOut,
  type Session,
} from '@/api/auth'
import { setOperatorName as setClientOperatorName } from '@/api/client'
import type { AppRole, AppUser } from '@/types/domain'

export type SessionStatus = 'loading' | 'signedOut' | 'pending' | 'ready'

const OPERATOR_KEY = 'sb.operatorName'

function readStoredOperator(): string | null {
  try {
    return sessionStorage.getItem(OPERATOR_KEY)
  } catch {
    return null
  }
}

export const useSessionStore = defineStore('session', () => {
  const status = ref<SessionStatus>('loading')
  const session = ref<Session | null>(null)
  const appUser = ref<AppUser | null>(null)
  const operatorName = ref<string | null>(readStoredOperator())
  setClientOperatorName(operatorName.value)

  const role = computed<AppRole | null>(() => (appUser.value?.active ? appUser.value.role : null))
  const isAdmin = computed(() => role.value === 'admin')
  const needsOperatorName = computed(() => role.value === 'volunteer' && !operatorName.value)

  let initPromise: Promise<void> | null = null
  let applyCount = 0

  async function apply(next: Session | null, reloadUser: boolean): Promise<void> {
    const call = ++applyCount
    const sameUser = next !== null && next.user.id === session.value?.user.id
    session.value = next
    if (next === null) {
      appUser.value = null
      status.value = 'signedOut'
      // Also covers a sign-out started by Supabase, such as an expired refresh token.
      setOperatorName(null)
      return
    }
    if (sameUser && !reloadUser && status.value !== 'loading') return
    const user = await getMyAppUser()
    if (call !== applyCount) return
    appUser.value = user
    status.value = user?.active ? 'ready' : 'pending'
  }

  function init(): Promise<void> {
    if (!initPromise) {
      initPromise = (async () => {
        try {
          await apply(await getSession(), true)
        } catch {
          await apply(null, true)
        }
        onAuthChange((next) => {
          void apply(next, false).catch(() => undefined)
        })
      })()
    }
    return initPromise
  }

  async function refreshAppUser(): Promise<void> {
    await apply(await getSession(), true)
  }

  function setOperatorName(name: string | null): void {
    const trimmed = name?.trim() ?? ''
    operatorName.value = trimmed === '' ? null : trimmed
    try {
      if (operatorName.value === null) sessionStorage.removeItem(OPERATOR_KEY)
      else sessionStorage.setItem(OPERATOR_KEY, operatorName.value)
    } catch {
      // Private browsing can block storage; the name still lives in memory.
    }
    setClientOperatorName(operatorName.value)
  }

  async function signOut(): Promise<void> {
    try {
      await apiSignOut()
    } finally {
      await apply(null, true)
    }
  }

  return {
    status,
    session,
    appUser,
    operatorName,
    role,
    isAdmin,
    needsOperatorName,
    init,
    refreshAppUser,
    setOperatorName,
    signOut,
  }
})
```

`apply` counts its calls so that a slow `getMyAppUser()` from an older auth event cannot overwrite a newer result. Its signed-out branch also clears the operator name, so the next person at the computer is asked again even when Supabase ended the session on its own. If the first `getSession()` or `getMyAppUser()` fails (for example offline), `init()` treats the user as signed out instead of hanging on the loading state.

`web/src/stores/catalogs.ts`:

```ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { listCatalog } from '@/api/catalogs'
import { i18n } from '@/i18n'
import type { CatalogItem, CatalogName } from '@/types/domain'

const CATALOGS: CatalogName[] = ['countries', 'case_types', 'genders']

export interface CatalogOption {
  value: string
  text: string
}

export const useCatalogsStore = defineStore('catalogs', () => {
  const items = ref<Record<CatalogName, CatalogItem[]>>({ countries: [], case_types: [], genders: [] })
  const loaded = ref(false)

  async function load(): Promise<void> {
    if (loaded.value) return
    const lists = await Promise.all(CATALOGS.map((name) => listCatalog(name)))
    CATALOGS.forEach((name, index) => {
      items.value[name] = lists[index] ?? []
    })
    loaded.value = true
  }

  async function reload(name: CatalogName): Promise<void> {
    items.value[name] = await listCatalog(name)
  }

  function labelOf(item: CatalogItem): string {
    const locale = String(i18n.global.locale.value)
    const language = locale.split('-')[0] ?? locale
    return item.labels[locale] ?? item.labels[language] ?? item.labels.es ?? item.code
  }

  function label(name: CatalogName, code: string | null | undefined): string {
    if (!code) return ''
    const item = items.value[name].find((candidate) => candidate.code === code)
    return item ? labelOf(item) : code
  }

  function options(name: CatalogName, keepCode?: string | null): CatalogOption[] {
    return items.value[name]
      .filter((item) => item.active || item.code === keepCode)
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order || labelOf(a).localeCompare(labelOf(b), 'es'))
      .map((item) => ({ value: item.code, text: labelOf(item) }))
  }

  return { items, loaded, load, reload, label, options }
})
```

Catalog labels are stored under language keys (`es`, `en`), so for the `es-MX` locale `labelOf` tries `labels['es-MX']`, then `labels.es` (from the language part), then the code.

`web/src/stores/settings.ts`:

```ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getSettings } from '@/api/settings'

export const DEFAULT_TIMEZONE = 'America/Mexico_City'

export const useSettingsStore = defineStore('settings', () => {
  const timezone = ref(DEFAULT_TIMEZONE)
  const timezoneUpdatedAt = ref<string | null>(null)
  const loaded = ref(false)

  async function load(): Promise<void> {
    const settings = await getSettings()
    timezone.value = settings.timezone
    timezoneUpdatedAt.value = settings.timezone_updated_at
    loaded.value = true
  }

  return { timezone, timezoneUpdatedAt, loaded, load }
})
```

- [ ] **Step 4: Run them to verify they pass**

Run: `npm --prefix web run test -- tests/stores`

Expected: `Test Files  3 passed (3)`, `Tests  21 passed (21)`.

- [ ] **Step 5: Run lint and typecheck**

Run: `npm --prefix web run lint`, then `npm --prefix web run typecheck`

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add web/src/stores web/tests/stores
git commit -m "feat(web): add session, catalogs and settings stores"
```

---

### Task 8: Notifications, confirmations and connectivity

**Files:**
- Create: `web/src/composables/useOnline.ts`, `web/src/composables/useNotify.ts`, `web/src/composables/useConfirm.ts`
- Create: `web/src/components/common/ToastHost.vue`, `web/src/components/common/ConfirmHost.vue`
- Test: `web/tests/components/ToastHost.test.ts`, `web/tests/components/ConfirmHost.test.ts`

**Interfaces:**
- Consumes: `toApiError` (Task 3); `i18n` (Task 4).
- Produces:
  - **`useOnline(): { online: Ref<boolean> }`**: one shared flag that follows the browser's `online` and `offline` events. Also exports `reportNetworkFailure(): void`, which sets it to false and re-reads `navigator.onLine` after 15 seconds.
  - **`useNotify(): { success(key: string, params?: Record<string, unknown>): void; error(error: unknown): void }`**: `error` maps through `toApiError`, shows `t(apiError.i18nKey)`, and calls `reportNetworkFailure()` for `network`. Also exports `pendingNotifications: Ref<Notification[]>` (the queue `ToastHost` drains) and `interface Notification { id: number; kind: 'success' | 'error'; text: string }`.
  - **`useConfirm(): { confirm(options: ConfirmOptions): Promise<boolean> }`** with `ConfirmOptions = { titleKey: string; messageKey: string; messageParams?: Record<string, unknown>; confirmKey?: string; cancelKey?: string; danger?: boolean }`. Asking a new question answers an open one with `false`. Also exports `activeConfirm` (the open request) and `answerConfirm(answer: boolean)`.
  - **`ToastHost.vue`**: a Syncfusion Toast, top right; errors stay 8 seconds, successes 4. It HTML-escapes every message, because the Toast renders `content` as HTML and messages can hold names.
  - **`ConfirmHost.vue`**: a Syncfusion modal Dialog that stays mounted and binds `visible`. The message is a Vue-rendered `<p data-testid="confirm-message">` child, never the Dialog's HTML `content` property. Escape and the close icon answer `false`.
  - Both hosts are mounted once, in `App.vue` (Task 11).

- [ ] **Step 1: Write the failing tests**

`web/tests/components/ToastHost.test.ts`:

```ts
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import ToastHost from '@/components/common/ToastHost.vue'
import { ApiError } from '@/api/errors'
import { pendingNotifications, useNotify } from '@/composables/useNotify'
import { useOnline } from '@/composables/useOnline'
import { i18n } from '@/i18n'

afterEach(() => {
  pendingNotifications.value.splice(0)
  document.body.innerHTML = ''
})

describe('useNotify', () => {
  it('queues a translated success message', () => {
    useNotify().success('auth.passwordSaved')
    expect(pendingNotifications.value.at(-1)).toMatchObject({ kind: 'success', text: 'Listo, tu contraseña quedó guardada.' })
  })

  it('queues the translated message for an ApiError', () => {
    useNotify().error(new ApiError('stale_record'))
    expect(pendingNotifications.value.at(-1)?.text).toBe(i18n.global.t('errors.stale_record'))
  })

  it('maps raw errors through toApiError', () => {
    useNotify().error({ code: '23P01', message: 'conflicting key value' })
    expect(pendingNotifications.value.at(-1)?.text).toBe(i18n.global.t('errors.overlapping_stays'))
  })

  it('marks the app offline on a network error', () => {
    const { online } = useOnline()
    useNotify().error(new ApiError('network'))
    expect(online.value).toBe(false)
  })
})

describe('ToastHost', () => {
  it('shows queued notifications as toasts', async () => {
    const wrapper = mount(ToastHost, { attachTo: document.body, global: { plugins: [i18n] } })
    useNotify().error(new ApiError('not_authorized'))
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()
    expect(document.body.textContent).toContain('No tienes permiso para hacer esto.')
    expect(pendingNotifications.value).toHaveLength(0)
    wrapper.unmount()
  })

  it('shows names as plain text, never as HTML', async () => {
    const wrapper = mount(ToastHost, { attachTo: document.body, global: { plugins: [i18n] } })
    useNotify().success('nav.onShift', { name: '<b>Ana</b>' })
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()
    const toast = document.body.querySelector('.e-toast')
    expect(toast?.textContent).toContain('De turno: <b>Ana</b>')
    expect(toast?.querySelector('b')).toBeNull()
    wrapper.unmount()
  })
})
```

`web/tests/components/ConfirmHost.test.ts`:

```ts
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import ConfirmHost from '@/components/common/ConfirmHost.vue'
import { activeConfirm, useConfirm } from '@/composables/useConfirm'
import { i18n } from '@/i18n'

function buttonWithText(text: string): HTMLButtonElement {
  const button = Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent?.trim() === text)
  if (!button) throw new Error(`No button "${text}"`)
  return button
}

afterEach(() => {
  activeConfirm.value = null
  document.body.innerHTML = ''
})

describe('useConfirm with ConfirmHost', () => {
  it('shows the question and resolves true on confirm', async () => {
    const wrapper = mount(ConfirmHost, { attachTo: document.body, global: { plugins: [i18n] } })
    const answer = useConfirm().confirm({ titleKey: 'shift.title', messageKey: 'errors.outing_exception_needs_confirmation' })
    await flushPromises()
    expect(document.body.textContent).toContain('Ya salió hoy, ¿registrar como excepción?')
    buttonWithText('Confirmar').click()
    await expect(answer).resolves.toBe(true)
    wrapper.unmount()
  })

  it('resolves false on cancel, with custom button labels', async () => {
    const wrapper = mount(ConfirmHost, { attachTo: document.body, global: { plugins: [i18n] } })
    const answer = useConfirm().confirm({
      titleKey: 'shift.title',
      messageKey: 'errors.unknown',
      confirmKey: 'common.continue',
      cancelKey: 'common.close',
    })
    await flushPromises()
    buttonWithText('Cerrar').click()
    await expect(answer).resolves.toBe(false)
    wrapper.unmount()
  })

  it('resolves false when the close icon is used', async () => {
    const wrapper = mount(ConfirmHost, { attachTo: document.body, global: { plugins: [i18n] } })
    const answer = useConfirm().confirm({ titleKey: 'shift.title', messageKey: 'errors.unknown' })
    await flushPromises()
    const closeIcon = document.body.querySelector<HTMLButtonElement>('.e-dlg-closeicon-btn')
    expect(closeIcon).not.toBeNull()
    closeIcon?.click()
    await expect(answer).resolves.toBe(false)
    wrapper.unmount()
  })

  it('a confirmed question does not cancel the next one', async () => {
    const wrapper = mount(ConfirmHost, { attachTo: document.body, global: { plugins: [i18n] } })
    const { confirm } = useConfirm()
    const first = confirm({ titleKey: 'shift.title', messageKey: 'errors.unknown' })
    await flushPromises()
    buttonWithText('Confirmar').click()
    await expect(first).resolves.toBe(true)
    const second = confirm({ titleKey: 'shift.title', messageKey: 'errors.network' })
    await flushPromises()
    expect(activeConfirm.value?.options.messageKey).toBe('errors.network')
    expect(document.body.querySelector('[data-testid="confirm-message"]')?.textContent).toBe(
      'Sin conexión. Revisa el internet e inténtalo de nuevo.',
    )
    buttonWithText('Confirmar').click()
    await expect(second).resolves.toBe(true)
    wrapper.unmount()
  })

  it('shows message parameters as plain text, never as HTML', async () => {
    const wrapper = mount(ConfirmHost, { attachTo: document.body, global: { plugins: [i18n] } })
    void useConfirm().confirm({ titleKey: 'shift.title', messageKey: 'nav.onShift', messageParams: { name: '<b>Ana</b>' } })
    await flushPromises()
    const message = document.body.querySelector('[data-testid="confirm-message"]')
    expect(message?.textContent).toBe('De turno: <b>Ana</b>')
    expect(document.body.querySelector('.e-dialog b')).toBeNull()
    wrapper.unmount()
  })

  it('answers false to an open question when a new one is asked', async () => {
    const { confirm } = useConfirm()
    const first = confirm({ titleKey: 'shift.title', messageKey: 'errors.unknown' })
    const second = confirm({ titleKey: 'shift.title', messageKey: 'errors.network' })
    await expect(first).resolves.toBe(false)
    expect(activeConfirm.value?.options.messageKey).toBe('errors.network')
    activeConfirm.value?.resolve(true)
    await expect(second).resolves.toBe(true)
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm --prefix web run test -- tests/components`

Expected: FAIL with `Failed to resolve import "@/components/common/ToastHost.vue"` and `Failed to resolve import "@/components/common/ConfirmHost.vue"`.

- [ ] **Step 3: Write the composables**

`web/src/composables/useOnline.ts`:

```ts
import { ref, type Ref } from 'vue'

// One shared flag for the whole app. It follows the browser's online and
// offline events, and a failed request can also mark the app offline for a while.
const RECHECK_AFTER_FAILURE_MS = 15_000

const online = ref(typeof navigator === 'undefined' ? true : navigator.onLine)
let recheckTimer: ReturnType<typeof setTimeout> | undefined
let listening = false

function listen(): void {
  if (listening || typeof window === 'undefined') return
  listening = true
  window.addEventListener('online', () => {
    online.value = true
  })
  window.addEventListener('offline', () => {
    online.value = false
  })
}

export function reportNetworkFailure(): void {
  online.value = false
  clearTimeout(recheckTimer)
  recheckTimer = setTimeout(() => {
    online.value = navigator.onLine
  }, RECHECK_AFTER_FAILURE_MS)
}

export function useOnline(): { online: Ref<boolean> } {
  listen()
  return { online }
}
```

`web/src/composables/useNotify.ts`:

```ts
import { ref } from 'vue'
import { toApiError } from '@/api/errors'
import { i18n } from '@/i18n'
import { reportNetworkFailure } from './useOnline'

export interface Notification {
  id: number
  kind: 'success' | 'error'
  text: string
}

// Queue drained by ToastHost. Texts are translated when queued.
export const pendingNotifications = ref<Notification[]>([])
let nextId = 1

function push(kind: Notification['kind'], text: string): void {
  pendingNotifications.value.push({ id: nextId++, kind, text })
}

export function useNotify(): {
  success(key: string, params?: Record<string, unknown>): void
  error(error: unknown): void
} {
  return {
    success(key, params = {}) {
      push('success', i18n.global.t(key, params))
    },
    error(error) {
      const apiError = toApiError(error)
      if (apiError.code === 'network') reportNetworkFailure()
      push('error', i18n.global.t(apiError.i18nKey))
    },
  }
}
```

`web/src/composables/useConfirm.ts`:

```ts
import { shallowRef } from 'vue'

export interface ConfirmOptions {
  titleKey: string
  messageKey: string
  messageParams?: Record<string, unknown>
  confirmKey?: string
  cancelKey?: string
  danger?: boolean
}

export interface ConfirmRequest {
  options: ConfirmOptions
  resolve: (answer: boolean) => void
}

// The open question, rendered by ConfirmHost. Only one can be open at a time.
export const activeConfirm = shallowRef<ConfirmRequest | null>(null)

export function answerConfirm(answer: boolean): void {
  const request = activeConfirm.value
  if (!request) return
  activeConfirm.value = null
  request.resolve(answer)
}

export function useConfirm(): { confirm(options: ConfirmOptions): Promise<boolean> } {
  return {
    confirm(options) {
      answerConfirm(false)
      return new Promise<boolean>((resolve) => {
        activeConfirm.value = { options, resolve }
      })
    },
  }
}
```

- [ ] **Step 4: Write the hosts**

`web/src/components/common/ToastHost.vue`:

```vue
<script setup lang="ts">
import { ToastComponent as EjsToast } from '@syncfusion/ej2-vue-notifications'
import { ref, watch } from 'vue'
import { pendingNotifications } from '@/composables/useNotify'

const toast = ref<InstanceType<typeof EjsToast> | null>(null)

// Syncfusion renders toast content as HTML. Messages can hold names typed by
// staff, so they are escaped and always show as plain text.
const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ESC[c] ?? c)
}

watch(
  () => pendingNotifications.value.length,
  () => {
    if (!toast.value) return
    for (const notification of pendingNotifications.value.splice(0)) {
      const isError = notification.kind === 'error'
      toast.value.show({
        content: escapeHtml(notification.text),
        cssClass: isError ? 'e-toast-danger' : 'e-toast-success',
        timeOut: isError ? 8000 : 4000,
      })
    }
  },
  { flush: 'post' },
)
</script>

<template>
  <EjsToast ref="toast" :position="{ X: 'Right', Y: 'Top' }" :show-close-button="true" data-testid="toast-host" />
</template>
```

`web/src/components/common/ConfirmHost.vue`:

```vue
<script setup lang="ts">
import { DialogComponent as EjsDialog, type CloseEventArgs } from '@syncfusion/ej2-vue-popups'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { activeConfirm, answerConfirm } from '@/composables/useConfirm'

const { t } = useI18n()

const options = computed(() => activeConfirm.value?.options ?? null)
const header = computed(() => (options.value ? t(options.value.titleKey) : ''))
// Rendered by Vue as text, never through the Dialog's HTML "content" property,
// because message parameters can hold names typed by staff.
const message = computed(() =>
  options.value ? t(options.value.messageKey, options.value.messageParams ?? {}) : '',
)
const buttons = computed(() => [
  {
    buttonModel: { content: t(options.value?.cancelKey ?? 'common.cancel'), cssClass: 'e-flat' },
    click: () => answerConfirm(false),
  },
  {
    buttonModel: {
      content: t(options.value?.confirmKey ?? 'common.confirm'),
      isPrimary: true,
      cssClass: options.value?.danger ? 'e-danger' : '',
    },
    click: () => answerConfirm(true),
  },
])

// Escape and the close icon count as "no". Closing because the question was
// answered (not interacted) must not answer the next question.
function onClose(args: CloseEventArgs): void {
  if (!args.isInteracted) return
  answerConfirm(false)
}
</script>

<template>
  <div>
    <EjsDialog
      :visible="options !== null"
      :header="header"
      :buttons="buttons"
      :is-modal="true"
      :show-close-icon="true"
      :close-on-escape="true"
      :animation-settings="{ effect: 'None' }"
      width="min(28rem, 95vw)"
      :close="onClose"
    >
      <p class="mb-0" data-testid="confirm-message">{{ message }}</p>
    </EjsDialog>
  </div>
</template>
```

The dialog stays mounted and only `visible` changes. A shown Syncfusion modal Dialog that Vue unmounts through `v-if` throws `NotFoundError: The child can not be found in the parent`, because Syncfusion moved its element into an overlay container.

Both hosts keep personal data out of HTML: Syncfusion renders the Toast's and the Dialog's `content` as HTML, and Plan 3 puts people's names into notifications and questions. The two "plain text, never as HTML" tests fail if either host passes the text through as HTML.

- [ ] **Step 5: Run them to verify they pass**

Run: `npm --prefix web run test -- tests/components`

Expected: `Test Files  2 passed (2)`, `Tests  12 passed (12)`, and no `Unhandled Errors` section.

- [ ] **Step 6: Run lint and typecheck**

Run: `npm --prefix web run lint`, then `npm --prefix web run typecheck`

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add web/src/composables/useOnline.ts web/src/composables/useNotify.ts web/src/composables/useConfirm.ts web/src/components/common/ToastHost.vue web/src/components/common/ConfirmHost.vue web/tests/components/ToastHost.test.ts web/tests/components/ConfirmHost.test.ts
git commit -m "feat(web): add toast notifications, confirm dialog and connectivity flag"
```

---

### Task 9: Shelter time composable, PageHeader and CatalogSelect

**Files:**
- Create: `web/src/composables/useShelterTime.ts`, `web/src/components/common/PageHeader.vue`, `web/src/components/common/CatalogSelect.vue`
- Test: `web/tests/composables/useShelterTime.test.ts`, `web/tests/components/PageHeader.test.ts`, `web/tests/components/CatalogSelect.test.ts`

**Interfaces:**
- Consumes: `lib/shelterTime` (Task 2); `useSettingsStore`, `useCatalogsStore` (Task 7); `i18n` (Task 4).
- Produces:
  - **`useShelterTime(): { formatDate(value): string; formatTime(value): string; formatDateTime(value): string; today(): string }`**, where `value: string | Date | null | undefined`. Each call reads the settings store's current timezone.
  - **`PageHeader.vue`**: props `titleKey: string`, `titleParams?: Record<string, unknown>`; slot `actions`. Renders an `h1` with the translated title.
  - **`CatalogSelect.vue`**: a Syncfusion DropDownList over `useCatalogsStore().options(catalog, modelValue)`. Props `catalog: CatalogName`, `modelValue: string | null`, `placeholderKey?: string` (default `common.select`), `allowEmpty?: boolean` (shows the clear button), `id?: string` (the `id` of the visible input, for `<label for>`). Emits `update:modelValue` with the code, or `null` when cleared. Filtering turns on when there are more than 15 options and ignores accents.

- [ ] **Step 1: Write the failing tests**

`web/tests/composables/useShelterTime.test.ts`:

```ts
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useShelterTime } from '@/composables/useShelterTime'
import { useSettingsStore } from '@/stores/settings'

afterEach(() => {
  vi.useRealTimers()
})

describe('useShelterTime', () => {
  it('formats in the timezone from settings, following changes', () => {
    setActivePinia(createTestingPinia({ createSpy: vi.fn, initialState: { settings: { timezone: 'America/Mexico_City' } } }))
    const time = useShelterTime()
    expect(time.formatDateTime('2026-07-15T18:30:00Z')).toBe('15/07/2026 12:30')
    useSettingsStore().timezone = 'America/Tijuana'
    expect(time.formatTime('2026-07-15T18:30:00Z')).toBe('11:30')
    expect(time.formatDate('2026-07-15')).toBe('15/07/2026')
  })

  it('today is the shelter date', () => {
    setActivePinia(createTestingPinia({ createSpy: vi.fn, initialState: { settings: { timezone: 'America/Mexico_City' } } }))
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T05:30:00Z'))
    expect(useShelterTime().today()).toBe('2025-12-31')
  })
})
```

`web/tests/components/PageHeader.test.ts`:

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PageHeader from '@/components/common/PageHeader.vue'
import { i18n } from '@/i18n'

describe('PageHeader', () => {
  it('shows the translated title with parameters and the actions slot', () => {
    const wrapper = mount(PageHeader, {
      props: { titleKey: 'nav.onShift', titleParams: { name: 'Ana' } },
      slots: { actions: '<button type="button">Acción</button>' },
      global: { plugins: [i18n] },
    })
    expect(wrapper.get('h1').text()).toBe('De turno: Ana')
    expect(wrapper.get('button').text()).toBe('Acción')
  })
})
```

`web/tests/components/CatalogSelect.test.ts`:

```ts
import { createTestingPinia } from '@pinia/testing'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CatalogSelect from '@/components/common/CatalogSelect.vue'
import { i18n } from '@/i18n'
import type { CatalogItem } from '@/types/domain'

vi.mock('@/api/catalogs')

function item(code: string, es: string, sort_order: number, active = true): CatalogItem {
  return { code, labels: { es }, sort_order, active, updated_at: '2026-10-07T12:00:00Z' }
}

const countries = [item('MX', 'México', 1), item('HN', 'Honduras', 2), item('XK', 'Kosovo', 1000, false)]

function mountSelect(props: { modelValue: string | null; allowEmpty?: boolean }) {
  return mount(CatalogSelect, {
    attachTo: document.body,
    props: { catalog: 'countries', ...props },
    global: {
      plugins: [
        i18n,
        createTestingPinia({
          createSpy: vi.fn,
          stubActions: false,
          initialState: { catalogs: { items: { countries, case_types: [], genders: [] }, loaded: true } },
        }),
      ],
    },
  })
}

type DropDownInstance = { dataSource: { value: string; text: string }[]; value: string | null; text: string | null; dataBind(): void }

function dropDown(wrapper: ReturnType<typeof mountSelect>): DropDownInstance {
  return (wrapper.findComponent({ name: 'DropDownListComponent' }).vm as unknown as { ej2Instances: DropDownInstance }).ej2Instances
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('CatalogSelect', () => {
  it('offers the active items with Spanish labels', async () => {
    const wrapper = mountSelect({ modelValue: null })
    await flushPromises()
    expect(dropDown(wrapper).dataSource).toEqual([
      { value: 'MX', text: 'México' },
      { value: 'HN', text: 'Honduras' },
    ])
    wrapper.unmount()
  })

  it('keeps an inactive current value selectable', async () => {
    const wrapper = mountSelect({ modelValue: 'XK' })
    await flushPromises()
    expect(dropDown(wrapper).dataSource.map((o) => o.value)).toContain('XK')
    expect(dropDown(wrapper).text).toBe('Kosovo')
    wrapper.unmount()
  })

  it('emits the chosen code', async () => {
    const wrapper = mountSelect({ modelValue: 'MX' })
    await flushPromises()
    const instance = dropDown(wrapper)
    instance.value = 'HN'
    instance.dataBind()
    await flushPromises()
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['HN'])
    wrapper.unmount()
  })

  it('emits null when cleared', async () => {
    const wrapper = mountSelect({ modelValue: 'MX', allowEmpty: true })
    await flushPromises()
    const instance = dropDown(wrapper)
    instance.value = null
    instance.dataBind()
    await flushPromises()
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([null])
    wrapper.unmount()
  })

  it('shows the translated placeholder', async () => {
    const wrapper = mountSelect({ modelValue: null })
    await flushPromises()
    expect(document.body.querySelector('input.e-dropdownlist')?.getAttribute('placeholder')).toBe('Selecciona una opción')
    wrapper.unmount()
  })
})
```

The test drives the Syncfusion component through its `ej2Instances` (set `value`, then `dataBind()`), which fires the same `change` event a user selection fires.

- [ ] **Step 2: Run them to verify they fail**

Run: `npm --prefix web run test -- tests/composables tests/components/PageHeader.test.ts tests/components/CatalogSelect.test.ts`

Expected: FAIL with `Failed to resolve import` for `@/composables/useShelterTime`, `@/components/common/PageHeader.vue` and `@/components/common/CatalogSelect.vue`.

- [ ] **Step 3: Write the composable and the components**

`web/src/composables/useShelterTime.ts`:

```ts
import { formatDate, formatDateTime, formatTime, todayIn } from '@/lib/shelterTime'
import { useSettingsStore } from '@/stores/settings'

type DateInput = string | Date | null | undefined

// The lib/shelterTime helpers, bound to the shelter timezone from settings.
export function useShelterTime(): {
  formatDate(value: DateInput): string
  formatTime(value: DateInput): string
  formatDateTime(value: DateInput): string
  today(): string
} {
  const settings = useSettingsStore()
  return {
    formatDate: (value) => formatDate(value, settings.timezone),
    formatTime: (value) => formatTime(value, settings.timezone),
    formatDateTime: (value) => formatDateTime(value, settings.timezone),
    today: () => todayIn(settings.timezone),
  }
}
```

`web/src/components/common/PageHeader.vue`:

```vue
<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{ titleKey: string; titleParams?: Record<string, unknown> }>()

const { t } = useI18n()
</script>

<template>
  <header class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
    <h1 class="h3 mb-0">{{ t(titleKey, titleParams ?? {}) }}</h1>
    <div class="d-flex flex-wrap gap-2">
      <slot name="actions" />
    </div>
  </header>
</template>
```

`web/src/components/common/CatalogSelect.vue`:

```vue
<script setup lang="ts">
import { DropDownListComponent as EjsDropdownlist, type ChangeEventArgs } from '@syncfusion/ej2-vue-dropdowns'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCatalogsStore } from '@/stores/catalogs'
import type { CatalogName } from '@/types/domain'

const props = withDefaults(
  defineProps<{
    catalog: CatalogName
    modelValue: string | null
    placeholderKey?: string
    allowEmpty?: boolean
    id?: string
  }>(),
  { placeholderKey: 'common.select', allowEmpty: false, id: undefined },
)

const emit = defineEmits<{ 'update:modelValue': [value: string | null] }>()

const { t } = useI18n()
const catalogs = useCatalogsStore()

// Inactive values stay selectable on records that already use them.
const options = computed(() => catalogs.options(props.catalog, props.modelValue))

function onChange(args: ChangeEventArgs): void {
  const value = args.value === null || args.value === undefined ? null : String(args.value)
  if (value !== props.modelValue) emit('update:modelValue', value)
}
</script>

<template>
  <EjsDropdownlist
    :id="id"
    :data-source="options"
    :fields="{ text: 'text', value: 'value' }"
    :value="modelValue"
    :placeholder="t(placeholderKey)"
    :show-clear-button="allowEmpty"
    :allow-filtering="options.length > 15"
    filter-type="Contains"
    :ignore-accent="true"
    :change="onChange"
  />
</template>
```

- [ ] **Step 4: Run them to verify they pass**

Run: `npm --prefix web run test -- tests/composables tests/components/PageHeader.test.ts tests/components/CatalogSelect.test.ts`

Expected: `Test Files  3 passed (3)`, `Tests  8 passed (8)`.

- [ ] **Step 5: Run the whole unit suite, lint and typecheck**

Run: `npm --prefix web run test`, then `npm --prefix web run lint`, then `npm --prefix web run typecheck`

Expected: all unit tests pass; no lint or type errors.

- [ ] **Step 6: Commit**

```bash
git add web/src/composables/useShelterTime.ts web/src/components/common/PageHeader.vue web/src/components/common/CatalogSelect.vue web/tests/composables web/tests/components/PageHeader.test.ts web/tests/components/CatalogSelect.test.ts
git commit -m "feat(web): add shelter time composable, page header and catalog select"
```

---

### Task 10: Routes, guards, placeholder views and `mountWithApp`

**Files:**
- Create: `web/src/router/routes.ts`, `web/src/router/guards.ts`, `web/src/router/index.ts`
- Create: `web/src/views/LoginView.vue`, `web/src/views/ResetPasswordView.vue`, `web/src/views/PendingView.vue`, `web/src/views/ShiftView.vue` (placeholders until Tasks 12 and 13)
- Create: `web/src/views/ResidentsView.vue`, `web/src/views/PeopleSearchView.vue`, `web/src/views/PersonNewView.vue`, `web/src/views/PersonView.vue`, `web/src/views/admin/UsersView.vue`, `web/src/views/admin/CatalogsView.vue`, `web/src/views/admin/SettingsView.vue`, `web/src/views/admin/AuditView.vue`, `web/src/views/admin/MergeView.vue` (placeholders for Plan 3)
- Create: `web/tests/utils/mountWithApp.ts`
- Test: `web/tests/router/guards.test.ts`

**Interfaces:**
- Consumes: `useSessionStore` (Task 7); `PageHeader` (Task 9); `i18n`, `loadSyncfusionLocale` (Task 4); domain types (Task 3).
- Produces:
  - **`@/router/routes`:** `routes: RouteRecordRaw[]` with every route and meta from the contract, `/` redirecting to `residents`, unknown paths redirecting to `residents`, and the `RouteMeta` augmentation `{ public?: boolean; roles?: AppRole[]; layout?: 'blank' | 'app' }`. Views are lazy-loaded.
  - **`@/router/guards`:**
    - `authGuard(to: RouteLocationNormalized): Promise<true | RouteLocationRaw>`, in the contract's order: await `session.init()`; public route while signed in goes to `residents` (except `reset-password`); signed out goes to `login` with `?redirect=<fullPath>` (or `?error=oauth` when the URL carries an OAuth `error`); `pending` status goes to `pending`, and `pending` while ready goes to `residents`; a volunteer without an operator name goes to `shift` with `?redirect=<fullPath>`; a role not in `meta.roles` goes to `residents`.
    - `safeRedirect(value: unknown): string`: the value when it is a same-app path (`/x`, not `//x` or `/\x`), otherwise `/residents`.
  - **`@/router`:** `router` (web history, `routes`, `beforeEach(authGuard)`).
  - **Placeholder views:** each renders only `<PageHeader>` with these title keys: Residents `nav.residents`, PeopleSearch `nav.search`, PersonNew `nav.newPerson`, Person `common.personRecord`, admin Users `nav.users`, Catalogs `nav.catalogs`, Settings `nav.settings`, Audit `nav.audit`, Merge `nav.merge`; Login `auth.title`, ResetPassword `auth.newPasswordTitle`, Pending `auth.pendingTitle`, Shift `shift.title`.
  - **`tests/utils/mountWithApp.ts`:**
    - `mountWithApp<C>(component: C, options?: MountWithAppOptions): Promise<{ wrapper: VueWrapper; router: Router }>` with `MountWithAppOptions = { props?; initialRoute?; session?: Partial<{ role: AppRole | null; operatorName: string | null; status: string }>; catalogs?: Partial<Record<CatalogName, CatalogItem[]>>; timezone?: string }`.
    - Defaults: `initialRoute` `/residents`; `role` `'volunteer'`; `operatorName` `'Turno de prueba'`; `status` `'ready'` (or `'signedOut'` when `role` is `null`); `timezone` `'America/Mexico_City'`; catalogs `testCatalogs`.
    - It installs the real i18n, a testing Pinia with real actions (`stubActions: false`, so mock the `@/api/*` modules they call), and a memory-history router with the real route names, paths and meta but stubbed components (`stubbedRoutes`) and no guards. It loads the Syncfusion es-MX locale and mounts attached to `document.body`.
    - Also exports `fakeAppUser(role: AppRole, patch?: Partial<AppUser>): AppUser`, `testCatalogs: Record<CatalogName, CatalogItem[]>`, and `stubbedRoutes: RouteRecordRaw[]` (the real routes with every `component` replaced by an empty stub). The component under test is mounted directly and no `<RouterView>` renders, so the stubs change nothing visible; they keep navigation free of lazy imports, whose first Vite transform can exceed the 1 second default of `vi.waitFor` under parallel load. Any test that builds its own router for navigation should use `stubbedRoutes` too.

- [ ] **Step 1: Write `mountWithApp`**

The guard tests in Step 2 use `fakeAppUser` and `stubbedRoutes` from this file, and every later component test uses `mountWithApp`.

`web/tests/utils/mountWithApp.ts`:

```ts
import { createTestingPinia } from '@pinia/testing'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { vi } from 'vitest'
import { defineComponent, type Component } from 'vue'
import { createMemoryHistory, createRouter, type RouteRecordRaw, type Router } from 'vue-router'
import { i18n } from '@/i18n'
import { loadSyncfusionLocale } from '@/i18n/syncfusion'
import { routes } from '@/router/routes'
import type { AppRole, AppUser, CatalogItem, CatalogName } from '@/types/domain'

// The component under test is mounted directly; no <RouterView> renders route views.
// Stubbing them keeps navigation free of lazy imports, whose first Vite transform can
// exceed vi.waitFor's 1 s default under parallel load.
const RouteStub = defineComponent({ name: 'RouteStub', render: () => null })
export const stubbedRoutes = routes.map((route) =>
  'component' in route && route.component ? { ...route, component: RouteStub } : route,
) as RouteRecordRaw[]

// Fictitious data only.
export function fakeAppUser(role: AppRole, patch: Partial<AppUser> = {}): AppUser {
  return {
    email: `${role}@shelterbridge.test`,
    user_id: '00000000-0000-4000-8000-00000000a001',
    role,
    display_name: `Usuario de prueba (${role})`,
    active: true,
    created_at: '2026-10-07T12:00:00Z',
    created_by: null,
    updated_at: '2026-10-07T12:00:00Z',
    updated_by: null,
    ...patch,
  }
}

function catalogItem(code: string, es: string, sort_order: number): CatalogItem {
  return { code, labels: { es }, sort_order, active: true, updated_at: '2026-10-07T12:00:00Z' }
}

export const testCatalogs: Record<CatalogName, CatalogItem[]> = {
  countries: [catalogItem('MX', 'México', 1), catalogItem('HN', 'Honduras', 2), catalogItem('GT', 'Guatemala', 3)],
  case_types: [
    catalogItem('migrant_in_transit', 'Migrante en tránsito', 1),
    catalogItem('asylum_seeker', 'Solicitante de asilo', 2),
  ],
  genders: [catalogItem('female', 'Mujer', 1), catalogItem('male', 'Hombre', 2)],
}

export interface MountWithAppOptions {
  props?: Record<string, unknown>
  initialRoute?: string
  session?: Partial<{ role: AppRole | null; operatorName: string | null; status: string }>
  catalogs?: Partial<Record<CatalogName, CatalogItem[]>>
  timezone?: string
}

// Mounts a component with the real i18n, a memory-history router with the real
// route names, paths and meta (components stubbed, no guards), and a testing Pinia
// whose stores start from the given state. Store actions run for real, so mock
// the @/api modules they call.
export async function mountWithApp<C>(
  component: C,
  options: MountWithAppOptions = {},
): Promise<{ wrapper: VueWrapper; router: Router }> {
  const role = options.session?.role === undefined ? 'volunteer' : options.session.role
  const operatorName =
    options.session?.operatorName === undefined ? 'Turno de prueba' : options.session.operatorName
  const status = options.session?.status ?? (role === null ? 'signedOut' : 'ready')

  const pinia = createTestingPinia({
    createSpy: vi.fn,
    stubActions: false,
    initialState: {
      session: {
        status,
        session: null,
        appUser: role === null ? null : fakeAppUser(role),
        operatorName,
      },
      catalogs: { items: { ...testCatalogs, ...options.catalogs }, loaded: true },
      settings: {
        timezone: options.timezone ?? 'America/Mexico_City',
        timezoneUpdatedAt: '2026-10-07T12:00:00Z',
        loaded: true,
      },
    },
  })

  const router = createRouter({ history: createMemoryHistory(), routes: stubbedRoutes })
  await router.push(options.initialRoute ?? '/residents')
  await router.isReady()
  await loadSyncfusionLocale('es-MX')

  const wrapper = mount(component as Component, {
    props: options.props,
    attachTo: document.body,
    global: { plugins: [i18n, pinia, router] },
  }) as VueWrapper
  await flushPromises()
  return { wrapper, router }
}
```

Tests that use it should clear `document.body.innerHTML` in `afterEach`, because it attaches to the body (Syncfusion popups render there).

- [ ] **Step 2: Write the failing guard tests**

`web/tests/router/guards.test.ts`:

```ts
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { authGuard, safeRedirect } from '@/router/guards'
import { useSessionStore } from '@/stores/session'
import type { AppRole } from '@/types/domain'
import { fakeAppUser, stubbedRoutes } from '../utils/mountWithApp'

vi.mock('@/api/auth')

type Status = 'signedOut' | 'pending' | 'ready'

function setup(status: Status, role: AppRole | null = null, operatorName: string | null = null) {
  setActivePinia(
    createTestingPinia({
      createSpy: vi.fn,
      stubActions: ['init'],
      initialState: {
        session: { status, appUser: role ? fakeAppUser(role) : null, operatorName },
      },
    }),
  )
  const router = createRouter({ history: createMemoryHistory(), routes: stubbedRoutes })
  router.beforeEach(authGuard)
  return router
}

async function land(router: ReturnType<typeof setup>, path: string) {
  await router.push(path)
  return router.currentRoute.value
}

describe('authGuard', () => {
  it('waits for the session to initialize', async () => {
    const router = setup('signedOut')
    await land(router, '/login')
    expect(useSessionStore().init).toHaveBeenCalled()
  })

  it('sends a signed-out user to login with the original path', async () => {
    const route = await land(setup('signedOut'), '/people/00000000-0000-4000-8000-000000000001')
    expect(route.name).toBe('login')
    expect(route.query.redirect).toBe('/people/00000000-0000-4000-8000-000000000001')
  })

  it('lets a signed-out user open the public pages', async () => {
    expect((await land(setup('signedOut'), '/login')).name).toBe('login')
    expect((await land(setup('signedOut'), '/reset-password')).name).toBe('reset-password')
  })

  it('sends a failed Google sign-in back to login with an error flag', async () => {
    const route = await land(setup('signedOut'), '/residents?error=access_denied&error_description=Not+invited')
    expect(route.name).toBe('login')
    expect(route.query).toEqual({ error: 'oauth' })
  })

  it('sends a signed-in user away from login', async () => {
    expect((await land(setup('ready', 'admin'), '/login')).name).toBe('residents')
  })

  it('keeps reset-password open for the signed-in recovery session', async () => {
    expect((await land(setup('ready', 'legal'), '/reset-password')).name).toBe('reset-password')
  })

  it('sends a user without an active role to pending, and only there', async () => {
    expect((await land(setup('pending'), '/residents')).name).toBe('pending')
    expect((await land(setup('pending'), '/admin/users')).name).toBe('pending')
    expect((await land(setup('pending'), '/pending')).name).toBe('pending')
  })

  it('sends a ready user away from pending', async () => {
    expect((await land(setup('ready', 'legal'), '/pending')).name).toBe('residents')
  })

  it('asks a volunteer for the operator name first', async () => {
    const route = await land(setup('ready', 'volunteer'), '/people/search')
    expect(route.name).toBe('shift')
    expect(route.query.redirect).toBe('/people/search')
  })

  it('lets a volunteer with an operator name through', async () => {
    expect((await land(setup('ready', 'volunteer', 'Ana'), '/people/search')).name).toBe('people-search')
  })

  it('lets a volunteer change the operator name on the shift page', async () => {
    expect((await land(setup('ready', 'volunteer', 'Ana'), '/shift')).name).toBe('shift')
  })

  it('keeps other roles off the shift page', async () => {
    expect((await land(setup('ready', 'psychology'), '/shift')).name).toBe('residents')
  })

  it('keeps non-admins out of admin pages', async () => {
    expect((await land(setup('ready', 'volunteer', 'Ana'), '/admin/users')).name).toBe('residents')
    expect((await land(setup('ready', 'legal'), '/admin/audit')).name).toBe('residents')
  })

  it('lets an admin into admin pages', async () => {
    expect((await land(setup('ready', 'admin'), '/admin/merge')).name).toBe('admin-merge')
  })

  it('redirects / and unknown paths to residents', async () => {
    expect((await land(setup('ready', 'admin'), '/')).name).toBe('residents')
    expect((await land(setup('ready', 'admin'), '/no/such/page')).name).toBe('residents')
  })
})

describe('safeRedirect', () => {
  it('accepts app paths and rejects anything else', () => {
    expect(safeRedirect('/people/search')).toBe('/people/search')
    expect(safeRedirect('//evil.example/x')).toBe('/residents')
    expect(safeRedirect('/\\evil.example')).toBe('/residents')
    expect(safeRedirect('https://evil.example')).toBe('/residents')
    expect(safeRedirect(undefined)).toBe('/residents')
    expect(safeRedirect(['/a'])).toBe('/residents')
  })
})
```

A deactivated user is `pending` in the store (Task 7), so the `pending` cases also cover deactivation. The guard tests navigate over `stubbedRoutes`: the same names, paths, meta and redirects as the app, without loading the view files.

- [ ] **Step 3: Run them to verify they fail**

Run: `npm --prefix web run test -- tests/router`

Expected: FAIL with `Failed to resolve import` for `@/router/guards` (from the test) or `@/router/routes` (from `mountWithApp.ts`).

- [ ] **Step 4: Create the placeholder views**

Each of these files has the same shape; only the title key differs. `web/src/views/ResidentsView.vue`:

```vue
<script setup lang="ts">
import PageHeader from '@/components/common/PageHeader.vue'
</script>

<template>
  <PageHeader title-key="nav.residents" />
</template>
```

Create the other twelve with the same content and these `title-key` values:

| File | `title-key` |
|---|---|
| `web/src/views/PeopleSearchView.vue` | `nav.search` |
| `web/src/views/PersonNewView.vue` | `nav.newPerson` |
| `web/src/views/PersonView.vue` | `common.personRecord` |
| `web/src/views/admin/UsersView.vue` | `nav.users` |
| `web/src/views/admin/CatalogsView.vue` | `nav.catalogs` |
| `web/src/views/admin/SettingsView.vue` | `nav.settings` |
| `web/src/views/admin/AuditView.vue` | `nav.audit` |
| `web/src/views/admin/MergeView.vue` | `nav.merge` |
| `web/src/views/LoginView.vue` | `auth.title` |
| `web/src/views/ResetPasswordView.vue` | `auth.newPasswordTitle` |
| `web/src/views/PendingView.vue` | `auth.pendingTitle` |
| `web/src/views/ShiftView.vue` | `shift.title` |

- [ ] **Step 5: Write the routes, the guard and the router**

`web/src/router/routes.ts`:

```ts
import type { RouteRecordRaw } from 'vue-router'
import type { AppRole } from '@/types/domain'

declare module 'vue-router' {
  interface RouteMeta {
    public?: boolean
    roles?: AppRole[]
    layout?: 'blank' | 'app'
  }
}

export const routes: RouteRecordRaw[] = [
  { path: '/', redirect: { name: 'residents' } },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { public: true, layout: 'blank' },
  },
  {
    path: '/reset-password',
    name: 'reset-password',
    component: () => import('@/views/ResetPasswordView.vue'),
    meta: { public: true, layout: 'blank' },
  },
  {
    path: '/pending',
    name: 'pending',
    component: () => import('@/views/PendingView.vue'),
    meta: { layout: 'blank' },
  },
  {
    path: '/shift',
    name: 'shift',
    component: () => import('@/views/ShiftView.vue'),
    meta: { roles: ['volunteer'], layout: 'blank' },
  },
  {
    path: '/residents',
    name: 'residents',
    component: () => import('@/views/ResidentsView.vue'),
    meta: { layout: 'app' },
  },
  {
    path: '/people/search',
    name: 'people-search',
    component: () => import('@/views/PeopleSearchView.vue'),
    meta: { layout: 'app' },
  },
  {
    path: '/people/new',
    name: 'person-new',
    component: () => import('@/views/PersonNewView.vue'),
    meta: { layout: 'app' },
  },
  {
    path: '/people/:id',
    name: 'person',
    component: () => import('@/views/PersonView.vue'),
    meta: { layout: 'app' },
  },
  {
    path: '/admin/users',
    name: 'admin-users',
    component: () => import('@/views/admin/UsersView.vue'),
    meta: { roles: ['admin'], layout: 'app' },
  },
  {
    path: '/admin/catalogs',
    name: 'admin-catalogs',
    component: () => import('@/views/admin/CatalogsView.vue'),
    meta: { roles: ['admin'], layout: 'app' },
  },
  {
    path: '/admin/settings',
    name: 'admin-settings',
    component: () => import('@/views/admin/SettingsView.vue'),
    meta: { roles: ['admin'], layout: 'app' },
  },
  {
    path: '/admin/audit',
    name: 'admin-audit',
    component: () => import('@/views/admin/AuditView.vue'),
    meta: { roles: ['admin'], layout: 'app' },
  },
  {
    path: '/admin/merge',
    name: 'admin-merge',
    component: () => import('@/views/admin/MergeView.vue'),
    meta: { roles: ['admin'], layout: 'app' },
  },
  { path: '/:pathMatch(.*)*', redirect: { name: 'residents' } },
]
```

`web/src/router/guards.ts`:

```ts
import type { RouteLocationNormalized, RouteLocationRaw } from 'vue-router'
import { useSessionStore } from '@/stores/session'

// Only same-app paths are accepted as a redirect target. Browsers treat "/\" like "//".
export function safeRedirect(value: unknown): string {
  return typeof value === 'string' && /^\/(?![\\/])/.test(value) ? value : '/residents'
}

function isOAuthErrorReturn(to: RouteLocationNormalized): boolean {
  return typeof to.query.error === 'string' || /(^#|&)error=/.test(to.hash)
}

// UX only: Postgres RLS is the real authorization.
export async function authGuard(to: RouteLocationNormalized): Promise<true | RouteLocationRaw> {
  const session = useSessionStore()
  await session.init()

  if (to.meta.public) {
    // The recovery link signs the user in, so reset-password stays reachable.
    if (session.status !== 'signedOut' && to.name !== 'reset-password') return { name: 'residents' }
    return true
  }

  if (session.status === 'signedOut') {
    if (isOAuthErrorReturn(to)) return { name: 'login', query: { error: 'oauth' } }
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (session.status === 'pending') return to.name === 'pending' ? true : { name: 'pending' }
  if (to.name === 'pending') return { name: 'residents' }

  if (session.needsOperatorName && to.name !== 'shift') {
    return { name: 'shift', query: { redirect: to.fullPath } }
  }

  const roles = to.meta.roles
  if (roles && (session.role === null || !roles.includes(session.role))) return { name: 'residents' }

  return true
}
```

When Google sign-in is refused (for example the email is not invited), Supabase redirects back to `/residents` with `error`, `error_code` and `error_description` in the query and the hash. The guard drops that English text and sends the user to `login?error=oauth`, which shows a Spanish message (Task 12).

`web/src/router/index.ts`:

```ts
import { createRouter, createWebHistory } from 'vue-router'
import { authGuard } from './guards'
import { routes } from './routes'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.beforeEach(authGuard)
```

- [ ] **Step 6: Run them to verify they pass**

Run: `npm --prefix web run test -- tests/router`

Expected: `Tests  16 passed (16)`.

- [ ] **Step 7: Run the whole unit suite, lint and typecheck**

Run: `npm --prefix web run test`, then `npm --prefix web run lint`, then `npm --prefix web run typecheck`

Expected: all pass with no errors.

- [ ] **Step 8: Commit**

```bash
git add web/src/router web/src/views web/tests/utils/mountWithApp.ts web/tests/router
git commit -m "feat(web): add routes, role and status guard, placeholder views and mountWithApp"
```

---

### Task 11: App layout and bootstrap

**Files:**
- Create: `web/src/components/layout/OfflineBanner.vue`, `web/src/components/layout/AppNavbar.vue`, `web/src/components/layout/AppShell.vue`
- Modify: `web/src/App.vue` (replace), `web/src/main.ts`
- Test: `web/tests/components/layout.test.ts`

**Interfaces:**
- Consumes: `useSessionStore`, `useCatalogsStore`, `useSettingsStore` (Task 7); `useNotify`, `useOnline`, `ToastHost`, `ConfirmHost` (Task 8); `routes`, `router` (Task 10); `mountWithApp`, `fakeAppUser` (Task 10).
- Produces:
  - **`OfflineBanner.vue`:** a warning bar with `common.offline` ("Sin conexión") and `common.offlineHint`, shown while `useOnline().online` is false.
  - **`AppNavbar.vue`:** brand link to `residents`; links Residentes, Buscar, Registrar persona; for admins only, an "Administración" dropdown (Vue-controlled) with Usuarios, Catálogos, Configuración, Bitácora de cambios, Unir duplicados; the operator name (`data-testid="operator-name"`, text "De turno: {name}") when set; a "Cambiar turno" link to `shift` for the volunteer role; a "Cerrar sesión" button that calls `session.signOut()` and goes to `login`. Menus close on navigation. Below the `lg` breakpoint the links collapse behind a toggler.
  - **`AppShell.vue`:** navbar plus a `<main>` with a default slot; on mount it loads the catalogs and, if not loaded yet, the settings, and reports a failure through `useNotify().error`.
  - **`App.vue`:** `OfflineBanner` on every page; `AppShell` around the `RouterView` when `route.meta.layout === 'app'`, otherwise a centered `<main class="container">`; `ToastHost` and `ConfirmHost` mounted once.
  - **`main.ts`:** creates Pinia, installs i18n, starts `useSessionStore(pinia).init()`, then installs the router and mounts.

- [ ] **Step 1: Write the failing tests**

`web/tests/components/layout.test.ts`:

```ts
import { createTestingPinia } from '@pinia/testing'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import * as auth from '@/api/auth'
import App from '@/App.vue'
import AppNavbar from '@/components/layout/AppNavbar.vue'
import AppShell from '@/components/layout/AppShell.vue'
import OfflineBanner from '@/components/layout/OfflineBanner.vue'
import { i18n } from '@/i18n'
import { routes } from '@/router/routes'
import { useCatalogsStore } from '@/stores/catalogs'
import { useSessionStore } from '@/stores/session'
import { fakeAppUser, mountWithApp } from '../utils/mountWithApp'

vi.mock('@/api/auth')
vi.mock('@/api/catalogs')
vi.mock('@/api/settings')

afterEach(() => {
  document.body.innerHTML = ''
  vi.resetAllMocks()
})

function linkTexts(): string[] {
  return Array.from(document.body.querySelectorAll('a')).map((a) => a.textContent?.trim() ?? '')
}

describe('AppNavbar', () => {
  it('shows the admin menu to an admin', async () => {
    const { wrapper } = await mountWithApp(AppNavbar, { session: { role: 'admin', operatorName: null } })
    expect(wrapper.text()).toContain('Administración')
    expect(linkTexts()).toEqual(expect.arrayContaining(['Usuarios', 'Catálogos', 'Configuración', 'Bitácora de cambios', 'Unir duplicados']))
  })

  it('hides the admin menu from a volunteer', async () => {
    const { wrapper } = await mountWithApp(AppNavbar, { session: { role: 'volunteer' } })
    expect(wrapper.text()).not.toContain('Administración')
    expect(linkTexts()).not.toContain('Usuarios')
    expect(linkTexts()).toEqual(expect.arrayContaining(['Residentes', 'Buscar', 'Registrar persona']))
  })

  it('shows the operator on shift and a way to change it to a volunteer', async () => {
    const { wrapper } = await mountWithApp(AppNavbar, { session: { role: 'volunteer', operatorName: 'Ana y Luis' } })
    expect(wrapper.get('[data-testid="operator-name"]').text()).toBe('De turno: Ana y Luis')
    expect(linkTexts()).toContain('Cambiar turno')
  })

  it('shows no shift controls to other roles', async () => {
    const { wrapper } = await mountWithApp(AppNavbar, { session: { role: 'legal', operatorName: null } })
    expect(wrapper.find('[data-testid="operator-name"]').exists()).toBe(false)
    expect(linkTexts()).not.toContain('Cambiar turno')
  })

  it('signs out and goes to login', async () => {
    vi.mocked(auth.signOut).mockResolvedValue()
    const { wrapper, router } = await mountWithApp(AppNavbar, { session: { role: 'volunteer', operatorName: 'Ana' } })
    await wrapper.get('button.btn-outline-danger').trigger('click')
    await flushPromises()
    expect(auth.signOut).toHaveBeenCalled()
    expect(useSessionStore().operatorName).toBeNull()
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('login'))
  })
})

describe('OfflineBanner', () => {
  it('shows "Sin conexión" while the browser is offline', async () => {
    const { wrapper } = await mountWithApp(OfflineBanner)
    expect(wrapper.text()).not.toContain('Sin conexión')
    window.dispatchEvent(new Event('offline'))
    await flushPromises()
    expect(wrapper.text()).toContain('Sin conexión')
    window.dispatchEvent(new Event('online'))
    await flushPromises()
    expect(wrapper.text()).not.toContain('Sin conexión')
  })
})

describe('AppShell', () => {
  it('loads the catalogs when it mounts', async () => {
    await mountWithApp(AppShell)
    expect(useCatalogsStore().load).toHaveBeenCalled()
  })
})

describe('App', () => {
  // Test pages stand in for the feature views, which Plan 3 replaces.
  const testRoutes = [
    { path: '/test-app', component: defineComponent({ render: () => h('h1', 'Página de prueba') }), meta: { layout: 'app' as const } },
    { path: '/test-blank', component: defineComponent({ render: () => h('h1', 'Página sin menú') }), meta: { layout: 'blank' as const } },
  ]

  async function mountApp(path: string) {
    const router = createRouter({ history: createMemoryHistory(), routes: [...routes, ...testRoutes] })
    await router.push(path)
    await router.isReady()
    const pinia = createTestingPinia({
      createSpy: vi.fn,
      stubActions: false,
      initialState: {
        session: { status: 'ready', appUser: fakeAppUser('legal'), operatorName: null },
        catalogs: { loaded: true },
        settings: { loaded: true },
      },
    })
    const wrapper = mount(App, { attachTo: document.body, global: { plugins: [i18n, pinia, router] } })
    await flushPromises()
    return wrapper
  }

  it('wraps app pages in the shell with the navbar', async () => {
    const wrapper = await mountApp('/test-app')
    expect(wrapper.find('nav.navbar').exists()).toBe(true)
    expect(wrapper.get('main h1').text()).toBe('Página de prueba')
  })

  it('shows blank pages without the navbar', async () => {
    const wrapper = await mountApp('/test-blank')
    expect(wrapper.find('nav.navbar').exists()).toBe(false)
    expect(wrapper.get('main h1').text()).toBe('Página sin menú')
  })
})
```

The two `App` tests use stand-in pages instead of the real views, so they keep passing when Plan 3 replaces the placeholders with screens that load data.

- [ ] **Step 2: Run them to verify they fail**

Run: `npm --prefix web run test -- tests/components/layout.test.ts`

Expected: FAIL with `Failed to resolve import "@/components/layout/AppNavbar.vue"`.

- [ ] **Step 3: Write the layout components**

`web/src/components/layout/OfflineBanner.vue`:

```vue
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useOnline } from '@/composables/useOnline'

const { t } = useI18n()
const { online } = useOnline()
</script>

<template>
  <div v-if="!online" class="alert alert-warning rounded-0 mb-0 py-2 text-center" role="status">
    <strong>{{ t('common.offline') }}.</strong>
    {{ t('common.offlineHint') }}
  </div>
</template>
```

`web/src/components/layout/AppNavbar.vue`:

```vue
<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useNotify } from '@/composables/useNotify'
import { useSessionStore } from '@/stores/session'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const notify = useNotify()

const menuOpen = ref(false)
const adminOpen = ref(false)

const mainLinks = [
  { name: 'residents', key: 'nav.residents' },
  { name: 'people-search', key: 'nav.search' },
  { name: 'person-new', key: 'nav.newPerson' },
] as const

const adminLinks = [
  { name: 'admin-users', key: 'nav.users' },
  { name: 'admin-catalogs', key: 'nav.catalogs' },
  { name: 'admin-settings', key: 'nav.settings' },
  { name: 'admin-audit', key: 'nav.audit' },
  { name: 'admin-merge', key: 'nav.merge' },
] as const

watch(
  () => route.fullPath,
  () => {
    menuOpen.value = false
    adminOpen.value = false
  },
)

async function signOut(): Promise<void> {
  try {
    await session.signOut()
  } catch (error) {
    notify.error(error)
  }
  await router.replace({ name: 'login' })
}
</script>

<template>
  <nav class="navbar navbar-expand-lg bg-body-tertiary border-bottom">
    <div class="container-fluid">
      <RouterLink class="navbar-brand fw-semibold" :to="{ name: 'residents' }">{{ t('common.appName') }}</RouterLink>
      <button
        class="navbar-toggler"
        type="button"
        :aria-label="t('nav.menu')"
        :aria-expanded="menuOpen"
        aria-controls="app-navbar-menu"
        @click="menuOpen = !menuOpen"
      >
        <span class="navbar-toggler-icon" />
      </button>
      <div id="app-navbar-menu" class="collapse navbar-collapse" :class="{ show: menuOpen }">
        <ul class="navbar-nav me-auto">
          <li v-for="link in mainLinks" :key="link.name" class="nav-item">
            <RouterLink class="nav-link" active-class="active" :to="{ name: link.name }">{{ t(link.key) }}</RouterLink>
          </li>
          <li v-if="session.isAdmin" class="nav-item dropdown">
            <button
              class="nav-link dropdown-toggle"
              type="button"
              :aria-expanded="adminOpen"
              @click="adminOpen = !adminOpen"
            >
              {{ t('nav.admin') }}
            </button>
            <ul class="dropdown-menu" :class="{ show: adminOpen }" data-bs-popper="static">
              <li v-for="link in adminLinks" :key="link.name">
                <RouterLink class="dropdown-item" active-class="active" :to="{ name: link.name }">{{ t(link.key) }}</RouterLink>
              </li>
            </ul>
          </li>
        </ul>
        <div class="d-flex flex-column flex-lg-row align-items-lg-center gap-2">
          <span v-if="session.operatorName" class="navbar-text" data-testid="operator-name">
            {{ t('nav.onShift', { name: session.operatorName }) }}
          </span>
          <RouterLink v-if="session.role === 'volunteer'" class="btn btn-sm btn-outline-secondary" :to="{ name: 'shift' }">
            {{ t('nav.changeShift') }}
          </RouterLink>
          <button type="button" class="btn btn-sm btn-outline-danger" @click="signOut">{{ t('nav.signOut') }}</button>
        </div>
      </div>
    </div>
  </nav>
</template>
```

`data-bs-popper="static"` makes Bootstrap's CSS place the dropdown under its toggle without Bootstrap's JavaScript.

`web/src/components/layout/AppShell.vue`:

```vue
<script setup lang="ts">
import { onMounted } from 'vue'
import AppNavbar from './AppNavbar.vue'
import { useNotify } from '@/composables/useNotify'
import { useCatalogsStore } from '@/stores/catalogs'
import { useSettingsStore } from '@/stores/settings'

const catalogs = useCatalogsStore()
const settings = useSettingsStore()
const notify = useNotify()

// Every app page needs the catalogs and the shelter timezone.
onMounted(async () => {
  try {
    await Promise.all([catalogs.load(), settings.loaded ? Promise.resolve() : settings.load()])
  } catch (error) {
    notify.error(error)
  }
})
</script>

<template>
  <div class="min-vh-100 d-flex flex-column">
    <AppNavbar />
    <main class="container-fluid py-3 flex-grow-1">
      <slot />
    </main>
  </div>
</template>
```

Replace `web/src/App.vue` with:

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import ConfirmHost from '@/components/common/ConfirmHost.vue'
import ToastHost from '@/components/common/ToastHost.vue'
import AppShell from '@/components/layout/AppShell.vue'
import OfflineBanner from '@/components/layout/OfflineBanner.vue'

const route = useRoute()
const layout = computed(() => route.meta.layout ?? 'blank')
</script>

<template>
  <OfflineBanner />
  <AppShell v-if="layout === 'app'">
    <RouterView />
  </AppShell>
  <main v-else class="container py-4 py-md-5">
    <RouterView />
  </main>
  <ToastHost />
  <ConfirmHost />
</template>
```

- [ ] **Step 4: Run them to verify they pass**

Run: `npm --prefix web run test -- tests/components/layout.test.ts`

Expected: `Tests  9 passed (9)`.

- [ ] **Step 5: Wire Pinia, the router and the session into `main.ts`**

In `web/src/main.ts`, keep the CSS imports at the top and replace everything from `import { registerLicense }` to the end with:

```ts
import { registerLicense } from '@syncfusion/ej2-base'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import { i18n, setLocale } from './i18n'
import { router } from './router'
import { useSessionStore } from './stores/session'

async function bootstrap(): Promise<void> {
  const licenseKey = import.meta.env.VITE_SYNCFUSION_LICENSE_KEY
  if (licenseKey) registerLicense(licenseKey)

  await setLocale('es-MX')

  const app = createApp(App)
  const pinia = createPinia()
  app.use(pinia)
  app.use(i18n)
  // Starts reading the stored session (and any sign-in link in the URL) right away.
  void useSessionStore(pinia).init()
  app.use(router)
  app.mount('#app')
}

void bootstrap()
```

- [ ] **Step 6: Run the checks and look at the app**

Run: `npm --prefix web run test`, then `npm --prefix web run lint`, then `npm --prefix web run typecheck`, then `npm --prefix web run build`

Expected: all pass; the build ends with `built in`.

Run: `npm run web:dev` and open http://localhost:5173 in a browser.

Expected: the address changes to `/login?redirect=/residents` and the page shows the heading "Entrar a ShelterBridge" (still the placeholder). Without a Syncfusion license key a Syncfusion banner appears at the top; it has a close button. The browser console shows no errors. Stop the server with Ctrl+C.

- [ ] **Step 7: Commit**

```bash
git add web/src/components/layout web/src/App.vue web/src/main.ts web/tests/components/layout.test.ts
git commit -m "feat(web): add app shell, navbar with role-based links and offline banner"
```

---

### Task 12: Login and password reset views

**Files:**
- Modify (replace placeholder): `web/src/views/LoginView.vue`, `web/src/views/ResetPasswordView.vue`
- Test: `web/tests/views/LoginView.test.ts`, `web/tests/views/ResetPasswordView.test.ts`

**Interfaces:**
- Consumes: `signInWithPassword`, `signInWithGoogle`, `signUp`, `requestPasswordReset`, `updatePassword` (Task 5); `toApiError` (Task 3); `cleanText` (Task 2); `safeRedirect` (Task 10); `useSessionStore` (Task 7); `useNotify` (Task 8); `mountWithApp`, `fakeAppUser` (Task 10).
- Produces:
  - **`LoginView.vue`** with three modes on one card:
    - sign in: "Entrar con Google" button, then email (`#login-email`) and password (`#login-password`) with "Entrar". On success it calls `session.refreshAppUser()` and goes to `safeRedirect(route.query.redirect)`; the guard then sends volunteers to the shift page.
    - first password ("¿Es tu primera vez? Crea tu contraseña"): email, password, repeat (`#login-confirm`); at least 8 characters; on success shows `auth.signUpSent`.
    - forgot password: email only; on success shows `auth.resetSent`.
    - Errors show in `[data-testid="login-error"]` from `errors.<code>` or `validation.*`; info in `[data-testid="login-info"]`. `?error=oauth` shows `auth.googleFailed` on load. What was typed stays after a failure.
  - **`ResetPasswordView.vue`:** with a session (the recovery link signs the user in), a form with `#reset-password` and `#reset-confirm` (at least 8 characters, must match) that calls `updatePassword`, shows the `auth.passwordSaved` toast, refreshes the session and goes to `residents`. Errors show in `[data-testid="reset-error"]`. Signed out, it shows `auth.resetLinkInvalid` in `[data-testid="reset-invalid"]` and a link back to login.

- [ ] **Step 1: Write the failing tests**

`web/tests/views/LoginView.test.ts`:

```ts
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as auth from '@/api/auth'
import { ApiError } from '@/api/errors'
import { useSessionStore } from '@/stores/session'
import LoginView from '@/views/LoginView.vue'
import { fakeAppUser, mountWithApp } from '../utils/mountWithApp'

vi.mock('@/api/auth')

afterEach(() => {
  document.body.innerHTML = ''
  vi.resetAllMocks()
})

function mockSuccessfulSignIn(): void {
  vi.mocked(auth.signInWithPassword).mockResolvedValue()
  vi.mocked(auth.getSession).mockResolvedValue({ user: { id: 'user-1' } } as unknown as auth.Session)
  vi.mocked(auth.getMyAppUser).mockResolvedValue(fakeAppUser('volunteer'))
}

async function mountLogin(initialRoute = '/login') {
  return mountWithApp(LoginView, { initialRoute, session: { role: null } })
}

function buttonByText(wrapper: Awaited<ReturnType<typeof mountLogin>>['wrapper'], text: string) {
  const button = wrapper.findAll('button').find((b) => b.text() === text)
  if (!button) throw new Error(`No button "${text}"`)
  return button
}

describe('LoginView', () => {
  it('signs in with email and password and follows the redirect', async () => {
    mockSuccessfulSignIn()
    const { wrapper, router } = await mountLogin('/login?redirect=/people/search')
    await wrapper.get('#login-email').setValue('  volunteer@shelterbridge.test ')
    await wrapper.get('#login-password').setValue('shelterbridge-dev')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(auth.signInWithPassword).toHaveBeenCalledWith('volunteer@shelterbridge.test', 'shelterbridge-dev')
    expect(useSessionStore().refreshAppUser).toHaveBeenCalled()
    await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/people/search'))
  })

  it('ignores a redirect to another site', async () => {
    mockSuccessfulSignIn()
    const { wrapper, router } = await mountLogin('/login?redirect=//evil.example')
    await wrapper.get('#login-email').setValue('admin@shelterbridge.test')
    await wrapper.get('#login-password').setValue('shelterbridge-dev')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('residents'))
  })

  it.each([
    ['invalid_credentials', 'El correo o la contraseña no son correctos.'],
    ['email_not_confirmed', 'Todavía no confirmas tu correo. Busca el mensaje que te enviamos y sigue el enlace.'],
    ['network', 'Sin conexión. Revisa el internet e inténtalo de nuevo.'],
  ] as const)('shows the Spanish message for %s', async (code, message) => {
    vi.mocked(auth.signInWithPassword).mockRejectedValue(new ApiError(code))
    const { wrapper } = await mountLogin()
    await wrapper.get('#login-email').setValue('admin@shelterbridge.test')
    await wrapper.get('#login-password').setValue('wrong-password')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.get('[data-testid="login-error"]').text()).toBe(message)
  })

  it('keeps what was typed after a failure', async () => {
    vi.mocked(auth.signInWithPassword).mockRejectedValue(new ApiError('invalid_credentials'))
    const { wrapper } = await mountLogin()
    await wrapper.get('#login-email').setValue('admin@shelterbridge.test')
    await wrapper.get('#login-password').setValue('wrong-password')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect((wrapper.get('#login-email').element as HTMLInputElement).value).toBe('admin@shelterbridge.test')
  })

  it('requires an email before calling Supabase', async () => {
    const { wrapper } = await mountLogin()
    await wrapper.get('#login-email').setValue('   ')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(auth.signInWithPassword).not.toHaveBeenCalled()
    expect(wrapper.get('[data-testid="login-error"]').text()).toBe('Este dato es obligatorio.')
  })

  it('starts Google sign-in', async () => {
    vi.mocked(auth.signInWithGoogle).mockResolvedValue()
    const { wrapper } = await mountLogin()
    await buttonByText(wrapper, 'Entrar con Google').trigger('click')
    expect(auth.signInWithGoogle).toHaveBeenCalled()
  })

  it('explains a failed Google sign-in', async () => {
    const { wrapper } = await mountLogin('/login?error=oauth')
    expect(wrapper.get('[data-testid="login-error"]').text()).toContain('No se pudo entrar con Google')
  })

  it('creates a first password and asks to confirm the email', async () => {
    vi.mocked(auth.signUp).mockResolvedValue()
    const { wrapper } = await mountLogin()
    await buttonByText(wrapper, '¿Es tu primera vez? Crea tu contraseña').trigger('click')
    await wrapper.get('#login-email').setValue('legal@shelterbridge.test')
    await wrapper.get('#login-password').setValue('una-clave-larga')
    await wrapper.get('#login-confirm').setValue('una-clave-larga')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(auth.signUp).toHaveBeenCalledWith('legal@shelterbridge.test', 'una-clave-larga')
    expect(wrapper.get('[data-testid="login-info"]').text()).toContain('Te enviamos un correo')
  })

  it('tells an uninvited person to ask for access', async () => {
    vi.mocked(auth.signUp).mockRejectedValue(new ApiError('not_invited'))
    const { wrapper } = await mountLogin()
    await buttonByText(wrapper, '¿Es tu primera vez? Crea tu contraseña').trigger('click')
    await wrapper.get('#login-email').setValue('stranger@example.test')
    await wrapper.get('#login-password').setValue('una-clave-larga')
    await wrapper.get('#login-confirm').setValue('una-clave-larga')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.get('[data-testid="login-error"]').text()).toBe(
      'Este correo no tiene invitación a ShelterBridge. Pide acceso a una persona de administración.',
    )
  })

  it('checks the new password length and confirmation', async () => {
    const { wrapper } = await mountLogin()
    await buttonByText(wrapper, '¿Es tu primera vez? Crea tu contraseña').trigger('click')
    await wrapper.get('#login-email').setValue('legal@shelterbridge.test')
    await wrapper.get('#login-password').setValue('corta')
    await wrapper.get('#login-confirm').setValue('corta')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.get('[data-testid="login-error"]').text()).toBe('La contraseña debe tener al menos 8 caracteres.')
    await wrapper.get('#login-password').setValue('una-clave-larga')
    await wrapper.get('#login-confirm').setValue('otra-clave-larga')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.get('[data-testid="login-error"]').text()).toBe('Las contraseñas no coinciden.')
    expect(auth.signUp).not.toHaveBeenCalled()
  })

  it('sends a password reset link', async () => {
    vi.mocked(auth.requestPasswordReset).mockResolvedValue()
    const { wrapper } = await mountLogin()
    await buttonByText(wrapper, '¿Olvidaste tu contraseña?').trigger('click')
    expect(wrapper.find('#login-password').exists()).toBe(false)
    await wrapper.get('#login-email').setValue('psychology@shelterbridge.test')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(auth.requestPasswordReset).toHaveBeenCalledWith('psychology@shelterbridge.test')
    expect(wrapper.get('[data-testid="login-info"]').text()).toContain('te llegará un enlace')
  })
})
```

`web/tests/views/ResetPasswordView.test.ts`:

```ts
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as auth from '@/api/auth'
import { ApiError } from '@/api/errors'
import { pendingNotifications } from '@/composables/useNotify'
import ResetPasswordView from '@/views/ResetPasswordView.vue'
import { fakeAppUser, mountWithApp } from '../utils/mountWithApp'

vi.mock('@/api/auth')

afterEach(() => {
  document.body.innerHTML = ''
  pendingNotifications.value.splice(0)
  sessionStorage.clear()
  vi.resetAllMocks()
})

describe('ResetPasswordView', () => {
  it('saves the new password and goes to residents', async () => {
    vi.mocked(auth.updatePassword).mockResolvedValue()
    vi.mocked(auth.getSession).mockResolvedValue({ user: { id: 'user-1' } } as unknown as auth.Session)
    vi.mocked(auth.getMyAppUser).mockResolvedValue(fakeAppUser('admin'))
    const { wrapper, router } = await mountWithApp(ResetPasswordView, { initialRoute: '/reset-password', session: { role: 'admin' } })
    await wrapper.get('#reset-password').setValue('una-clave-nueva')
    await wrapper.get('#reset-confirm').setValue('una-clave-nueva')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('residents'))
    expect(auth.updatePassword).toHaveBeenCalledWith('una-clave-nueva')
    expect(pendingNotifications.value.at(-1)?.text).toBe('Listo, tu contraseña quedó guardada.')
  })

  it('rejects mismatched passwords', async () => {
    const { wrapper } = await mountWithApp(ResetPasswordView, { initialRoute: '/reset-password', session: { role: 'admin' } })
    await wrapper.get('#reset-password').setValue('una-clave-nueva')
    await wrapper.get('#reset-confirm').setValue('otra-clave-nueva')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.get('[data-testid="reset-error"]').text()).toBe('Las contraseñas no coinciden.')
    expect(auth.updatePassword).not.toHaveBeenCalled()
  })

  it('shows the API error and keeps the form', async () => {
    vi.mocked(auth.updatePassword).mockRejectedValue(new ApiError('validation'))
    const { wrapper } = await mountWithApp(ResetPasswordView, { initialRoute: '/reset-password', session: { role: 'admin' } })
    await wrapper.get('#reset-password').setValue('una-clave-nueva')
    await wrapper.get('#reset-confirm').setValue('una-clave-nueva')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.get('[data-testid="reset-error"]').text()).toBe('Revisa los datos, hay algo que no es válido.')
  })

  it('explains an expired link when there is no recovery session', async () => {
    const { wrapper } = await mountWithApp(ResetPasswordView, { initialRoute: '/reset-password', session: { role: null } })
    expect(wrapper.get('[data-testid="reset-invalid"]').text()).toBe('El enlace no es válido o ya venció. Pide uno nuevo.')
    expect(wrapper.find('form').exists()).toBe(false)
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm --prefix web run test -- tests/views`

Expected: FAIL. The placeholders have no form, so the tests fail with errors such as `Unable to get #login-email` and `Unable to get #reset-password`.

- [ ] **Step 3: Write `LoginView.vue`**

Replace `web/src/views/LoginView.vue` with:

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { requestPasswordReset, signInWithGoogle, signInWithPassword, signUp } from '@/api/auth'
import { toApiError } from '@/api/errors'
import { cleanText } from '@/lib/text'
import { safeRedirect } from '@/router/guards'
import { useSessionStore } from '@/stores/session'

type Mode = 'signIn' | 'signUp' | 'reset'

const MIN_PASSWORD_LENGTH = 8

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const session = useSessionStore()

const mode = ref<Mode>('signIn')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const busy = ref(false)
const errorKey = ref<string | null>(route.query.error === 'oauth' ? 'auth.googleFailed' : null)
const errorParams = ref<Record<string, unknown>>({})
const infoKey = ref<string | null>(null)

const title = computed(() =>
  mode.value === 'signUp' ? 'auth.signUpTitle' : mode.value === 'reset' ? 'auth.resetTitle' : 'auth.title',
)

function switchMode(next: Mode): void {
  mode.value = next
  password.value = ''
  confirmPassword.value = ''
  errorKey.value = null
  infoKey.value = null
}

function fail(key: string, params: Record<string, unknown> = {}): false {
  errorKey.value = key
  errorParams.value = params
  return false
}

function validate(): boolean {
  errorKey.value = null
  infoKey.value = null
  const cleanEmail = cleanText(email.value)
  if (!cleanEmail) return fail('validation.required')
  if (!/^[^\s@]+@[^\s@]+$/.test(cleanEmail)) return fail('validation.email')
  email.value = cleanEmail
  if (mode.value === 'reset') return true
  if (password.value === '') return fail('validation.required')
  if (mode.value === 'signUp') {
    if (password.value.length < MIN_PASSWORD_LENGTH) return fail('validation.passwordTooShort', { min: MIN_PASSWORD_LENGTH })
    if (password.value !== confirmPassword.value) return fail('validation.passwordsDontMatch')
  }
  return true
}

async function submit(): Promise<void> {
  if (busy.value || !validate()) return
  busy.value = true
  try {
    if (mode.value === 'signIn') {
      await signInWithPassword(email.value, password.value)
      await session.refreshAppUser()
      await router.replace(safeRedirect(route.query.redirect))
    } else if (mode.value === 'signUp') {
      await signUp(email.value, password.value)
      infoKey.value = 'auth.signUpSent'
    } else {
      await requestPasswordReset(email.value)
      infoKey.value = 'auth.resetSent'
    }
  } catch (error) {
    fail(toApiError(error).i18nKey)
  } finally {
    busy.value = false
  }
}

async function google(): Promise<void> {
  errorKey.value = null
  try {
    await signInWithGoogle()
  } catch (error) {
    fail(toApiError(error).i18nKey)
  }
}
</script>

<template>
  <div class="row justify-content-center">
    <div class="col-12 col-sm-10 col-md-7 col-lg-5 col-xl-4">
      <div class="card shadow-sm">
        <div class="card-body p-4">
          <h1 class="h4 mb-1">{{ t(title) }}</h1>
          <p class="text-body-secondary mb-4">
            {{ mode === 'signUp' ? t('auth.signUpHelp') : mode === 'reset' ? t('auth.resetHelp') : t('auth.subtitle') }}
          </p>

          <div v-if="errorKey" class="alert alert-danger" role="alert" data-testid="login-error">
            {{ t(errorKey, errorParams) }}
          </div>
          <div v-if="infoKey" class="alert alert-success" role="status" data-testid="login-info">
            {{ t(infoKey) }}
          </div>

          <template v-if="mode === 'signIn'">
            <button type="button" class="btn btn-outline-primary w-100" @click="google">{{ t('auth.google') }}</button>
            <p class="text-center text-body-secondary small my-3">{{ t('auth.or') }}</p>
          </template>

          <form novalidate @submit.prevent="submit">
            <div class="mb-3">
              <label for="login-email" class="form-label">{{ t('auth.email') }}</label>
              <input id="login-email" v-model="email" type="email" class="form-control" autocomplete="username" />
            </div>
            <div v-if="mode !== 'reset'" class="mb-3">
              <label for="login-password" class="form-label">{{ t('auth.password') }}</label>
              <input
                id="login-password"
                v-model="password"
                type="password"
                class="form-control"
                :autocomplete="mode === 'signUp' ? 'new-password' : 'current-password'"
              />
            </div>
            <div v-if="mode === 'signUp'" class="mb-3">
              <label for="login-confirm" class="form-label">{{ t('auth.confirmPassword') }}</label>
              <input id="login-confirm" v-model="confirmPassword" type="password" class="form-control" autocomplete="new-password" />
            </div>
            <button type="submit" class="btn btn-primary w-100" :disabled="busy">
              {{ mode === 'signUp' ? t('auth.signUp') : mode === 'reset' ? t('auth.resetSend') : t('auth.signIn') }}
            </button>
          </form>

          <div class="d-flex flex-column align-items-center gap-1 mt-3">
            <template v-if="mode === 'signIn'">
              <button type="button" class="btn btn-link btn-sm" @click="switchMode('signUp')">{{ t('auth.firstTime') }}</button>
              <button type="button" class="btn btn-link btn-sm" @click="switchMode('reset')">{{ t('auth.forgot') }}</button>
            </template>
            <button v-else type="button" class="btn btn-link btn-sm" @click="switchMode('signIn')">{{ t('auth.backToSignIn') }}</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
```

`refreshAppUser()` runs before navigating, so the guard sees the new session immediately instead of waiting for the deferred auth event.

- [ ] **Step 4: Write `ResetPasswordView.vue`**

Replace `web/src/views/ResetPasswordView.vue` with:

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { updatePassword } from '@/api/auth'
import { toApiError } from '@/api/errors'
import { useNotify } from '@/composables/useNotify'
import { useSessionStore } from '@/stores/session'

const MIN_PASSWORD_LENGTH = 8

const { t } = useI18n()
const router = useRouter()
const session = useSessionStore()
const notify = useNotify()

const password = ref('')
const confirmPassword = ref('')
const busy = ref(false)
const errorKey = ref<string | null>(null)
const errorParams = ref<Record<string, unknown>>({})

async function submit(): Promise<void> {
  errorKey.value = null
  if (password.value.length < MIN_PASSWORD_LENGTH) {
    errorKey.value = 'validation.passwordTooShort'
    errorParams.value = { min: MIN_PASSWORD_LENGTH }
    return
  }
  if (password.value !== confirmPassword.value) {
    errorKey.value = 'validation.passwordsDontMatch'
    return
  }
  busy.value = true
  try {
    await updatePassword(password.value)
    notify.success('auth.passwordSaved')
    await session.refreshAppUser()
    await router.replace({ name: 'residents' })
  } catch (error) {
    errorKey.value = toApiError(error).i18nKey
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="row justify-content-center">
    <div class="col-12 col-sm-10 col-md-7 col-lg-5 col-xl-4">
      <div class="card shadow-sm">
        <div class="card-body p-4">
          <h1 class="h4 mb-4">{{ t('auth.newPasswordTitle') }}</h1>

          <template v-if="session.status === 'signedOut'">
            <div class="alert alert-warning" role="alert" data-testid="reset-invalid">{{ t('auth.resetLinkInvalid') }}</div>
            <RouterLink :to="{ name: 'login' }">{{ t('auth.backToSignIn') }}</RouterLink>
          </template>

          <form v-else novalidate @submit.prevent="submit">
            <div v-if="errorKey" class="alert alert-danger" role="alert" data-testid="reset-error">
              {{ t(errorKey, errorParams) }}
            </div>
            <div class="mb-3">
              <label for="reset-password" class="form-label">{{ t('auth.newPassword') }}</label>
              <input id="reset-password" v-model="password" type="password" class="form-control" autocomplete="new-password" />
            </div>
            <div class="mb-3">
              <label for="reset-confirm" class="form-label">{{ t('auth.confirmPassword') }}</label>
              <input id="reset-confirm" v-model="confirmPassword" type="password" class="form-control" autocomplete="new-password" />
            </div>
            <button type="submit" class="btn btn-primary w-100" :disabled="busy">{{ t('auth.savePassword') }}</button>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 5: Run them to verify they pass**

Run: `npm --prefix web run test -- tests/views`

Expected: `Test Files  2 passed (2)`, `Tests  17 passed (17)`.

- [ ] **Step 6: Run the whole unit suite, lint and typecheck**

Run: `npm --prefix web run test`, then `npm --prefix web run lint`, then `npm --prefix web run typecheck`

Expected: all pass with no errors.

- [ ] **Step 7: Try it by hand**

Run: `npm run web:dev` and open http://localhost:5173.

1. Sign in as `legal@shelterbridge.test` with `shelterbridge-dev`. Expected: the residents placeholder inside the app shell.
2. Sign out, open "¿Olvidaste tu contraseña?", send a link for `legal@shelterbridge.test`, and open the email in Mailpit (http://127.0.0.1:54324). Expected: the link opens `/reset-password` with the form (not the "link is not valid" message). Set `shelterbridge-dev` again as the password.
3. Sign in with a wrong password. Expected: "El correo o la contraseña no son correctos."

Stop the server with Ctrl+C.

- [ ] **Step 8: Commit**

```bash
git add web/src/views/LoginView.vue web/src/views/ResetPasswordView.vue web/tests/views/LoginView.test.ts web/tests/views/ResetPasswordView.test.ts
git commit -m "feat(web): add sign-in, first password, forgot password and reset views"
```

---

### Task 13: Pending and shift views

**Files:**
- Modify (replace placeholder): `web/src/views/PendingView.vue`, `web/src/views/ShiftView.vue`
- Test: `web/tests/views/PendingView.test.ts`, `web/tests/views/ShiftView.test.ts`

**Interfaces:**
- Consumes: `useSessionStore` (Task 7); `useNotify` (Task 8); `cleanText` (Task 2); `safeRedirect` (Task 10); `mountWithApp`, `fakeAppUser` (Task 10).
- Produces:
  - **`PendingView.vue`:** title `auth.pendingTitle`, text `auth.pendingBody`; "Ya me dieron acceso" calls `session.refreshAppUser()` and goes to `residents` when the status became `ready`; "Cerrar sesión" signs out and goes to `login`.
  - **`ShiftView.vue`:** title "¿Quién está de turno?", help text, input `#shift-name` (prefilled with the current operator name, at most 120 characters), "Empezar turno". It saves `cleanText(name)` with `session.setOperatorName` and goes to `safeRedirect(route.query.redirect)`. A blank name shows `validation.required`. A "Cerrar sesión" link button signs out.

- [ ] **Step 1: Write the failing tests**

`web/tests/views/PendingView.test.ts`:

```ts
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as auth from '@/api/auth'
import { pendingNotifications } from '@/composables/useNotify'
import PendingView from '@/views/PendingView.vue'
import { fakeAppUser, mountWithApp } from '../utils/mountWithApp'

vi.mock('@/api/auth')

afterEach(() => {
  document.body.innerHTML = ''
  pendingNotifications.value.splice(0)
  sessionStorage.clear()
  vi.resetAllMocks()
})

describe('PendingView', () => {
  it('explains that access is pending', async () => {
    const { wrapper } = await mountWithApp(PendingView, { initialRoute: '/pending', session: { role: null, status: 'pending' } })
    expect(wrapper.get('h1').text()).toBe('Tu acceso está pendiente')
  })

  it('moves on once an admin has granted access', async () => {
    vi.mocked(auth.getSession).mockResolvedValue({ user: { id: 'user-1' } } as unknown as auth.Session)
    vi.mocked(auth.getMyAppUser).mockResolvedValue(fakeAppUser('legal'))
    const { wrapper, router } = await mountWithApp(PendingView, { initialRoute: '/pending', session: { role: null, status: 'pending' } })
    await wrapper.findAll('button').find((b) => b.text() === 'Ya me dieron acceso')?.trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('residents'))
  })

  it('stays when access is still pending', async () => {
    vi.mocked(auth.getSession).mockResolvedValue({ user: { id: 'user-1' } } as unknown as auth.Session)
    vi.mocked(auth.getMyAppUser).mockResolvedValue(null)
    const { wrapper, router } = await mountWithApp(PendingView, { initialRoute: '/pending', session: { role: null, status: 'pending' } })
    await wrapper.findAll('button').find((b) => b.text() === 'Ya me dieron acceso')?.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('pending')
  })
})
```

`web/tests/views/ShiftView.test.ts`:

```ts
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as client from '@/api/client'
import { pendingNotifications } from '@/composables/useNotify'
import { useSessionStore } from '@/stores/session'
import ShiftView from '@/views/ShiftView.vue'
import { mountWithApp } from '../utils/mountWithApp'

vi.mock('@/api/auth')
vi.mock('@/api/client')

afterEach(() => {
  document.body.innerHTML = ''
  pendingNotifications.value.splice(0)
  sessionStorage.clear()
  vi.resetAllMocks()
})

describe('ShiftView', () => {
  it('asks who is on shift', async () => {
    const { wrapper } = await mountWithApp(ShiftView, { initialRoute: '/shift', session: { role: 'volunteer', operatorName: null } })
    expect(wrapper.get('h1').text()).toBe('¿Quién está de turno?')
  })

  it('saves the operator name and continues to the original page', async () => {
    const { wrapper, router } = await mountWithApp(ShiftView, {
      initialRoute: '/shift?redirect=/people/search',
      session: { role: 'volunteer', operatorName: null },
    })
    await wrapper.get('#shift-name').setValue('  Ana y Luis ')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/people/search'))
    expect(useSessionStore().operatorName).toBe('Ana y Luis')
    expect(sessionStorage.getItem('sb.operatorName')).toBe('Ana y Luis')
    expect(client.setOperatorName).toHaveBeenLastCalledWith('Ana y Luis')
  })

  it('goes to residents when there is no redirect', async () => {
    const { wrapper, router } = await mountWithApp(ShiftView, { initialRoute: '/shift', session: { role: 'volunteer', operatorName: null } })
    await wrapper.get('#shift-name').setValue('Turno de la mañana')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('residents'))
  })

  it('ignores a redirect to another site', async () => {
    const { wrapper, router } = await mountWithApp(ShiftView, {
      initialRoute: '/shift?redirect=//evil.example',
      session: { role: 'volunteer', operatorName: null },
    })
    await wrapper.get('#shift-name').setValue('Turno de la tarde')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('residents'))
  })

  it('requires a name', async () => {
    const { wrapper, router } = await mountWithApp(ShiftView, { initialRoute: '/shift', session: { role: 'volunteer', operatorName: null } })
    await wrapper.get('#shift-name').setValue('    ')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('Este dato es obligatorio.')
    expect(router.currentRoute.value.name).toBe('shift')
    expect(useSessionStore().operatorName).toBeNull()
  })

  it('starts from the current name when changing shift', async () => {
    const { wrapper } = await mountWithApp(ShiftView, { initialRoute: '/shift', session: { role: 'volunteer', operatorName: 'Ana' } })
    expect((wrapper.get('#shift-name').element as HTMLInputElement).value).toBe('Ana')
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm --prefix web run test -- tests/views/PendingView.test.ts tests/views/ShiftView.test.ts`

Expected: FAIL. The placeholders have no buttons or form (`Unable to get #shift-name`; the pending tests time out waiting for `residents`).

- [ ] **Step 3: Write `PendingView.vue`**

Replace `web/src/views/PendingView.vue` with:

```vue
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useNotify } from '@/composables/useNotify'
import { useSessionStore } from '@/stores/session'

const { t } = useI18n()
const router = useRouter()
const session = useSessionStore()
const notify = useNotify()

async function checkAgain(): Promise<void> {
  try {
    await session.refreshAppUser()
    if (session.status === 'ready') await router.replace({ name: 'residents' })
  } catch (error) {
    notify.error(error)
  }
}

async function signOut(): Promise<void> {
  try {
    await session.signOut()
  } catch (error) {
    notify.error(error)
  }
  await router.replace({ name: 'login' })
}
</script>

<template>
  <div class="row justify-content-center">
    <div class="col-12 col-md-8 col-lg-6">
      <div class="card shadow-sm">
        <div class="card-body p-4">
          <h1 class="h4">{{ t('auth.pendingTitle') }}</h1>
          <p class="mb-4">{{ t('auth.pendingBody') }}</p>
          <div class="d-flex flex-wrap gap-2">
            <button type="button" class="btn btn-primary" @click="checkAgain">{{ t('auth.pendingRetry') }}</button>
            <button type="button" class="btn btn-outline-secondary" @click="signOut">{{ t('nav.signOut') }}</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 4: Write `ShiftView.vue`**

Replace `web/src/views/ShiftView.vue` with:

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useNotify } from '@/composables/useNotify'
import { cleanText } from '@/lib/text'
import { safeRedirect } from '@/router/guards'
import { useSessionStore } from '@/stores/session'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const notify = useNotify()

const name = ref(session.operatorName ?? '')
const showRequired = ref(false)

async function start(): Promise<void> {
  const cleaned = cleanText(name.value)
  showRequired.value = cleaned === null
  if (cleaned === null) return
  session.setOperatorName(cleaned)
  await router.replace(safeRedirect(route.query.redirect))
}

async function signOut(): Promise<void> {
  try {
    await session.signOut()
  } catch (error) {
    notify.error(error)
  }
  await router.replace({ name: 'login' })
}
</script>

<template>
  <div class="row justify-content-center">
    <div class="col-12 col-md-8 col-lg-6">
      <div class="card shadow-sm">
        <div class="card-body p-4">
          <h1 class="h3">{{ t('shift.title') }}</h1>
          <p class="text-body-secondary">{{ t('shift.help') }}</p>
          <form novalidate @submit.prevent="start">
            <div class="mb-3">
              <label for="shift-name" class="form-label">{{ t('shift.name') }}</label>
              <input
                id="shift-name"
                v-model="name"
                type="text"
                class="form-control form-control-lg"
                :class="{ 'is-invalid': showRequired }"
                autocomplete="off"
                maxlength="120"
              />
              <div v-if="showRequired" class="invalid-feedback">{{ t('validation.required') }}</div>
            </div>
            <div class="d-flex flex-wrap gap-2">
              <button type="submit" class="btn btn-primary btn-lg">{{ t('shift.start') }}</button>
              <button type="button" class="btn btn-link" @click="signOut">{{ t('nav.signOut') }}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 5: Run them to verify they pass**

Run: `npm --prefix web run test -- tests/views/PendingView.test.ts tests/views/ShiftView.test.ts`

Expected: `Test Files  2 passed (2)`, `Tests  9 passed (9)`.

- [ ] **Step 6: Run the whole unit suite, lint and typecheck**

Run: `npm --prefix web run test`, then `npm --prefix web run lint`, then `npm --prefix web run typecheck`

Expected: `Test Files  22 passed (22)`; no lint or type errors.

- [ ] **Step 7: Commit**

```bash
git add web/src/views/PendingView.vue web/src/views/ShiftView.vue web/tests/views/PendingView.test.ts web/tests/views/ShiftView.test.ts
git commit -m "feat(web): add pending access and who-is-on-shift views"
```

---

### Task 14: Google sign-in for local development

**Files:**
- Modify: `supabase/config.toml` (add `[auth.external.google]`)
- Modify: `README.md` (add a "Google sign-in for local development" section)

**Interfaces:**
- Consumes: `signInWithGoogle` (Task 5), the Google button in `LoginView` (Task 12), the `?error=oauth` handling in the guard (Task 10).
- Produces:
  - **`[auth.external.google]`** in `supabase/config.toml`: `enabled = false` by default, `client_id = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)"`, `secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)"`, `redirect_uri = "http://127.0.0.1:54321/auth/v1/callback"`.
  - A developer turns Google on with `SUPABASE_AUTH_EXTERNAL_GOOGLE_ENABLED=true` plus the client id and secret in `supabase/.env.local`, which the Supabase CLI loads and both `.gitignore` files ignore. The CLI only rejects a missing client id when Google is enabled, so `supabase start` and email sign-in keep working when Google is not configured.

- [ ] **Step 1: Add the provider section**

In `supabase/config.toml`, after the `[auth.external.apple]` block (just before the `[auth.web3.solana]` comment lines), add:

```toml
# Google sign-in for local development. Off unless supabase/.env.local sets
# SUPABASE_AUTH_EXTERNAL_GOOGLE_ENABLED=true and the client id and secret
# (see README.md). Email and password sign-in works either way.
[auth.external.google]
enabled = false
client_id = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)"
secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)"
redirect_uri = "http://127.0.0.1:54321/auth/v1/callback"
url = ""
skip_nonce_check = false
email_optional = false
```

- [ ] **Step 2: Check that the stack starts and email sign-in works without Google**

Run: `ls supabase/.env.local`

If the file exists, it is a developer's own Google setup: leave it alone and skip to Step 4 after checking that `npm run db:stop` and `npm run db:start` succeed.

Run: `npm run db:stop`, then `npm run db:start`, then `npm run db:reset`

Expected: the stack starts with no `Missing required field in config` error.

Run:

```bash
ANON=$(grep '^VITE_SUPABASE_ANON_KEY=' web/.env.local | cut -d= -f2-)
curl -s http://127.0.0.1:54321/auth/v1/settings -H "apikey: $ANON" | grep -o '"\(google\|email\)":[a-z]*'
```

Expected: `"email":true` and `"google":false`.

Run: `npm run web:test:integration -- tests/integration/auth.test.ts`

Expected: `Tests  8 passed (8)`.

- [ ] **Step 3: Check that the environment switch turns Google on**

```bash
printf 'SUPABASE_AUTH_EXTERNAL_GOOGLE_ENABLED=true\nSUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=dummy-client.apps.googleusercontent.com\nSUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=dummy-secret\n' > supabase/.env.local
npm run db:stop && npm run db:start
curl -s http://127.0.0.1:54321/auth/v1/settings -H "apikey: $ANON" | grep -o '"google":[a-z]*'
```

Expected: `"google":true`. (The dummy client cannot complete a real Google sign-in; this only proves the wiring.)

Then remove the dummy file and restart:

```bash
rm supabase/.env.local
npm run db:stop && npm run db:start && npm run db:reset
curl -s http://127.0.0.1:54321/auth/v1/settings -H "apikey: $ANON" | grep -o '"google":[a-z]*'
```

Expected: `"google":false`.

- [ ] **Step 4: Document the setup in `README.md`**

Add this section right after the `## Development` section:

````markdown
## Google sign-in for local development

Email and password sign-in works without this. Locally, Google sign-in stays off until you add your own Google OAuth client:

1. In the [Google Cloud console](https://console.cloud.google.com/), create or pick a project and open **Google Auth Platform**.
2. Under **Branding**, set an app name and a support email. Under **Audience**, keep the app in testing and add your Google account as a test user. The default `openid`, `email` and `profile` scopes are enough.
3. Under **Clients**, create a client of type **Web application** with:
   - Authorized JavaScript origin: `http://localhost:5173`
   - Authorized redirect URI: `http://127.0.0.1:54321/auth/v1/callback`
4. Create `supabase/.env.local` (it is git-ignored) with the client ID and secret:

   ```
   SUPABASE_AUTH_EXTERNAL_GOOGLE_ENABLED=true
   SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=<client id>
   SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=<client secret>
   ```

5. Restart Supabase: `npm run db:stop`, then `npm run db:start`.
6. Invite your Google email, because sign-in is by invitation only. In Supabase Studio (http://127.0.0.1:54323), open the SQL editor and run the line below with your own email and name. `npm run db:reset` removes the invitation, so run it again after a reset.

   ```sql
   insert into public.app_users (email, role, display_name) values ('your.name@gmail.com', 'admin', 'Your Name');
   ```

Without an invitation, Google sends you back to the login page with a message asking you to request access.

Staging and production each need their own Google client, with that Supabase project's callback URL (`https://<project-ref>.supabase.co/auth/v1/callback`) and the app's address as the JavaScript origin. Set the client ID and secret in the Supabase dashboard under Authentication.
````

- [ ] **Step 5: Commit**

```bash
git add supabase/config.toml README.md
git commit -m "feat(auth): add optional local Google sign-in configured from supabase/.env.local"
```

---

### Task 15: End-to-end sign-in test

**Files:**
- Create: `web/playwright.config.ts`, `web/e2e/fixtures.ts`
- Test: `web/e2e/sign-in.spec.ts`

**Interfaces:**
- Consumes: the running app (Tasks 1 to 13), `web/.env.local` (Task 5), and the seeded dev users.
- Produces:
  - **`e2e/fixtures.ts`:**
    - `signIn(page: Page, role: AppRole, operatorName?: string): Promise<void>`: signs in through the login page. A volunteer always lands on the shift page; with `operatorName` it fills it in and waits for `/residents`, without it the function returns on the shift page. Other roles wait for `/residents`.
    - `uniqueName(prefix: string): string`: fictitious, unique text for a test run.
    - `dismissLicenseBanner(page: Page): Promise<void>`: closes the Syncfusion license banner when there is no license key (it is fixed over the top of the page and would block clicks on the navbar). Call it after every full page load.
  - **Playwright config:** Chromium desktop, `baseURL` `http://localhost:5173`, locale `es-MX`, timezone `America/Mexico_City`, one worker, `webServer` running `npm run dev` (reused when already running).

- [ ] **Step 1: Install the Playwright browser**

Run: `(cd web && npx playwright install chromium)`

Expected: it downloads Chromium, or reports that it is already installed.

- [ ] **Step 2: Write the config and the fixtures**

`web/playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test'

// End-to-end tests run against the Vite dev server and the local Supabase
// stack, on a freshly reset database (npm run db:reset).
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173',
    locale: 'es-MX',
    timezoneId: 'America/Mexico_City',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
```

`web/e2e/fixtures.ts`:

```ts
import { expect, type Page } from '@playwright/test'
import type { AppRole } from '../src/types/domain'

// Seeded by supabase/seed.sql for local development only.
const DEV_PASSWORD = 'shelterbridge-dev'

// Without VITE_SYNCFUSION_LICENSE_KEY, Syncfusion shows a fixed banner over the
// top of the page that would block clicks on the navbar. Close it if it is there.
export async function dismissLicenseBanner(page: Page): Promise<void> {
  const close = page.locator('.sf-license-validation-close')
  if (await close.isVisible()) await close.click()
}

// Signs in through the login page. A volunteer lands on the shift page; when
// operatorName is given it is entered there and the residents page is awaited.
export async function signIn(page: Page, role: AppRole, operatorName?: string): Promise<void> {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Entrar a ShelterBridge' })).toBeVisible()
  await dismissLicenseBanner(page)
  await page.getByLabel('Correo electrónico').fill(`${role}@shelterbridge.test`)
  await page.getByLabel('Contraseña').fill(DEV_PASSWORD)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()

  if (role === 'volunteer') {
    await expect(page).toHaveURL(/\/shift/)
    if (operatorName === undefined) return
    await page.getByLabel('Nombres de quienes están de turno').fill(operatorName)
    await page.getByRole('button', { name: 'Empezar turno' }).click()
  }
  await expect(page).toHaveURL(/\/residents$/)
}

// Fictitious, unique text so tests never collide with seed data or each other.
export function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}
```

- [ ] **Step 3: Write the end-to-end test**

`web/e2e/sign-in.spec.ts`:

```ts
import { expect, test } from '@playwright/test'
import { dismissLicenseBanner, signIn, uniqueName } from './fixtures'

test('a volunteer names the shift and reaches the residents page', async ({ page }) => {
  const operator = uniqueName('Turno de prueba')
  await signIn(page, 'volunteer')

  await expect(page.getByRole('heading', { name: '¿Quién está de turno?' })).toBeVisible()
  await page.getByLabel('Nombres de quienes están de turno').fill(operator)
  await page.getByRole('button', { name: 'Empezar turno' }).click()

  await expect(page).toHaveURL(/\/residents$/)
  await expect(page.getByRole('heading', { name: 'Residentes' })).toBeVisible()
  await expect(page.getByTestId('operator-name')).toHaveText(`De turno: ${operator}`)
  await expect(page.getByRole('button', { name: 'Administración' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Usuarios' })).toHaveCount(0)
})

test('the operator name survives a page reload', async ({ page }) => {
  await signIn(page, 'volunteer', 'Turno de recarga')
  await page.reload()
  await expect(page).toHaveURL(/\/residents$/)
  await expect(page.getByTestId('operator-name')).toHaveText('De turno: Turno de recarga')
})

test('an admin goes straight to residents and sees the admin links', async ({ page }) => {
  await signIn(page, 'admin')
  await expect(page.getByRole('heading', { name: 'Residentes' })).toBeVisible()
  await page.getByRole('button', { name: 'Administración' }).click()
  for (const name of ['Usuarios', 'Catálogos', 'Configuración', 'Bitácora de cambios', 'Unir duplicados']) {
    await expect(page.getByRole('link', { name })).toBeVisible()
  }
  await page.getByRole('link', { name: 'Usuarios' }).click()
  await expect(page).toHaveURL(/\/admin\/users$/)
})

test('a wrong password shows a Spanish message', async ({ page }) => {
  await page.goto('/login')
  await dismissLicenseBanner(page)
  await page.getByLabel('Correo electrónico').fill('legal@shelterbridge.test')
  await page.getByLabel('Contraseña').fill('not-the-password')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByTestId('login-error')).toHaveText('El correo o la contraseña no son correctos.')
})
```

- [ ] **Step 4: Run it**

Run: `npm run db:reset`, then `npm run web:e2e`

Expected: `4 passed`. Playwright starts the dev server itself (or reuses one that is already running on port 5173). The features were built in Tasks 10 to 13, so a failure here points at wiring: check `web/.env.local`, that the stack is running, and the trace in `web/playwright-report/`.

- [ ] **Step 5: Run lint and typecheck**

Run: `npm --prefix web run lint`, then `npm --prefix web run typecheck`

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add web/playwright.config.ts web/e2e
git commit -m "test(web): add end-to-end sign-in, shift and role navigation test"
```

---

### Task 16: Developer docs

**Files:**
- Modify: `CLAUDE.md` (the `## Commands` and `## Status` sections)
- Modify: `README.md` (the `## Development` and `## Status` sections)

**Interfaces:**
- Consumes: every script and setup step above.
- Produces: up-to-date developer instructions.

- [ ] **Step 1: Update `CLAUDE.md`**

Replace the `## Commands` section with:

````markdown
## Commands

Node.js 24.15 or later (or 22.22.2 or later). Docker Desktop must be running for every `db:*` script.

```bash
npm install                                        # installs the Supabase CLI
npm --prefix web install                           # installs the web app
npm run db:start                                   # starts local Supabase (Studio: http://127.0.0.1:54323)
npm run db:reset                                   # rebuilds the local database from migrations and seed.sql
npm run db:test                                    # runs the pgTAP tests in supabase/tests/database
npm run db:lint                                    # checks SQL functions for errors
npm run db:types                                   # regenerates web/src/types/database.ts after a migration
npm run db:stop                                    # stops local Supabase
node supabase/scripts/generate-countries-migration.mjs   # regenerates the countries data migration
npm run web:dev                                    # web app at http://localhost:5173
npm run web:test                                   # unit and component tests (Vitest, jsdom)
npm run web:test:integration                       # web/src/api against local Supabase (run db:reset first)
npm run web:e2e                                    # Playwright end-to-end tests (run db:reset first)
npm run web:lint                                   # ESLint, including the Supabase import boundary
npm run web:typecheck                              # vue-tsc
```

`web/.env.local` (git-ignored) holds `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (the `ANON_KEY` from `npx supabase status -o env`) and the optional `VITE_SYNCFUSION_LICENSE_KEY`. Playwright needs Chromium once: `(cd web && npx playwright install chromium)`.

Component tests mount with `web/tests/utils/mountWithApp.ts` and mock `@/api/*`. A missing i18n key fails the unit tests. Syncfusion theme CSS is imported per component in `web/src/main.ts` from `@syncfusion/ej2-bootstrap5.3-theme`.

Local dev users (password `shelterbridge-dev`): `admin@`, `legal@`, `psychology@` and `volunteer@shelterbridge.test`. Auth emails go to Mailpit at http://127.0.0.1:54324. Google sign-in is optional locally; see README.md.
````

Replace the first paragraph of `## Status` (the one that says the web app comes next) with:

```markdown
The database (Plan 1) and the web foundation (Plan 2) for sub-project 1 are implemented and tested: sign-in, roles, the shift screen, the app shell in Spanish and the `api/` layer. The feature screens (Plan 3) come next.
```

Keep the spec and plans bullets and the source-of-truth paragraph below it.

- [ ] **Step 2: Update `README.md`**

Replace the `## Development` section with:

````markdown
## Development

You need Node.js 24.15 or later (or 22.22.2 or later) and Docker Desktop.

Database:

```bash
npm install
npm run db:start
npm run db:reset
npm run db:test
```

`db:start` prints the local URLs. The database admin UI (Supabase Studio) is at http://127.0.0.1:54323, and the emails the app sends locally appear in Mailpit at http://127.0.0.1:54324.

Web app:

```bash
npm --prefix web install
cp web/.env.example web/.env.local
npx supabase status -o env
```

Copy the `ANON_KEY` value from the last command into `VITE_SUPABASE_ANON_KEY` in `web/.env.local`. If you have a Syncfusion license key, put it in `VITE_SYNCFUSION_LICENSE_KEY`; without one, Syncfusion shows a license banner. Then:

```bash
npm run web:dev
```

and open http://localhost:5173.

For local testing there are four made-up users, all with the password `shelterbridge-dev`: `admin@shelterbridge.test`, `legal@shelterbridge.test`, `psychology@shelterbridge.test` and `volunteer@shelterbridge.test`. The volunteer account first asks who is on shift.

Tests:

```bash
npm run web:test                               # unit and component tests
npm run web:test:integration                   # the api layer against local Supabase
(cd web && npx playwright install chromium)    # once, for the end-to-end tests
npm run web:e2e                                # end-to-end tests in a browser
npm run web:lint
npm run web:typecheck
```

Run `npm run db:reset` before the integration and end-to-end tests. After changing a migration, run `npm run db:types` to regenerate the database types for the web app.
````

Replace the `## Status` paragraph with:

```markdown
The database and the web app foundation for the first part are built and tested. You can sign in, the volunteer account is asked who is on shift, and the app shell is in Spanish. The screens for residents, registration and administration come next. The design is in [docs/superpowers/specs/2026-10-07-shelterbridge-registry-and-stays-design.md](docs/superpowers/specs/2026-10-07-shelterbridge-registry-and-stays-design.md).
```

- [ ] **Step 3: Run everything once more**

Run: `npm run web:test`, `npm run web:lint`, `npm run web:typecheck`, then `npm run db:reset`, `npm run web:test:integration` and `npm run web:e2e`

Expected: all green.

- [ ] **Step 4: Check for dashes**

Run this in Git Bash. It matches the UTF-8 bytes of the em dash and en dash:

`LC_ALL=C grep -rnP '\xE2\x80[\x93\x94]' --exclude-dir=node_modules --exclude-dir=.git --exclude=package-lock.json .`

Expected: no output. Rewrite any hit.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "docs: add web app development commands and status"
```

---

## Interfaces for Plan 3

Plan 3 consumes exactly this surface, in addition to the contract.

**api/** (all signatures as in the contract)
- `@/api/client`: `supabase`, `setOperatorName`, `getOperatorName`.
- `@/api/errors`: `ApiError`, `toApiError`, `isApiError`, `ApiErrorCode`, plus `API_ERROR_CODES`. `toApiError` also maps Storage errors: a failed fetch is `network`, 401 or 403 is `not_authorized`, and 400, 413 or 415 is `validation`.
- `@/api/rows`: `updateVersioned`. Use it for every edit; on zero rows it throws `stale_record`, or `not_authorized` when the caller was deactivated mid-session.
- `@/api/auth`: the contract functions, plus `type Session`.
- `@/api/catalogs`: `listCatalog`. Plan 3 adds `createCatalogItem` and `updateCatalogItem` to this file.
- `@/api/settings`: `ShelterSettings`, `getSettings`. Plan 3 adds `updateTimezone` to this file.

**Stores, composables and components**
- `useSessionStore`, `useCatalogsStore` (`options()` returns `CatalogOption[]`), `useSettingsStore` (call `load()` again after changing the timezone).
- `useNotify`, `useConfirm`, `useShelterTime`, `useOnline` (plus `reportNetworkFailure`).
- `ToastHost` and `ConfirmHost` are already mounted in `App.vue`; do not mount them again. Both show their text as plain text (the toast escapes HTML; the dialog message is a Vue text child), so `useNotify().success(key, { name })` and `useConfirm().confirm({ messageParams: { name } })` may carry people's names.
- `PageHeader` (`titleKey`, `titleParams`, slot `actions`) and `CatalogSelect` (`catalog`, `v-model`, `placeholderKey`, `allowEmpty`, `id`).
- `AppShell` loads the catalogs and settings, so views inside the `app` layout can rely on them after mount.

**i18n keys that already exist** (Plan 3 adds its own namespaces and must not redefine these):
- `common`: `appName`, `save`, `cancel`, `confirm`, `continue`, `retry`, `reload`, `close`, `loading`, `select`, `personRecord`, `offline`, `offlineHint`
- `nav`: `menu`, `residents`, `search`, `newPerson`, `admin`, `users`, `catalogs`, `settings`, `audit`, `merge`, `onShift`, `changeShift`, `signOut`
- `auth`: `title`, `subtitle`, `google`, `or`, `email`, `password`, `signIn`, `firstTime`, `signUpTitle`, `signUpHelp`, `signUp`, `signUpSent`, `forgot`, `resetTitle`, `resetHelp`, `resetSend`, `resetSent`, `backToSignIn`, `newPasswordTitle`, `newPassword`, `confirmPassword`, `savePassword`, `passwordSaved`, `resetLinkInvalid`, `googleFailed`, `pendingTitle`, `pendingBody`, `pendingRetry`
- `shift`: `title`, `help`, `name`, `start`
- `errors`: one key per `ApiErrorCode`
- `validation`: `required`, `email`, `passwordTooShort` (`{min}`), `passwordsDontMatch`, `dateInFuture`, `birthDateImplausible`, `exitBeforeEntry`
- `phoneStatus`: `none`, `with_person`, `in_custody`
- `presence`: `inside`, `outside`

**Placeholder views** use `nav.residents`, `nav.search`, `nav.newPerson`, `common.personRecord`, `nav.users`, `nav.catalogs`, `nav.settings`, `nav.audit` and `nav.merge` as titles. Plan 3 replaces the files.

**Test utilities**
- `mountWithApp` defaults: route `/residents`, role `volunteer`, operator name `'Turno de prueba'`, status `ready` (`signedOut` when `role: null`), timezone `America/Mexico_City`, catalogs `testCatalogs` (MX, HN, GT; `migrant_in_transit`, `asylum_seeker`; `female`, `male`). The router has the real route names, paths and meta, with components stubbed and no guards, so `router.push` and `vi.waitFor` on `currentRoute` never wait for a lazy view import. Store actions are real spies, so mock the `@/api/*` modules they call. It mounts on `document.body`; clear it in `afterEach`.
- `fakeAppUser(role, patch?)`, `testCatalogs` and `stubbedRoutes` from the same file. A test that builds its own router for navigation should use `stubbedRoutes`.
- The `unit` Vitest project has a 15 second test timeout (`vi.waitFor` still defaults to 1 second; pass `{ timeout }` for slower waits such as Grid rendering).
- The `integration` project stubs `window.location.origin` as `http://localhost:5173` for redirect URLs built in `api/`.
- `missingI18nKeys` from `tests/utils/i18nGuard.ts`, for a test that looks up a missing key on purpose.
- `tests/integration/helpers.ts`: `signInAs`, `signOutQuietly`, `devEmail`, `uniqueSuffix`, `DEV_PASSWORD`, `supabase`.
- `e2e/fixtures.ts`: `signIn`, `uniqueName`, `dismissLicenseBanner`.

**Syncfusion**
- Add each new component's CSS to `web/src/main.ts` from `@syncfusion/ej2-bootstrap5.3-theme/styles/<component>/<component>.css`, plus the dependencies listed in that folder's `index.css` that are not imported yet (for example the Grid also needs `calendar`, `datepicker`, `check-box`, `pager`, `excel-filter` and others listed there). Add the matching `@syncfusion/ej2-vue-*` package with `~35.1.x`.
- Keep Syncfusion Dialogs mounted and bind `visible`; do not use `v-if` on them.
- Syncfusion string properties such as `content` render HTML. Put text that can hold names in a Vue child of the component, or HTML-escape it, as `ToastHost` and `ConfirmHost` do.
- In component tests, drive Syncfusion inputs through `wrapper.findComponent({ name: '<Name>Component' }).vm.ej2Instances` (set the value, then `dataBind()`), as `CatalogSelect.test.ts` does.

## Contract notes

The contract was followed as written. These are the places where this plan had to add to it or interpret it; nothing in the contract was renamed or re-signed.

1. **Guard step 2 and `/reset-password`.** The recovery email link signs the user in before `/reset-password` loads, so a literal step 2 ("a public route while signed in goes to residents") would make password reset impossible. `reset-password` is exempt from step 2.
2. **Guard steps 3 to 5, small additions.** Step 3 sends a signed-out user who arrives with an OAuth `error` (a refused Google sign-in) to `login?error=oauth` instead of `?redirect=`, so the English text from Supabase is never shown. Step 4 also sends a `ready` user away from `/pending`. Step 5 adds `?redirect=` to `shift` so the volunteer continues to the page they asked for.
3. **`not_invited` mapping.** `toApiError` cannot tell which call failed, so the "403 on sign-up" row lives in `api/auth.signUp`. `toApiError` maps any other Auth 403 (for example a bad token) to `not_authorized`.
4. **ESLint boundary scope.** The rule covers `src/`, `tests/` and `e2e/`, but exempts `tests/api/**` besides `src/api/**`, because the unit tests of `api/` need Supabase's error classes.
5. **Additive exports.** `API_ERROR_CODES` (errors.ts); `type Session` (auth.ts); `type SessionStatus` (session store); `CatalogOption` (catalogs store); `DEFAULT_TIMEZONE` (settings store); `pendingNotifications` and `Notification` (useNotify); `activeConfirm`, `answerConfirm`, `ConfirmOptions` and `ConfirmRequest` (useConfirm); `reportNetworkFailure` (useOnline); `authGuard` and `safeRedirect` (guards.ts); `routes` (routes.ts); `router` (router/index.ts); `fakeAppUser`, `testCatalogs`, `stubbedRoutes` and `MountWithAppOptions` (mountWithApp.ts); `missingI18nKeys` and `installMissingKeyGuard` (i18nGuard.ts); `devEmail`, `signOutQuietly`, `uniqueSuffix` and `DEV_PASSWORD` (integration helpers); `dismissLicenseBanner` (e2e fixtures).
6. **`mountWithApp` defaults and router.** The defaults are not in the contract; they are listed in "Interfaces for Plan 3". The contract says the router has "the real routes"; it has the real route names, paths and meta with the components stubbed (`stubbedRoutes`), because no `<RouterView>` renders in a component test and lazy view imports made navigation waits flaky.
7. **Syncfusion theme package.** Since version 35, the theme CSS is not inside the component packages. It comes from `@syncfusion/ej2-bootstrap5.3-theme` (the Bootstrap 5.3 variant, matching Bootstrap 5.3.8).
8. **Node.js version.** The web toolchain needs Node 24.15 or later (or 22.22.2 or later); CLAUDE.md and Plan 1 said Node 20.
9. **Local auth rate limits.** `supabase/config.toml` raises the local `sign_in_sign_ups` and `email_sent` limits so the test suites are not throttled. This only affects the local stack.
10. **End-to-end heading.** `e2e/sign-in.spec.ts` checks for a heading named "Residentes" on `/residents`. Plan 3's residents screen should keep that heading, or update the test.
11. **`updateVersioned` and deactivated users.** The contract says zero rows throws `stale_record`. For a user deactivated mid-session, RLS hides every row, so zero rows would wrongly say someone else changed the record. `updateVersioned` checks the caller's own app user and throws `not_authorized` in that case.
12. **Storage errors in `toApiError`.** The contract's mapping table has no row for Storage errors, which carry an HTTP status instead of a SQLSTATE. A failed fetch maps to `network`, 401 and 403 to `not_authorized`, and 400, 413 and 415 to `validation`; anything else stays `unknown`.
13. **Syncfusion HTML content.** `ToastHost` escapes HTML and `ConfirmHost` renders the message as a Vue text child, because Syncfusion renders `content` as HTML and Plan 3 puts names into messages. The contract's signatures for `useNotify` and `useConfirm` are unchanged.
14. **Session sign-out clears the operator name** in every case, including a sign-out that Supabase starts itself, not only in the store's `signOut()` action.
15. **Test timeouts.** The `unit` Vitest project uses a 15 second test timeout, because Plan 3 waits up to 5 seconds for Grid rows.

