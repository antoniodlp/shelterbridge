# Registry and Stays: Web Contract (Plans 2 and 3)

Plan 2 (web foundation) and Plan 3 (web features) are written in parallel. This file is the sync point between them. It fixes file paths, exported names, signatures, route names, i18n namespaces and test utilities. Plan 2 produces everything marked **[P2]**. Plan 3 consumes those items and produces everything marked **[P3]**. Neither plan may rename or re-sign anything listed here. If a plan finds a real problem with this contract, it keeps to the contract and records the issue in a final "Contract notes" section of its own plan.

Sources of truth, in order:
1. The spec: `docs/superpowers/specs/2026-10-07-shelterbridge-registry-and-stays-design.md`.
2. The database surface: the "Interfaces for Plans 2 and 3" section of `docs/superpowers/plans/2026-10-07-registry-and-stays-1-database.md`, plus the migrations under `supabase/migrations/`.
3. This contract.

## Decisions carried over from Plan 1 execution

- **Sign-up rejection:** a sign-up for an email that is not invited fails with HTTP 403 from the Before User Created hook. The hook's message is English text, so the web app must not display it. It must map the 403 to the error code `not_invited`.
- **Email confirmation** is enabled. Locally, emails go to Mailpit at http://127.0.0.1:54324.
- **Whitespace:** the database strips leading and trailing whitespace, including non-breaking spaces, from names, region, bed, notes and comments. Blank optional text is stored as null. A blank first name is rejected (`23514`). The web app trims the same way before sending, using `cleanText()` from `src/lib/text.ts` **[P2]**.
- **Dev users:** local users `admin@`, `legal@`, `psychology@` and `volunteer@shelterbridge.test`, all with password `shelterbridge-dev`. They are created by `supabase/seed.sql` (Plan 1, Task 15).
- **`db:lint`** fails on errors.

## Repository layout and scripts **[P2]**

```
package.json            root: adds web scripts and db:types (keeps the db:* scripts from Plan 1)
web/
  package.json          its own package (Vite + Vue 3 + TypeScript)
  .env.example          committed; .env.local is git-ignored
  index.html, vite.config.ts, tsconfig*.json, eslint.config.js, vitest config inside vite.config.ts
  playwright.config.ts
  src/...               see below
  tests/                Vitest unit and component tests (mirrors src/ paths)
  tests/integration/    Vitest tests of api/ against the local Supabase stack
  e2e/                  Playwright tests
```

**Root scripts:**

| Script | Command |
|---|---|
| `db:types` | `supabase gen types typescript --local > web/src/types/database.ts` |
| `web:dev` | `npm --prefix web run dev` |
| `web:test` | `npm --prefix web run test` |
| `web:test:integration` | `npm --prefix web run test:integration` |
| `web:e2e` | `npm --prefix web run e2e` |
| `web:lint` | `npm --prefix web run lint` |
| `web:typecheck` | `npm --prefix web run typecheck` |

**`web/package.json` scripts:**

| Script | Runs |
|---|---|
| `dev` | Vite on port 5173 |
| `build` | |
| `preview` | |
| `test` | Vitest run, excluding `tests/integration` |
| `test:integration` | Vitest run of `tests/integration` only; needs the local stack and a freshly reset database |
| `lint` | ESLint |
| `typecheck` | `vue-tsc --noEmit` |
| `e2e` | `playwright test` |

**Environment variables** (`web/.env.example`):
- `VITE_SUPABASE_URL=http://127.0.0.1:54321`
- `VITE_SUPABASE_ANON_KEY=`
- `VITE_SYNCFUSION_LICENSE_KEY=`

**Path alias:** `@` maps to `web/src`.

## `src/` layout

```
main.ts                         [P2] bootstraps Syncfusion license, styles, i18n, Pinia, router, session init
App.vue                         [P2] picks layout by route meta
api/        client.ts errors.ts rows.ts auth.ts catalogs.ts settings.ts         [P2]
            people.ts stays.ts outings.ts photos.ts users.ts audit.ts           [P3]
            (catalogs.ts and settings.ts are extended by P3, see below)
i18n/       index.ts syncfusion.ts locales/es-MX.json                           [P2] (P3 adds keys)
lib/        text.ts shelterTime.ts                                              [P2]
            imageResize.ts                                                      [P3]
stores/     session.ts catalogs.ts settings.ts                                  [P2]
router/     index.ts routes.ts guards.ts                                        [P2]
composables/ useNotify.ts useConfirm.ts useShelterTime.ts useOnline.ts          [P2]
components/ layout/AppShell.vue layout/AppNavbar.vue layout/OfflineBanner.vue   [P2]
            common/ToastHost.vue common/ConfirmHost.vue common/PageHeader.vue   [P2]
            common/CatalogSelect.vue                                            [P2]
            (feature components live under components/<feature>/)             [P3]
views/      LoginView.vue ResetPasswordView.vue PendingView.vue ShiftView.vue   [P2]
            ResidentsView.vue PeopleSearchView.vue PersonNewView.vue PersonView.vue
            admin/UsersView.vue admin/CatalogsView.vue admin/SettingsView.vue
            admin/AuditView.vue admin/MergeView.vue                             [P2 placeholder, P3 real]
types/      database.ts (generated) domain.ts                                   [P2]
```

Only `src/api/` may import `@supabase/supabase-js`. ESLint enforces this with `no-restricted-imports` **[P2]**.

## Types **[P2]** (`src/types/domain.ts`)

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

Data objects keep the database's snake_case field names. Function and variable names are camelCase.

## api/ **[P2]**

**`client.ts`**
```ts
export const supabase: SupabaseClient<Database>        // created once from import.meta.env
export function setOperatorName(name: string | null): void
export function getOperatorName(): string | null
```
- The client is created with a custom `global.fetch`.
- When the operator name is set, that fetch adds the header `x-operator-name`, with the value base64 of the UTF-8 name.

**`errors.ts`**
```ts
export type ApiErrorCode =
  | 'not_authorized' | 'not_found' | 'validation' | 'stale_record'
  | 'already_checked_in' | 'stay_not_open' | 'outing_already_open' | 'no_open_outing'
  | 'outing_exception_needs_confirmation' | 'outing_outside_stay'
  | 'overlapping_stays' | 'merge_same_person'
  | 'invalid_credentials' | 'email_not_confirmed' | 'not_invited'
  | 'network' | 'unknown'

export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly i18nKey: string          // `errors.${code}`
  readonly details?: unknown
  constructor(code: ApiErrorCode, details?: unknown)
}
export function toApiError(error: unknown): ApiError
export function isApiError(error: unknown, code?: ApiErrorCode): error is ApiError
```

`toApiError` mapping:

| Source | Maps to |
|---|---|
| PostgREST error with `code` `P0001` | its `message` (when it is a known code, else `unknown`) |
| `42501` | `not_authorized` |
| `23P01` | `overlapping_stays` |
| `23505`, `23514`, `23502`, `23503`, `22007`, `22008`, `22P02` | `validation` |
| `PGRST116` (no rows for `.single()`) | `not_found` |
| Supabase Auth error with status 403 on sign-up | `not_invited` |
| Auth `invalid_credentials` / 400 on password sign-in | `invalid_credentials` |
| Auth `email_not_confirmed` | `email_not_confirmed` |
| `TypeError` from fetch or `navigator.onLine === false` | `network` |
| Anything else | `unknown` |

**`rows.ts`**: optimistic concurrency, used by every edit.
```ts
export async function updateVersioned<T extends keyof Database['public']['Tables']>(
  table: T,
  key: { column: string; value: string },
  expectedUpdatedAt: string,
  patch: Database['public']['Tables'][T]['Update'],
): Promise<Database['public']['Tables'][T]['Row']>
```
- It filters on the key and on `updated_at = expectedUpdatedAt`, and asks for the row back.
- Zero rows throws `ApiError('stale_record')`.

**`auth.ts`**
```ts
export async function signInWithPassword(email: string, password: string): Promise<void>
export async function signInWithGoogle(): Promise<void>                // redirectTo: `${origin}/residents`
export async function signUp(email: string, password: string): Promise<void>
export async function requestPasswordReset(email: string): Promise<void> // redirectTo: `${origin}/reset-password`
export async function updatePassword(newPassword: string): Promise<void>
export async function signOut(): Promise<void>
export async function getSession(): Promise<Session | null>
export function onAuthChange(callback: (session: Session | null) => void): () => void
export async function getMyAppUser(): Promise<AppUser | null>          // own app_users row, via RLS
```

**`catalogs.ts`**
```ts
export async function listCatalog(name: CatalogName): Promise<CatalogItem[]>   // [P2] includes inactive; order sort_order, code
export async function createCatalogItem(name: CatalogName, item: Omit<CatalogItem, 'updated_at'>): Promise<CatalogItem>  // [P3]
export async function updateCatalogItem(name: CatalogName, code: string, expectedUpdatedAt: string,
  patch: Partial<Pick<CatalogItem, 'labels' | 'sort_order' | 'active'>>): Promise<CatalogItem>                          // [P3]
```

**`settings.ts`**
```ts
export interface ShelterSettings { timezone: string; timezone_updated_at: string }
export async function getSettings(): Promise<ShelterSettings>                                       // [P2]
export async function updateTimezone(timezone: string, expectedUpdatedAt: string): Promise<void>    // [P3]
```

## api/ **[P3]**

**`people.ts`**
```ts
export interface PersonSearchResult { person_id: string; first_name: string; last_name: string | null;
  birth_date: string | null; birth_date_estimated: boolean; country_code: string | null; photo_path: string | null;
  score: number; last_entry_date: string | null; last_exit_date: string | null; has_open_stay: boolean }
export type DuplicateCandidate = Omit<PersonSearchResult, 'has_open_stay'>
export interface NewPersonInput { first_name: string; last_name?: string | null; birth_date?: string | null;
  birth_date_estimated?: boolean; gender_code?: string | null; country_code?: string | null;
  region?: string | null; carer_id?: string | null }
export type PersonPatch = Partial<NewPersonInput>
export async function searchPeople(query: string, limit?: number): Promise<PersonSearchResult[]>
export async function getPerson(id: string): Promise<Person>
export async function updatePerson(id: string, expectedUpdatedAt: string, patch: PersonPatch): Promise<Person>
export async function findPossibleDuplicates(input: { first_name: string; last_name?: string | null;
  birth_date?: string | null; country_code?: string | null }): Promise<DuplicateCandidate[]>
export async function registerAndCheckIn(person: NewPersonInput, stay: NewStayInput): Promise<{ person_id: string; stay_id: string }>
export async function mergePeople(survivorId: string, duplicateId: string): Promise<void>
```

**`stays.ts`**
```ts
export interface NewStayInput { entry_date?: string; case_type_code?: string | null; bed?: string | null;
  phone_status?: PhoneStatus; notes?: string | null }
export type StayPatch = Partial<NewStayInput> & { exit_date?: string | null }
export async function listCurrentResidents(): Promise<CurrentResident[]>
export async function listStaysForPerson(personId: string): Promise<Stay[]>       // newest entry first
export async function checkIn(personId: string, stay: NewStayInput): Promise<string>
export async function checkOut(stayId: string, exitDate?: string): Promise<void>
export async function updateStay(id: string, expectedUpdatedAt: string, patch: StayPatch): Promise<Stay>
export async function deleteStay(id: string): Promise<void>                       // admin
```

**`outings.ts`**
```ts
export async function startOuting(stayId: string, comment?: string | null, confirmException?: boolean): Promise<string>
export async function endOuting(stayId: string): Promise<string>
export async function listOutingsForStay(stayId: string): Promise<Outing[]>      // newest first
export async function updateOuting(id: string, expectedUpdatedAt: string,
  patch: Partial<Pick<Outing, 'left_at' | 'returned_at' | 'comment'>>): Promise<Outing>
export async function deleteOuting(id: string): Promise<void>                     // admin
```

**`photos.ts`**
```ts
export function photoPathFor(personId: string): string        // `${personId}.jpg`
export function thumbPathFor(photoPath: string): string       // `${id}_thumb.jpg`
export async function uploadPersonPhoto(personId: string, full: Blob, thumb: Blob): Promise<string>  // returns photo_path; also sets people.photo_path
export async function getSignedPhotoUrls(paths: string[], expiresInSeconds?: number): Promise<Record<string, string>> // default 600
```

**`users.ts`**
```ts
export async function listAppUsers(): Promise<AppUser[]>
export async function inviteUser(input: { email: string; role: AppRole; display_name: string }): Promise<AppUser>
export async function updateAppUser(email: string, expectedUpdatedAt: string,
  patch: Partial<Pick<AppUser, 'role' | 'display_name' | 'active'>>): Promise<AppUser>
```

**`audit.ts`**
```ts
export interface AuditFilters { table_name?: string; record_id?: string; actor_user_id?: string;
  from?: string; to?: string; limit?: number; offset?: number }
export async function listAuditLog(filters: AuditFilters): Promise<{ rows: AuditEntry[]; total: number }>
```

**RPC argument names** (from Plan 1):

| RPC | Arguments |
|---|---|
| `register_person_and_check_in` | `p_person` (jsonb), `p_stay` (jsonb) |
| `check_in` | `p_person_id`, `p_stay` |
| `check_out` | `p_stay_id`, `p_exit_date` |
| `start_outing` | `p_stay_id`, `p_comment`, `p_confirm_exception` |
| `end_outing` | `p_stay_id` |
| `find_possible_duplicates` | `p_first_name`, `p_last_name`, `p_birth_date`, `p_country_code` |
| `search_people` | `p_query`, `p_limit` |
| `merge_people` | `p_survivor_id`, `p_duplicate_id` |

## lib/ **[P2]**

**`text.ts`**
```ts
export function cleanText(value: string | null | undefined): string | null
```
- It strips leading and trailing whitespace: `\s`, U+00A0, U+2007, U+202F, U+FEFF.
- An empty result returns null.

**`shelterTime.ts`**
```ts
export function formatDate(value: string | Date | null | undefined, timeZone: string): string    // dd/MM/yyyy, '' for null
export function formatTime(value: string | Date | null | undefined, timeZone: string): string    // HH:mm
export function formatDateTime(value: string | Date | null | undefined, timeZone: string): string // dd/MM/yyyy HH:mm
export function todayIn(timeZone: string): string                                                 // YYYY-MM-DD
export function ageOn(birthDate: string | null, onDate: string): number | null
```

## stores/ **[P2]** (Pinia setup stores)

**`useSessionStore`** (`stores/session.ts`)
- **State:**
  - `status: 'loading' | 'signedOut' | 'pending' | 'ready'`
  - `session: Session | null`
  - `appUser: AppUser | null`
  - `operatorName: string | null`
- **Getters:**
  - `role: AppRole | null`
  - `isAdmin: boolean`
  - `needsOperatorName: boolean` (true when the role is volunteer and there is no operator name)
- **Actions:**
  - `init(): Promise<void>`: idempotent; subscribes to auth changes and loads `appUser`.
  - `refreshAppUser()`
  - `setOperatorName(name: string | null)`: persists to sessionStorage key `sb.operatorName` and calls `api/client.setOperatorName`.
  - `signOut()`: also clears the operator name.

**`useCatalogsStore`** (`stores/catalogs.ts`)
- **State:**
  - `items: Record<CatalogName, CatalogItem[]>`
  - `loaded: boolean`
- **Actions:**
  - `load(): Promise<void>`
  - `reload(name: CatalogName): Promise<void>`
- **Getters:**
  - `label(name: CatalogName, code: string | null | undefined): string`: the label for the current locale, falling back to `labels.es`, then to the code, then to `''`.
  - `options(name: CatalogName, keepCode?: string | null): { value: string; text: string }[]`: the active items sorted by `sort_order` then label, plus `keepCode` even when it is inactive.

**`useSettingsStore`** (`stores/settings.ts`)
- **State:**
  - `timezone: string` (default `'America/Mexico_City'`)
  - `timezoneUpdatedAt: string | null`
  - `loaded: boolean`
- **Actions:** `load()`

## composables/ **[P2]**

- **`useNotify()`** returns `{ success(key: string, params?: Record<string, unknown>): void; error(error: unknown): void }`.
  - `error` calls `toApiError` and shows `t(apiError.i18nKey)`.
  - It renders through `ToastHost`.
- **`useConfirm()`** returns `{ confirm(options: { titleKey: string; messageKey: string; messageParams?: Record<string, unknown>; confirmKey?: string; cancelKey?: string; danger?: boolean }): Promise<boolean> }`.
  - It renders through `ConfirmHost` (a Syncfusion Dialog).
- **`useShelterTime()`** returns `{ formatDate, formatTime, formatDateTime, today }`, bound to the settings store timezone (same signatures as `lib/shelterTime.ts` minus the `timeZone` argument).
- **`useOnline()`** returns `{ online: Ref<boolean> }`.

## components/common **[P2]**

- **`PageHeader.vue`**
  - Props: `titleKey: string`, `titleParams?: object`.
  - Slot: `actions`.
- **`CatalogSelect.vue`**: a Syncfusion DropDownList over `useCatalogsStore().options(catalog, modelValue)`.
  - Props: `catalog: CatalogName`, `modelValue: string | null`, `placeholderKey?: string`, `allowEmpty?: boolean`, `id?: string`.
  - Emits: `update:modelValue`.

## Router **[P2]** (`router/routes.ts`, `router/guards.ts`)

Route meta: `{ public?: boolean; roles?: AppRole[]; layout?: 'blank' | 'app' }`. Without `roles`, any active role may enter.

| Name | Path | Meta | View |
|---|---|---|---|
| `login` | `/login` | public, blank | LoginView |
| `reset-password` | `/reset-password` | public, blank | ResetPasswordView |
| `pending` | `/pending` | blank | PendingView |
| `shift` | `/shift` | roles [volunteer], blank | ShiftView |
| `residents` | `/residents` | app (`/` redirects here) | ResidentsView |
| `people-search` | `/people/search` | app | PeopleSearchView |
| `person-new` | `/people/new` | app | PersonNewView |
| `person` | `/people/:id` | app | PersonView |
| `admin-users` | `/admin/users` | roles [admin], app | admin/UsersView |
| `admin-catalogs` | `/admin/catalogs` | roles [admin], app | admin/CatalogsView |
| `admin-settings` | `/admin/settings` | roles [admin], app | admin/SettingsView |
| `admin-audit` | `/admin/audit` | roles [admin], app | admin/AuditView |
| `admin-merge` | `/admin/merge` | roles [admin], app | admin/MergeView |

Guard order:
1. Await `session.init()`.
2. A public route while signed in goes to `residents`.
3. Signed out goes to `login` with `?redirect=`.
4. `pending` status goes to `pending`.
5. A volunteer who needs an operator name goes to `shift` (unless already there).
6. A role not in `meta.roles` goes to `residents`.

Plan 2 creates every view file. Plan 3 views are placeholders in Plan 2 (a `PageHeader` only) and are replaced by Plan 3.

## i18n **[P2]**

- **`i18n/index.ts`:**
  - `export type AppLocale = 'es-MX'`
  - `export const i18n` (vue-i18n, composition mode, locale and fallback `es-MX`)
  - `export async function setLocale(locale: AppLocale): Promise<void>`: switches vue-i18n, Syncfusion `L10n` and culture, and `<html lang>`.
- **`i18n/syncfusion.ts`:** `export async function loadSyncfusionLocale(locale: AppLocale): Promise<void>`.
- **Namespaces in `locales/es-MX.json`:**
  - **[P2]:** `common`, `nav`, `auth`, `shift`, `errors` (every `ApiErrorCode`), `validation`, `phoneStatus` (`none`, `with_person`, `in_custody`), `presence` (`inside`, `outside`).
  - **[P3]:** `residents`, `registration`, `person`, `stays`, `outings`, `search`, `photos`, `admin.users`, `admin.catalogs`, `admin.settings`, `admin.audit`, `admin.merge`.
- **Missing keys fail tests:** the test setup makes a missing key throw.

## Tests **[P2]** utilities

- **`web/tests/setup.ts`:** Vitest setup. It registers the i18n missing-key handler that throws, and stubs `matchMedia`, `ResizeObserver` and anything else Syncfusion needs under jsdom.
- **`web/tests/utils/mountWithApp.ts`:**
  ```ts
  export function mountWithApp<C>(component: C, options?: {
    props?: Record<string, unknown>
    initialRoute?: string
    session?: Partial<{ role: AppRole | null; operatorName: string | null; status: string }>
    catalogs?: Partial<Record<CatalogName, CatalogItem[]>>
    timezone?: string
  }): Promise<{ wrapper: VueWrapper; router: Router }>
  ```
  It installs the real i18n, a Pinia instance pre-filled from the options, and a memory-history router with the real route names, paths and meta (route components stubbed, exported as `stubbedRoutes`).
- **Component tests mock `api/` modules** with `vi.mock('@/api/<module>')`.
- **`web/tests/integration/helpers.ts`:** `signInAs(role: AppRole): Promise<void>`, which signs the shared client in as the seeded user for that role.
- **`web/e2e/fixtures.ts`:**
  - `signIn(page: Page, role: AppRole, operatorName?: string): Promise<void>`
  - `uniqueName(prefix: string): string`
- **E2E assumptions:**
  - E2E tests assume a freshly reset local database (`npm run db:reset`).
  - Each test creates uniquely named data.
  - The Playwright `webServer` starts `npm run dev` on port 5173.
