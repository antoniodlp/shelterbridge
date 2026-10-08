# Registry and Stays, Plan 3: Web Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build every screen of sub-project 1 on top of the web foundation: the residents home with outings and check-out, registration with duplicate detection and photos, the person record, people search, and the admin screens (users, catalogs, settings, audit log, merge), plus the end-to-end flows from the spec.

**Architecture:** Each task is a vertical slice. It adds the `web/src/api/` functions one feature needs (the only code that talks to Supabase), the composables and components under `web/src/components/<feature>/`, the Spanish strings, unit and component tests with `@/api/*` mocked, and Vitest integration tests that call `api/` against the local Supabase stack. Syncfusion EJ2 Vue provides the Grid, date pickers, DropDownList and Dialog; Bootstrap 5 provides layout. Every rule (roles, dates, one open stay, outing exceptions) is enforced by Postgres; the UI mirrors the rules for fast feedback and turns `ApiError` codes into Spanish messages.

**Tech Stack:**
- Everything Plan 2 pinned: Node 24.15 or later, Vue 3.5, Vue Router 5, Pinia 4, vue-i18n 11, `@supabase/supabase-js` 2.117, Bootstrap 5.3, TypeScript 6.0, Vitest 4.1 with jsdom, `@vue/test-utils` 2.5, `@playwright/test` 1.64
- Syncfusion EJ2 Vue `~35.1.39`: Plan 2 installed `@syncfusion/ej2-vue-dropdowns`, `@syncfusion/ej2-vue-popups` and the theme `@syncfusion/ej2-bootstrap5.3-theme`; this plan adds `@syncfusion/ej2-vue-grids` and `@syncfusion/ej2-vue-calendars`

**Spec:** [docs/superpowers/specs/2026-10-07-shelterbridge-registry-and-stays-design.md](../specs/2026-10-07-shelterbridge-registry-and-stays-design.md)

**Contract:** [docs/superpowers/plans/2026-10-07-registry-and-stays-web-contract.md](2026-10-07-registry-and-stays-web-contract.md)

**Prerequisite:** Plan 1 (database) and Plan 2 (web foundation, [2026-10-07-registry-and-stays-2-web-foundation.md](2026-10-07-registry-and-stays-2-web-foundation.md)) are complete and merged. This plan consumes every item the contract marks **[P2]** exactly as the contract names and signs it, plus what Plan 2 lists under "Interfaces for Plan 3": `api/client.ts`, `api/errors.ts` (`ApiError`, `toApiError`, `isApiError`), `api/rows.ts` (`updateVersioned`), `api/catalogs.ts` (`listCatalog`), `api/settings.ts` (`getSettings`), `lib/text.ts` (`cleanText`), `lib/shelterTime.ts` (`formatDate`, `formatTime`, `formatDateTime`, `todayIn`, `ageOn`), the stores (`useSessionStore`, `useCatalogsStore`, `useSettingsStore`), the composables (`useNotify`, `useConfirm`, `useShelterTime`), `PageHeader` and `CatalogSelect`, the routes and guards (unchanged by this plan), `types/domain.ts`, the i18n namespaces `common`, `nav`, `auth`, `shift`, `errors`, `validation`, `phoneStatus` and `presence`, and the test utilities `mountWithApp`, `fakeAppUser` and `testCatalogs` (`tests/utils/mountWithApp.ts`), `signInAs`, `uniqueSuffix` and `supabase` (`tests/integration/helpers.ts`), and `signIn`, `uniqueName` and `dismissLicenseBanner` (`e2e/fixtures.ts`). It does not redefine or reimplement any of them. It delivers everything the contract marks **[P3]**.

## Global Constraints

- **Language and copy:** code, identifiers, comments and commit messages are in English. Every user-facing string goes through vue-i18n with `es-MX` as the source locale; each task lists the exact Spanish it adds to `web/src/i18n/locales/es-MX.json`. Never use em dashes or en dashes in any file, comment, string or commit message. In i18n messages never use `@`, `$`, `|`, `{` or `}` except for `{placeholders}`: vue-i18n treats them as syntax.
- **i18n keys:** new keys go only in the P3 namespaces: `residents`, `registration`, `person`, `stays`, `outings`, `search`, `photos`, `admin.users`, `admin.catalogs`, `admin.settings`, `admin.audit`, `admin.merge`. Keys Plan 2 already defines are reused, never redefined: page titles come from `nav.*` and `common.personRecord` (the residents page keeps the heading "Residentes", which `e2e/sign-in.spec.ts` checks), plain buttons use `common.save`, `common.cancel`, `common.reload` and `common.loading`, generic form errors use `validation.required`, `validation.email`, `validation.dateInFuture`, `validation.birthDateImplausible` and `validation.exitBeforeEntry`, and errors use `errors.<code>` through `useNotify().error`. Missing keys fail the test suite.
- **Boundaries:** only `web/src/api/` imports `@supabase/*`; Plan 3 code imports `@/api/client` only inside `src/api/` (integration tests reach the client through `tests/integration/helpers.ts`). Every `api/` function returns typed data or throws the `ApiError` produced by `toApiError`. Data objects keep the database's snake_case names.
- **Authorization lives in Postgres.** Admin-only buttons are hidden with `useSessionStore().isAdmin` for convenience only. This plan does not change the router or its guards.
- **Syncfusion usage (verified with 35.1.39 under jsdom):**
  - Each new component's CSS is imported in `web/src/main.ts` from `@syncfusion/ej2-bootstrap5.3-theme/styles/<component>/<component>.css`, with the dependencies its `index.css` lists (Task 1 adds the Grid's, which cover the date pickers).
  - DatePicker, DateTimePicker and DropDownList are bound with `:value` and `@change`, never `v-model`: with `v-model`, later programmatic changes do not reach the control. Emit only when the value really changes.
  - A DropDownList whose options load asynchronously is mounted only after the options arrive (`v-if`), otherwise it does not show the selected text.
  - Dialogs stay mounted and bind `visible` (a shown modal Dialog removed with `v-if` throws `NotFoundError`). The content inside the Dialog uses `v-if`, so each opening starts clean. Closing by Escape or the close icon is reported through `@close` when `args.isInteracted` is true. Dialog DOM lives in `document.body`.
  - Grid cell templates use `:template="'name'"` on `<e-column>` plus `<template #name="{ data }">` inside it. Everything a cell shows (labels, busy flags, thumbnail URLs) is precomputed into the row objects, so a new `data-source` array re-renders the cells. Actions emit the row's `stay_id`, not the row object.
  - Pass `enableAdaptiveUI` and `rowRenderingMode` to the Grid through a `v-bind` object; other attributes are written hyphenated (`:data-source`, `:header-text`).
  - Never pass personal data into Syncfusion string props that are rendered as HTML (for example a Dialog `header` or `content`). Names are rendered by Vue templates, which escape them; plain Grid cells, Grid checkbox filter lists and DropDownList items encode HTML themselves (verified with 35.1.39), and Plan 2's `ToastHost` and `ConfirmHost` escape the toast and confirm texts this plan fills with names.
- **Dates and times:** dates and instants are shown with `useShelterTime().formatDate` and `formatDateTime` (Plan 2 formats `YYYY-MM-DD` values as-is, so a calendar day never shifts). "Today" is `useShelterTime().today()`. Date pickers convert with `toLocalDate` and `fromLocalDate`; times the user edits are shelter wall-clock times converted with `toWallClock` and `fromWallClock` (all in `lib/dates.ts`). Never parse a date-only value with `new Date('YYYY-MM-DD')`.
- **Same-day stays (Plan 1 decision):** a stay occupies `[entry_date, exit_date)`, so a person checked out today can normally be checked in again today. The exception is a stay that started and ended today: it occupies today, so a new stay today fails with `overlapping_stays`. The person record lets any role reopen that stay (Task 7), and the check-in form explains this when it gets `overlapping_stays` (Task 6).
- **Outing times (Plan 1 decision):** starting and ending an outing always goes through `start_outing` and `end_outing`, which use the server clock. Edited outing times default to the recorded values and are capped at the current time in the shelter timezone.
- **Racing check-ins (Plan 1 decision):** a check-in that loses a race with another computer fails with `already_checked_in`; the UI reloads the record when it sees that code.
- **Privacy:** no personal data in URLs (route params and query strings carry UUIDs or flags only; search text stays in component state), console output or error messages. Photos are shown only through signed URLs that last 10 minutes. All test and e2e data is fictitious.
- **Stores:** `AppShell` loads the catalogs and settings stores, so views rely on them. Views call `reload()` or `load()` only after an admin edit, and `useSettingsStore().load()` again after changing the timezone. `ToastHost` and `ConfirmHost` are already mounted in `App.vue`.
- **Test conventions:**
  - Component and view tests use `mountWithApp` (defaults: route `/residents`, role `volunteer`, operator `'Turno de prueba'`, timezone `America/Mexico_City`, `testCatalogs`; it mounts on `document.body` with real store actions). Every test file that mounts clears `document.body.innerHTML` in `afterEach`.
  - Each test file mocks every `@/api/*` module the code under test calls, with an explicit `vi.mock` factory at the top level of the file, and mocks `@/composables/useNotify` and `@/composables/useConfirm` with `vi.hoisted` spies.
  - Grid rows are awaited with `vi.waitFor` on `.e-row` and `{ timeout: 5000 }`, because a Grid can take more than the default second to render when the whole suite runs in parallel; Plan 2 sets the unit project's `testTimeout` to 15 seconds so these waits fit inside one test. `mountWithApp` uses `stubbedRoutes` (route components stubbed), so navigations in tests never wait for a lazy import; any test that builds its own router uses `stubbedRoutes` too. Dialog content is found through `body()` from `tests/utils/syncfusion.ts`. Date and time inputs are driven with `typeInto()` from the same file, which types like a person and leaves the field (verified with 35.1.39).
  - Test ids use the `data-testid` attribute, which Playwright's `getByTestId` reads.
  - Integration tests call `signInAs(role)` and create their own data with `tests/integration/factories.ts`; they never depend on seeded people.
  - E2E tests use `signIn`, `uniqueName` and `dismissLicenseBanner` from `e2e/fixtures.ts` (the banner is dismissed after every `page.goto`) and assume a freshly reset database (`npm run db:reset`).
- **Commands** run from the repository root in Git Bash. Single files run with `npm --prefix web run test -- <file>`, `npm --prefix web run test:integration -- <file>` and `npm --prefix web run e2e -- <file>`. Integration tests and e2e need the local stack (`npm run db:start`), `web/.env.local`, and a fresh `npm run db:reset`.

## Review Focus

1. **The residents page stays open all day at reception.** Signed thumbnail URLs expire after 10 minutes. Every reload re-signs URLs that are about to expire, and an image that fails to load falls back to the person's initials instead of a broken image. Tests: Task 1 (`useThumbnails` expiry, `PersonThumb` error fallback).
2. **Two reception computers act on the same person.** A row action on a list that is out of date (`outing_already_open`, `no_open_outing`, `stay_not_open`) shows the translated error and reloads the list so the row shows the real state. Tests: Task 2 (`no_open_outing`) and Task 3 (`stay_not_open`).
3. **Double clicks.** Clicking "Registrar e ingresar" or a row action twice sends one request, not two. Tests: Task 4 (registration) and Task 2 (row action).
4. **Calendar days and times shifted by a timezone.** A date picked or typed in a form saves as the same calendar day whatever the browser's timezone is, and edited outing times are read as shelter wall-clock times. Tests: Task 3 (`fromLocalDate`, `DateField` round trip) and Task 7 (wall clock in the shelter timezone, typed outing time).
5. **No webcam, or camera permission denied.** The photo step shows a clear message and the file or phone camera input still works. Tests: Task 8.

---

## File Structure

```
web/src/
  main.ts               + Grid and date picker theme CSS                          (Task 1)
  api/
    stays.ts            listCurrentResidents, checkOut, NewStayInput, StayPatch, cleanStay,
                        listStaysForPerson, checkIn, updateStay, deleteStay           (Tasks 1, 3, 4, 6, 7)
    outings.ts          startOuting, endOuting, listOutingsForStay, updateOuting, deleteOuting (Tasks 2, 6, 7)
    people.ts           NewPersonInput, PersonPatch, registerAndCheckIn, PersonSearchResult,
                        DuplicateCandidate, findPossibleDuplicates, getPerson, updatePerson,
                        searchPeople, mergePeople                                      (Tasks 4, 5, 6, 9, 13)
    photos.ts           photoPathFor, thumbPathFor, getSignedPhotoUrls, uploadPersonPhoto (Tasks 1, 8)
    users.ts            listAppUsers, inviteUser, updateAppUser                       (Task 10)
    catalogs.ts         + createCatalogItem, updateCatalogItem                        (Task 11)
    settings.ts         + updateTimezone                                              (Task 12)
    audit.ts            AuditFilters, listAuditLog                                    (Task 12)
  lib/
    dates.ts            date picker values (Task 3), shelter wall clock (Task 7)
    people.ts           fullName, formatAge, normalizeForSearch, initials             (Task 1)
    imageResize.ts      fitWithin, resizeToJpeg, makePhotoPair, PhotoPair             (Task 8)
  composables/
    useThumbnails.ts    batched, expiry-aware signed thumbnail URLs                   (Task 1)
    useResidents.ts     residents list, rows, headcount, quick search                 (Task 1)
    useDuplicateCheck.ts debounced duplicate lookup                                   (Task 5)
    usePendingPhotos.ts photos waiting for a retry, kept in memory                    (Task 8)
  components/
    forms/DateField.vue, forms/DateTimeField.vue, forms/fieldErrors.ts                (Tasks 3, 7, 4)
    residents/HeadcountBar.vue, residents/ResidentsGrid.vue                           (Tasks 1 to 3)
    outings/OutingStartDialog.vue, outings/OutingList.vue,
      outings/OutingEditDialog.vue, outings/outingFormModel.ts                        (Tasks 2, 6, 7)
    stays/CheckOutDialog.vue, stays/StayForm.vue, stays/stayFormModel.ts,
      stays/StayHistory.vue, stays/StayEditDialog.vue                                 (Tasks 3, 4, 6, 7)
    people/PersonThumb.vue, people/PersonForm.vue, people/personFormModel.ts,
      people/CarerPicker.vue, people/DuplicatePanel.vue, people/PersonDetails.vue,
      people/PhotoCapture.vue, people/PersonPhoto.vue                                 (Tasks 1, 4, 5, 6, 8)
    admin/CatalogItemDialog.vue, admin/catalogItemModel.ts, admin/auditChanges.ts,
      admin/MergePersonPicker.vue, admin/MergeSideCard.vue, admin/mergeOverlaps.ts    (Tasks 11 to 13)
  views/                replaces the Plan 2 placeholders
    ResidentsView.vue (1 to 3), PersonNewView.vue (4, 5, 8), PersonView.vue (6 to 8),
    PeopleSearchView.vue (9), admin/UsersView.vue (10), admin/CatalogsView.vue (11),
    admin/SettingsView.vue (12), admin/AuditView.vue (12), admin/MergeView.vue (13)
  i18n/locales/es-MX.json   P3 namespaces
web/tests/
  fixtures/data.ts      fictitious rows for component tests                       (Task 1)
  utils/syncfusion.ts   body(), typeInto()                                        (Task 1)
  lib/, composables/, components/, views/   unit and component tests, mirroring src/
  integration/factories.ts                  people and stays created through the client (Task 1)
  integration/*.test.ts                     one file per task
web/e2e/
  steps.ts              registerPerson and shelter-date helpers                   (Task 14)
  registration.spec.ts, returning-person.spec.ts, daily-operations.spec.ts       (Task 14)
```

---
### Task 1: Residents home with headcount and thumbnails

**Files:**
- Modify: `web/package.json`, `web/src/main.ts`
- Create: `web/src/lib/people.ts`
- Create: `web/src/api/stays.ts`, `web/src/api/photos.ts`
- Create: `web/src/composables/useThumbnails.ts`, `web/src/composables/useResidents.ts`
- Create: `web/src/components/people/PersonThumb.vue`, `web/src/components/residents/HeadcountBar.vue`, `web/src/components/residents/ResidentsGrid.vue`
- Replace: `web/src/views/ResidentsView.vue`
- Modify: `web/src/i18n/locales/es-MX.json`
- Create tests: `web/tests/fixtures/data.ts`, `web/tests/utils/syncfusion.ts`, `web/tests/lib/people.test.ts`, `web/tests/api/photos.test.ts`, `web/tests/composables/useThumbnails.test.ts`, `web/tests/composables/useResidents.test.ts`, `web/tests/components/people/PersonThumb.test.ts`, `web/tests/components/residents/HeadcountBar.test.ts`, `web/tests/views/ResidentsView.test.ts`, `web/tests/integration/factories.ts`, `web/tests/integration/residents.test.ts`

**Interfaces:**
- Consumes: `supabase` (`@/api/client`), `toApiError` (`@/api/errors`), `CurrentResident`, `Presence`, `PhoneStatus` (`@/types/domain`), `useCatalogsStore().label`, `useShelterTime().formatDate` and `formatDateTime`, `useNotify().error`, `PageHeader`, `mountWithApp` and `testCatalogs`, `signInAs`, `supabase` and `uniqueSuffix` (integration helpers), `todayIn` (`@/lib/shelterTime`).
- Produces:
  - `fullName(first, last): string`, `formatAge(age: number | null | undefined, estimated: boolean | null | undefined): string`, `normalizeForSearch(value): string`, `initials(name: string): string` in `lib/people.ts`.
  - `listCurrentResidents(): Promise<CurrentResident[]>` in `api/stays.ts`.
  - `photoPathFor(personId): string`, `thumbPathFor(photoPath): string`, `getSignedPhotoUrls(paths: string[], expiresInSeconds = 600): Promise<Record<string, string>>` in `api/photos.ts`.
  - `useThumbnails(): { load(photoPaths: Array<string | null | undefined>): Promise<void>; thumbUrl(photoPath: string | null | undefined): string | null }`.
  - In `composables/useResidents.ts`: `HeadcountSummary`, `ResidentRow` (fields listed in the code below), `countResidents(residents): HeadcountSummary`, `matchesQuery(row, query): boolean`, and `useResidents(): { rows, counts, loading, query, busyStayId, findRow(stayId), reload() }`.
  - `PersonThumb` (props `url: string | null`, `name: string`, `size?: number`), `HeadcountBar` (prop `summary: HeadcountSummary`), `ResidentsGrid` (prop `rows: ResidentRow[]`).
  - Test helpers: `tests/fixtures/data.ts` (`STAMP`, `uuid(n)`, `makeResident`, `makePerson`, `makeStay`, `makeOuting`, `makeAuditEntry`), `tests/utils/syncfusion.ts` (`body()`, `typeInto(input, text)`), `tests/integration/factories.ts` (`daysAgo(days)`, `createPerson(fields?)`, `createStay(personId, fields?)`, `createResident(person?, stay?)`).

- [ ] **Step 1: Add the Grid and date picker packages and their styles**

Run: `npm --prefix web install @syncfusion/ej2-vue-grids@~35.1.39 @syncfusion/ej2-vue-calendars@~35.1.39`

Expected: both appear in `web/package.json` with `~35.1.39`. Then run `npm --prefix web ls @syncfusion/ej2-base` and check that every line shows the same version (`deduped`).

In `web/src/main.ts`, add these imports right after the last `@syncfusion/ej2-bootstrap5.3-theme` import. They are the Grid's dependencies from `styles/grid/index.css` that Plan 2 does not import yet, in that file's order, and they include everything the DatePicker and DateTimePicker need:

```ts
import '@syncfusion/ej2-bootstrap5.3-theme/styles/pager/pager.css'
import '@syncfusion/ej2-bootstrap5.3-theme/styles/numerictextbox/numerictextbox.css'
import '@syncfusion/ej2-bootstrap5.3-theme/styles/radio-button/radio-button.css'
import '@syncfusion/ej2-bootstrap5.3-theme/styles/check-box/check-box.css'
import '@syncfusion/ej2-bootstrap5.3-theme/styles/auto-complete/auto-complete.css'
import '@syncfusion/ej2-bootstrap5.3-theme/styles/datepicker/datepicker.css'
import '@syncfusion/ej2-bootstrap5.3-theme/styles/calendar/calendar.css'
import '@syncfusion/ej2-bootstrap5.3-theme/styles/datetimepicker/datetimepicker.css'
import '@syncfusion/ej2-bootstrap5.3-theme/styles/list-view/list-view.css'
import '@syncfusion/ej2-bootstrap5.3-theme/styles/context-menu/context-menu.css'
import '@syncfusion/ej2-bootstrap5.3-theme/styles/excel-filter/excel-filter.css'
import '@syncfusion/ej2-bootstrap5.3-theme/styles/tooltip/tooltip.css'
import '@syncfusion/ej2-bootstrap5.3-theme/styles/timepicker/timepicker.css'
import '@syncfusion/ej2-bootstrap5.3-theme/styles/h-scroll/h-scroll.css'
import '@syncfusion/ej2-bootstrap5.3-theme/styles/v-scroll/v-scroll.css'
import '@syncfusion/ej2-bootstrap5.3-theme/styles/toolbar/toolbar.css'
import '@syncfusion/ej2-bootstrap5.3-theme/styles/grid/grid.css'
```

Run: `npm --prefix web run build`

Expected: it ends with `built in`.

- [ ] **Step 2: Add the shared test fixtures and helpers**

Create `web/tests/fixtures/data.ts`:

```ts
// Fictitious rows for component tests. None of these people exist.
// Catalogs and app users come from Plan 2: testCatalogs and fakeAppUser in tests/utils/mountWithApp.ts.
import type { AuditEntry, CurrentResident, Outing, Person, Stay } from '@/types/domain'

export const STAMP = '2026-10-01T15:00:00+00:00'

/** uuid(1) is 00000000-0000-4000-8000-000000000001. */
export function uuid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
}

export function makeResident(overrides: Partial<CurrentResident> = {}): CurrentResident {
  return {
    stay_id: uuid(101),
    person_id: uuid(1),
    first_name: 'Rosa Elena',
    last_name: 'Pérez Lara',
    photo_path: null,
    gender_code: 'female',
    country_code: 'HN',
    region: null,
    birth_date: '1996-04-12',
    birth_date_estimated: false,
    age: 30,
    carer_id: null,
    bed: 'A1',
    entry_date: '2026-10-03',
    days_in_shelter: 4,
    case_type_code: 'migrant_in_transit',
    phone_status: 'none',
    notes: null,
    stay_updated_at: STAMP,
    presence: 'inside',
    out_since: null,
    open_outing_id: null,
    outings_today: 0,
    is_minor: false,
    is_unaccompanied_minor: false,
    ...overrides,
  }
}

export function makePerson(overrides: Partial<Person> = {}): Person {
  return {
    id: uuid(1),
    first_name: 'Rosa Elena',
    last_name: 'Pérez Lara',
    birth_date: '1996-04-12',
    birth_date_estimated: false,
    gender_code: 'female',
    country_code: 'HN',
    region: 'Cortés',
    carer_id: null,
    photo_path: null,
    search_name: 'rosa elena perez lara',
    merged_into_id: null,
    source: 'app',
    created_at: STAMP,
    created_by: null,
    updated_at: STAMP,
    updated_by: null,
    ...overrides,
  }
}

export function makeStay(overrides: Partial<Stay> = {}): Stay {
  return {
    id: uuid(101),
    person_id: uuid(1),
    entry_date: '2026-10-03',
    exit_date: null,
    case_type_code: 'migrant_in_transit',
    bed: 'A1',
    phone_status: 'with_person',
    notes: null,
    source: 'app',
    created_at: STAMP,
    created_by: null,
    updated_at: STAMP,
    updated_by: null,
    ...overrides,
  }
}

export function makeOuting(overrides: Partial<Outing> = {}): Outing {
  return {
    id: uuid(201),
    stay_id: uuid(101),
    left_at: '2026-10-06T16:00:00+00:00',
    returned_at: '2026-10-06T18:30:00+00:00',
    is_exception: false,
    comment: null,
    created_at: STAMP,
    created_by: null,
    updated_at: STAMP,
    updated_by: null,
    ...overrides,
  }
}

export function makeAuditEntry(overrides: Partial<AuditEntry> = {}): AuditEntry {
  return {
    id: 1,
    at: '2026-10-06T16:00:00+00:00',
    actor_user_id: uuid(301),
    actor_role: 'volunteer',
    operator_name: 'Ana, Luis',
    table_name: 'people',
    record_id: uuid(1),
    action: 'update',
    old_data: { last_name: 'Pérez' },
    new_data: { last_name: 'Pérez Lara' },
    ...overrides,
  }
}
```

Create `web/tests/utils/syncfusion.ts`:

```ts
import { DOMWrapper, flushPromises } from '@vue/test-utils'

/** Syncfusion dialogs move their content to document.body, outside the mounted wrapper. */
export function body(): DOMWrapper<HTMLElement> {
  return new DOMWrapper(document.body)
}

/** Types into a Syncfusion date or date-time input the way a person does, then leaves the field. */
export async function typeInto(input: DOMWrapper<Element>, text: string): Promise<void> {
  const element = input.element as HTMLInputElement
  element.value = text
  await input.trigger('input')
  await input.trigger('change')
  await input.trigger('blur')
  await flushPromises()
}
```

- [ ] **Step 3: Write the failing test for the name helpers**

Create `web/tests/lib/people.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { formatAge, fullName, initials, normalizeForSearch } from '@/lib/people'

describe('fullName', () => {
  it('joins first and last names', () => {
    expect(fullName('Rosa Elena', 'Pérez Lara')).toBe('Rosa Elena Pérez Lara')
  })

  it('handles a single name', () => {
    expect(fullName('Wilmer', null)).toBe('Wilmer')
  })
})

describe('formatAge', () => {
  it('marks an estimated age with a tilde', () => {
    expect(formatAge(25, true)).toBe('~25')
    expect(formatAge(25, false)).toBe('25')
  })

  it('is empty when the age is unknown', () => {
    expect(formatAge(null, false)).toBe('')
  })
})

describe('normalizeForSearch', () => {
  it('drops accents, case and extra spaces', () => {
    expect(normalizeForSearch('  José   ÑÚÑEZ ')).toBe('jose nunez')
  })
})

describe('initials', () => {
  it('uses the first letter of the first two words', () => {
    expect(initials('rosa elena pérez')).toBe('RE')
  })

  it('handles an empty name', () => {
    expect(initials('')).toBe('')
  })
})
```

- [ ] **Step 4: Run it to verify it fails**

Run: `npm --prefix web run test -- tests/lib/people.test.ts`

Expected: FAIL, because `@/lib/people` does not exist yet.

- [ ] **Step 5: Implement the name helpers**

Create `web/src/lib/people.ts`:

```ts
export function fullName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
): string {
  return [firstName, lastName]
    .map((part) => (part ?? '').trim())
    .filter((part) => part !== '')
    .join(' ')
}

/** "25", or "~25" when the birth date is an estimate. Empty when the age is unknown. */
export function formatAge(
  age: number | null | undefined,
  estimated: boolean | null | undefined,
): string {
  if (age === null || age === undefined) return ''
  return estimated ? `~${age}` : String(age)
}

/** Lowercase, without accents and with single spaces, for matching on the client. */
export function normalizeForSearch(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter((part) => part !== '')
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}
```

- [ ] **Step 6: Run it to verify it passes**

Run: `npm --prefix web run test -- tests/lib/people.test.ts`

Expected: PASS.

- [ ] **Step 7: Write the failing tests for thumbnails, the headcount and the row helpers**

Create `web/tests/composables/useThumbnails.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getSignedPhotoUrls } from '@/api/photos'
import { useThumbnails } from '@/composables/useThumbnails'

vi.mock('@/api/photos', () => ({
  thumbPathFor: (path: string) => path.replace(/\.jpg$/, '_thumb.jpg'),
  getSignedPhotoUrls: vi.fn(),
}))

const signed = vi.mocked(getSignedPhotoUrls)

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-07T15:00:00Z'))
  signed.mockReset()
  signed.mockImplementation(async (paths: string[]) =>
    Object.fromEntries(paths.map((path) => [path, `https://storage.test/${path}?token=1`])),
  )
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useThumbnails', () => {
  it('signs every thumbnail in one request and skips people without a photo', async () => {
    const thumbs = useThumbnails()
    await thumbs.load(['a.jpg', null, 'b.jpg', 'a.jpg', undefined])
    expect(signed).toHaveBeenCalledTimes(1)
    expect(signed).toHaveBeenCalledWith(['a_thumb.jpg', 'b_thumb.jpg'], 600)
    expect(thumbs.thumbUrl('a.jpg')).toBe('https://storage.test/a_thumb.jpg?token=1')
    expect(thumbs.thumbUrl(null)).toBeNull()
  })

  it('reuses URLs that are still fresh', async () => {
    const thumbs = useThumbnails()
    await thumbs.load(['a.jpg'])
    vi.setSystemTime(new Date('2026-10-07T15:05:00Z'))
    await thumbs.load(['a.jpg'])
    expect(signed).toHaveBeenCalledTimes(1)
  })

  it('signs again shortly before a URL expires, for a page left open all day', async () => {
    const thumbs = useThumbnails()
    await thumbs.load(['a.jpg'])
    vi.setSystemTime(new Date('2026-10-07T15:09:30Z'))
    await thumbs.load(['a.jpg'])
    expect(signed).toHaveBeenCalledTimes(2)
  })

  it('keeps working when signing fails', async () => {
    signed.mockRejectedValueOnce(new Error('offline'))
    const thumbs = useThumbnails()
    await expect(thumbs.load(['a.jpg'])).resolves.toBeUndefined()
    expect(thumbs.thumbUrl('a.jpg')).toBeNull()
  })
})
```

Create `web/tests/composables/useResidents.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { countResidents, matchesQuery } from '@/composables/useResidents'
import { makeResident } from '../fixtures/data'

vi.mock('@/api/stays', () => ({ listCurrentResidents: vi.fn() }))
vi.mock('@/api/photos', () => ({
  thumbPathFor: (path: string) => path.replace(/\.jpg$/, '_thumb.jpg'),
  getSignedPhotoUrls: vi.fn(),
}))

describe('countResidents', () => {
  it('counts presence, minors and unaccompanied minors', () => {
    const summary = countResidents([
      makeResident(),
      makeResident({ presence: 'outside' }),
      makeResident({ is_minor: true, is_unaccompanied_minor: false }),
      makeResident({ is_minor: true, is_unaccompanied_minor: true, presence: 'outside' }),
      makeResident({ age: null, is_minor: null }),
    ])
    expect(summary).toEqual({ total: 5, inside: 3, outside: 2, minors: 2, unaccompanied: 1 })
  })
})

describe('matchesQuery', () => {
  const row = { full_name: 'Rosa Elena Pérez Lara', bed: 'A1' }

  it('matches names without accents or case', () => {
    expect(matchesQuery(row, 'perez')).toBe(true)
    expect(matchesQuery(row, 'ROSA ELENA')).toBe(true)
  })

  it('matches the bed', () => {
    expect(matchesQuery(row, 'a1')).toBe(true)
  })

  it('treats a blank query as a match', () => {
    expect(matchesQuery(row, '   ')).toBe(true)
  })

  it('rejects other names', () => {
    expect(matchesQuery(row, 'tomás')).toBe(false)
  })
})
```

Create `web/tests/api/photos.test.ts` (a unit test: it never reaches Supabase):

```ts
import { describe, expect, it } from 'vitest'
import { getSignedPhotoUrls, photoPathFor, thumbPathFor } from '@/api/photos'

const id = '00000000-0000-4000-8000-000000000001'

describe('photo paths', () => {
  it('builds object names from the person id only', () => {
    expect(photoPathFor(id)).toBe(`${id}.jpg`)
    expect(thumbPathFor(`${id}.jpg`)).toBe(`${id}_thumb.jpg`)
  })

  it('does not call storage when there is nothing to sign', async () => {
    await expect(getSignedPhotoUrls([])).resolves.toEqual({})
  })
})
```

Create `web/tests/components/people/PersonThumb.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest'
import PersonThumb from '@/components/people/PersonThumb.vue'
import { mountWithApp } from '../../utils/mountWithApp'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('PersonThumb', () => {
  it('shows the photo with an accessible name', async () => {
    const { wrapper } = await mountWithApp(PersonThumb, {
      props: { url: 'https://storage.test/t.jpg', name: 'Rosa Pérez' },
    })
    const img = wrapper.find('img')
    expect(img.attributes('src')).toBe('https://storage.test/t.jpg')
    expect(img.attributes('alt')).toBe('Foto de Rosa Pérez')
  })

  it('shows initials when there is no photo', async () => {
    const { wrapper } = await mountWithApp(PersonThumb, { props: { url: null, name: 'Rosa Pérez' } })
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toBe('RP')
  })

  it('falls back to initials when the image fails, for example an expired URL', async () => {
    const { wrapper } = await mountWithApp(PersonThumb, {
      props: { url: 'https://storage.test/expired.jpg', name: 'Rosa Pérez' },
    })
    await wrapper.find('img').trigger('error')
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toBe('RP')
  })
})
```

Create `web/tests/components/residents/HeadcountBar.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest'
import HeadcountBar from '@/components/residents/HeadcountBar.vue'
import { mountWithApp } from '../../utils/mountWithApp'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('HeadcountBar', () => {
  it('shows each count with its label', async () => {
    const { wrapper } = await mountWithApp(HeadcountBar, {
      props: { summary: { total: 12, inside: 9, outside: 3, minors: 2, unaccompanied: 1 } },
    })
    expect(wrapper.find('[data-testid="count-total"]').text()).toBe('12')
    expect(wrapper.find('[data-testid="count-inside"]').text()).toBe('9')
    expect(wrapper.find('[data-testid="count-outside"]').text()).toBe('3')
    expect(wrapper.find('[data-testid="count-minors"]').text()).toBe('2')
    expect(wrapper.find('[data-testid="count-unaccompanied"]').text()).toBe('1')
    expect(wrapper.text()).toContain('Menores sin acompañante')
  })

  it('highlights unaccompanied minors only when there are some', async () => {
    const some = await mountWithApp(HeadcountBar, {
      props: { summary: { total: 1, inside: 1, outside: 0, minors: 1, unaccompanied: 1 } },
    })
    expect(some.wrapper.find('[data-testid="count-unaccompanied"]').classes()).toContain('text-danger')
    const none = await mountWithApp(HeadcountBar, {
      props: { summary: { total: 1, inside: 1, outside: 0, minors: 0, unaccompanied: 0 } },
    })
    expect(none.wrapper.find('[data-testid="count-unaccompanied"]').classes()).not.toContain('text-danger')
  })
})
```

- [ ] **Step 8: Run them to verify they fail**

Run: `npm --prefix web run test -- tests/api/photos.test.ts tests/composables tests/components`

Expected: FAIL, because `@/api/photos`, the composables and the components do not exist yet.

- [ ] **Step 9: Implement photos, thumbnails, rows, the headcount bar and the thumbnail component**

Create `web/src/api/photos.ts`:

```ts
import { supabase } from './client'
import { toApiError } from './errors'

const BUCKET = 'person-photos'

/** Photo paths contain only the person's UUID, never a name. */
export function photoPathFor(personId: string): string {
  return `${personId}.jpg`
}

export function thumbPathFor(photoPath: string): string {
  return photoPath.replace(/\.jpg$/, '_thumb.jpg')
}

/** Signs many paths in one request. Paths whose object is missing are left out. */
export async function getSignedPhotoUrls(
  paths: string[],
  expiresInSeconds = 600,
): Promise<Record<string, string>> {
  const unique = [...new Set(paths)]
  if (unique.length === 0) return {}
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(unique, expiresInSeconds)
  if (error) throw toApiError(error)
  const urls: Record<string, string> = {}
  for (const entry of data) {
    if (entry.path && entry.signedUrl) urls[entry.path] = entry.signedUrl
  }
  return urls
}
```

Create `web/src/composables/useThumbnails.ts`:

```ts
import { ref } from 'vue'
import { getSignedPhotoUrls, thumbPathFor } from '@/api/photos'

const URL_SECONDS = 600
// Re-sign a minute early so a URL never expires while it is on screen.
const REFRESH_MARGIN_MS = 60_000

interface SignedUrl {
  url: string
  expiresAt: number
}

export function useThumbnails() {
  const signed = ref<Record<string, SignedUrl>>({})

  async function load(photoPaths: Array<string | null | undefined>): Promise<void> {
    const now = Date.now()
    const wanted = [
      ...new Set(photoPaths.filter((path): path is string => !!path).map(thumbPathFor)),
    ]
    const stale = wanted.filter((path) => {
      const entry = signed.value[path]
      return !entry || entry.expiresAt - REFRESH_MARGIN_MS <= now
    })
    if (stale.length === 0) return
    try {
      const urls = await getSignedPhotoUrls(stale, URL_SECONDS)
      const expiresAt = now + URL_SECONDS * 1000
      const next = { ...signed.value }
      for (const [path, url] of Object.entries(urls)) next[path] = { url, expiresAt }
      signed.value = next
    } catch {
      // Thumbnails are optional: rows show initials instead.
    }
  }

  function thumbUrl(photoPath: string | null | undefined): string | null {
    if (!photoPath) return null
    return signed.value[thumbPathFor(photoPath)]?.url ?? null
  }

  return { load, thumbUrl }
}
```

Create `web/src/composables/useResidents.ts`:

```ts
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { listCurrentResidents } from '@/api/stays'
import { useNotify } from '@/composables/useNotify'
import { useShelterTime } from '@/composables/useShelterTime'
import { useThumbnails } from '@/composables/useThumbnails'
import { formatAge, fullName, normalizeForSearch } from '@/lib/people'
import { useCatalogsStore } from '@/stores/catalogs'
import type { CurrentResident, PhoneStatus, Presence } from '@/types/domain'

export interface HeadcountSummary {
  total: number
  inside: number
  outside: number
  minors: number
  unaccompanied: number
}

/** One grid row. Everything a cell shows is precomputed here. */
export interface ResidentRow {
  stay_id: string
  person_id: string
  full_name: string
  photo_path: string | null
  thumb_url: string | null
  age: number | null
  age_label: string
  gender_label: string
  country_label: string
  bed: string
  entry_date: string
  entry_date_label: string
  days_in_shelter: number
  presence: Presence
  presence_label: string
  out_since: string | null
  out_since_label: string
  outings_today: number
  phone_status: PhoneStatus
  is_minor: boolean
  is_unaccompanied_minor: boolean
  busy: boolean
}

export function countResidents(residents: CurrentResident[]): HeadcountSummary {
  return {
    total: residents.length,
    inside: residents.filter((r) => r.presence !== 'outside').length,
    outside: residents.filter((r) => r.presence === 'outside').length,
    minors: residents.filter((r) => r.is_minor === true).length,
    unaccompanied: residents.filter((r) => r.is_unaccompanied_minor === true).length,
  }
}

export function matchesQuery(row: Pick<ResidentRow, 'full_name' | 'bed'>, query: string): boolean {
  const needle = normalizeForSearch(query)
  if (!needle) return true
  return (
    normalizeForSearch(row.full_name).includes(needle) || normalizeForSearch(row.bed).includes(needle)
  )
}

export function useResidents() {
  const { t } = useI18n()
  const notify = useNotify()
  const catalogs = useCatalogsStore()
  const time = useShelterTime()
  const thumbs = useThumbnails()

  const residents = ref<CurrentResident[]>([])
  const loading = ref(false)
  const query = ref('')
  const busyStayId = ref<string | null>(null)

  const counts = computed(() => countResidents(residents.value))

  function toRow(resident: CurrentResident): ResidentRow {
    const presence: Presence = resident.presence === 'outside' ? 'outside' : 'inside'
    return {
      stay_id: resident.stay_id ?? '',
      person_id: resident.person_id ?? '',
      full_name: fullName(resident.first_name, resident.last_name),
      photo_path: resident.photo_path,
      thumb_url: thumbs.thumbUrl(resident.photo_path),
      age: resident.age,
      age_label: formatAge(resident.age, resident.birth_date_estimated),
      gender_label: catalogs.label('genders', resident.gender_code),
      country_label: catalogs.label('countries', resident.country_code),
      bed: resident.bed ?? '',
      entry_date: resident.entry_date ?? '',
      entry_date_label: time.formatDate(resident.entry_date),
      days_in_shelter: resident.days_in_shelter ?? 0,
      presence,
      presence_label: t(`presence.${presence}`),
      out_since: resident.out_since,
      out_since_label: resident.out_since ? time.formatDateTime(resident.out_since) : '',
      outings_today: resident.outings_today ?? 0,
      phone_status: (resident.phone_status ?? 'none') as PhoneStatus,
      is_minor: resident.is_minor === true,
      is_unaccompanied_minor: resident.is_unaccompanied_minor === true,
      busy: busyStayId.value !== null && busyStayId.value === resident.stay_id,
    }
  }

  const allRows = computed(() => residents.value.map(toRow))
  const rows = computed(() => allRows.value.filter((row) => matchesQuery(row, query.value)))

  function findRow(stayId: string): ResidentRow | undefined {
    return allRows.value.find((row) => row.stay_id === stayId)
  }

  async function reload(): Promise<void> {
    loading.value = true
    try {
      residents.value = await listCurrentResidents()
      await thumbs.load(residents.value.map((resident) => resident.photo_path))
    } catch (error) {
      notify.error(error)
    } finally {
      loading.value = false
    }
  }

  return { rows, counts, loading, query, busyStayId, findRow, reload }
}
```

Create `web/src/components/people/PersonThumb.vue`:

```vue
<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { initials } from '@/lib/people'

const props = withDefaults(defineProps<{ url: string | null; name: string; size?: number }>(), {
  size: 40,
})

const { t } = useI18n()
const failed = ref(false)

watch(
  () => props.url,
  () => {
    failed.value = false
  },
)
</script>

<template>
  <img
    v-if="url && !failed"
    :src="url"
    :alt="t('photos.thumbAlt', { name })"
    :width="size"
    :height="size"
    class="rounded-circle object-fit-cover"
    @error="failed = true"
  />
  <span
    v-else
    class="d-inline-flex align-items-center justify-content-center rounded-circle bg-secondary-subtle text-secondary-emphasis fw-semibold"
    :style="{ width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size / 2.6)}px` }"
    aria-hidden="true"
    >{{ initials(name) }}</span
  >
</template>
```

Create `web/src/components/residents/HeadcountBar.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { HeadcountSummary } from '@/composables/useResidents'

const props = defineProps<{ summary: HeadcountSummary }>()
const { t } = useI18n()

const items = computed(() => [
  { key: 'total', value: props.summary.total, alert: false },
  { key: 'inside', value: props.summary.inside, alert: false },
  { key: 'outside', value: props.summary.outside, alert: false },
  { key: 'minors', value: props.summary.minors, alert: false },
  { key: 'unaccompanied', value: props.summary.unaccompanied, alert: props.summary.unaccompanied > 0 },
])
</script>

<template>
  <section class="row row-cols-2 row-cols-md-5 g-2" :aria-label="t('residents.headcount.label')">
    <div v-for="item in items" :key="item.key" class="col">
      <div class="border rounded p-2 h-100" :class="{ 'border-danger': item.alert }">
        <div
          class="fs-3 fw-semibold"
          :class="{ 'text-danger': item.alert }"
          :data-testid="`count-${item.key}`"
        >
          {{ item.value }}
        </div>
        <div class="small text-body-secondary">{{ t(`residents.headcount.${item.key}`) }}</div>
      </div>
    </div>
  </section>
</template>
```

Add these top-level keys to `web/src/i18n/locales/es-MX.json`, keeping every existing key:

```json
{
  "residents": {
    "refresh": "Actualizar",
    "search": {
      "label": "Buscar por nombre o cama",
      "placeholder": "Nombre o cama"
    },
    "headcount": {
      "label": "Conteo de personas",
      "total": "En el albergue",
      "inside": "Dentro",
      "outside": "Fuera",
      "minors": "Menores",
      "unaccompanied": "Menores sin acompañante"
    },
    "columns": {
      "photo": "Foto",
      "name": "Nombre",
      "age": "Edad",
      "gender": "Género",
      "country": "País",
      "bed": "Cama",
      "entryDate": "Ingreso",
      "days": "Días",
      "presence": "Presencia",
      "outSince": "Fuera desde",
      "unaccompanied": "Acompañamiento",
      "actions": "Acciones"
    },
    "unaccompaniedBadge": "Menor sin acompañante",
    "viewRecord": "Ver ficha"
  },
  "photos": {
    "thumbAlt": "Foto de {name}"
  }
}
```

- [ ] **Step 10: Run them to verify they pass**

Run: `npm --prefix web run test -- tests/api/photos.test.ts tests/composables tests/components`

Expected: PASS.

- [ ] **Step 11: Write the failing view and integration tests**

Create `web/tests/views/ResidentsView.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GridComponent } from '@syncfusion/ej2-vue-grids'
import { getSignedPhotoUrls } from '@/api/photos'
import { listCurrentResidents } from '@/api/stays'
import ResidentsView from '@/views/ResidentsView.vue'
import { makeResident, uuid } from '../fixtures/data'
import { mountWithApp } from '../utils/mountWithApp'

const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('@/composables/useNotify', () => ({ useNotify: () => notify }))
vi.mock('@/api/stays', () => ({ listCurrentResidents: vi.fn() }))
vi.mock('@/api/photos', () => ({
  photoPathFor: (id: string) => `${id}.jpg`,
  thumbPathFor: (path: string) => path.replace(/\.jpg$/, '_thumb.jpg'),
  getSignedPhotoUrls: vi.fn(),
  uploadPersonPhoto: vi.fn(),
}))

const residents = [
  makeResident({
    stay_id: uuid(101),
    person_id: uuid(1),
    photo_path: `${uuid(1)}.jpg`,
    birth_date_estimated: true,
  }),
  makeResident({
    stay_id: uuid(102),
    person_id: uuid(2),
    first_name: 'Tomás',
    last_name: 'Gutiérrez',
    gender_code: 'male',
    country_code: 'MX',
    bed: 'B2',
    presence: 'outside',
    out_since: '2026-10-07T16:30:00+00:00',
    open_outing_id: uuid(201),
  }),
  makeResident({
    stay_id: uuid(103),
    person_id: uuid(3),
    first_name: 'Lucía',
    last_name: 'Martínez',
    bed: 'C1',
    age: 15,
    birth_date: '2011-05-01',
    is_minor: true,
    is_unaccompanied_minor: true,
  }),
]

// mountWithApp defaults: /residents, a volunteer on shift, America/Mexico_City, testCatalogs.
function mountView() {
  return mountWithApp(ResidentsView)
}

async function mountLoaded() {
  const result = await mountView()
  await vi.waitFor(() => expect(result.wrapper.findAll('.e-row')).toHaveLength(residents.length), { timeout: 5000 })
  return result
}

function rowFor(wrapper: Awaited<ReturnType<typeof mountView>>['wrapper'], text: string) {
  const row = wrapper.findAll('.e-row').find((candidate) => candidate.text().includes(text))
  if (!row) throw new Error(`No row contains ${text}`)
  return row
}

const originalMatchMedia = window.matchMedia

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(listCurrentResidents).mockResolvedValue(residents)
  vi.mocked(getSignedPhotoUrls).mockResolvedValue({
    [`${uuid(1)}_thumb.jpg`]: 'https://storage.test/rosa_thumb.jpg',
  })
})

afterEach(() => {
  window.matchMedia = originalMatchMedia
  document.body.innerHTML = ''
})

describe('ResidentsView', () => {
  it('keeps the Residentes heading', async () => {
    const { wrapper } = await mountLoaded()
    expect(wrapper.find('h1').text()).toBe('Residentes')
  })

  it('shows the headcount', async () => {
    const { wrapper } = await mountLoaded()
    expect(wrapper.find('[data-testid="count-total"]').text()).toBe('3')
    expect(wrapper.find('[data-testid="count-inside"]').text()).toBe('2')
    expect(wrapper.find('[data-testid="count-outside"]').text()).toBe('1')
    expect(wrapper.find('[data-testid="count-minors"]').text()).toBe('1')
    expect(wrapper.find('[data-testid="count-unaccompanied"]').text()).toBe('1')
  })

  it('lists residents with catalog labels, estimated age, dates and badges', async () => {
    const { wrapper } = await mountLoaded()
    const rosa = rowFor(wrapper, 'Rosa Elena Pérez Lara')
    expect(rosa.text()).toContain('~30')
    expect(rosa.text()).toContain('Mujer')
    expect(rosa.text()).toContain('Honduras')
    expect(rosa.text()).toContain('03/10/2026')
    expect(rosa.find('[data-testid="presence"]').attributes('data-presence')).toBe('inside')
    expect(rosa.find('[data-testid="unaccompanied-badge"]').exists()).toBe(false)

    const tomas = rowFor(wrapper, 'Tomás Gutiérrez')
    expect(tomas.find('[data-testid="presence"]').attributes('data-presence')).toBe('outside')
    expect(tomas.text()).toContain('07/10/2026 10:30')

    const lucia = rowFor(wrapper, 'Lucía Martínez')
    expect(lucia.find('[data-testid="unaccompanied-badge"]').text()).toBe('Menor sin acompañante')
  })

  it('signs every thumbnail in one request and shows it', async () => {
    const { wrapper } = await mountLoaded()
    expect(getSignedPhotoUrls).toHaveBeenCalledTimes(1)
    expect(getSignedPhotoUrls).toHaveBeenCalledWith([`${uuid(1)}_thumb.jpg`], 600)
    await vi.waitFor(
      () => expect(wrapper.find('img[src="https://storage.test/rosa_thumb.jpg"]').exists()).toBe(true),
      { timeout: 5000 },
    )
  })

  it('filters by name or bed, ignoring accents and case', async () => {
    const { wrapper } = await mountLoaded()
    await wrapper.find('#residents-search').setValue('perez')
    await vi.waitFor(() => expect(wrapper.findAll('.e-row')).toHaveLength(1), { timeout: 5000 })
    expect(wrapper.find('.e-row').text()).toContain('Rosa Elena')
    await wrapper.find('#residents-search').setValue('c1')
    await vi.waitFor(() => expect(wrapper.find('.e-row').text()).toContain('Lucía'), { timeout: 5000 })
  })

  it('links each row to the person record by id only', async () => {
    const { wrapper } = await mountLoaded()
    expect(wrapper.find(`a[href="/people/${uuid(1)}"]`).text()).toBe('Ver ficha')
  })

  it('uses the adaptive grid layout on narrow screens', async () => {
    window.matchMedia = vi.fn((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia
    const { wrapper } = await mountLoaded()
    const grid = wrapper.findComponent(GridComponent)
    expect(grid.props('rowRenderingMode')).toBe('Vertical')
    expect(grid.props('enableAdaptiveUI')).toBe(true)
  })

  it('reports a failed load', async () => {
    vi.mocked(listCurrentResidents).mockRejectedValueOnce(new Error('boom'))
    await mountView()
    await vi.waitFor(() => expect(notify.error).toHaveBeenCalled())
  })
})
```

Create `web/tests/integration/factories.ts`:

```ts
// Creates fictitious people and stays straight through the client, so each
// integration test owns its data and never depends on seeded people.
import { todayIn } from '@/lib/shelterTime'
import { supabase, uniqueSuffix } from './helpers'

export const SHELTER_TZ = 'America/Mexico_City'

/** The shelter-local calendar date `days` before today, as 'YYYY-MM-DD'. */
export function daysAgo(days: number): string {
  const date = new Date(`${todayIn(SHELTER_TZ)}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() - days)
  return date.toISOString().slice(0, 10)
}

export interface PersonFields {
  first_name?: string
  last_name?: string | null
  birth_date?: string | null
  country_code?: string | null
}

export interface StayFields {
  entry_date?: string
  exit_date?: string | null
  bed?: string | null
}

export async function createPerson(fields: PersonFields = {}): Promise<string> {
  const { data, error } = await supabase
    .from('people')
    .insert({ first_name: `Prueba ${uniqueSuffix()}`, last_name: 'Integración', ...fields })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return data.id
}

export async function createStay(personId: string, fields: StayFields = {}): Promise<string> {
  const { data, error } = await supabase
    .from('stays')
    .insert({ person_id: personId, ...fields })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return data.id
}

export async function createResident(
  person: PersonFields = {},
  stay: StayFields = {},
): Promise<{ personId: string; stayId: string }> {
  const personId = await createPerson(person)
  const stayId = await createStay(personId, stay)
  return { personId, stayId }
}
```

Create `web/tests/integration/residents.test.ts`:

```ts
import { beforeAll, describe, expect, it } from 'vitest'
import { listCurrentResidents } from '@/api/stays'
import { createResident } from './factories'
import { signInAs } from './helpers'

describe('current residents', () => {
  beforeAll(async () => {
    await signInAs('volunteer')
  })

  it('lists an open stay with derived presence and flags', async () => {
    const { personId, stayId } = await createResident()
    const row = (await listCurrentResidents()).find((resident) => resident.stay_id === stayId)
    expect(row).toMatchObject({
      person_id: personId,
      presence: 'inside',
      outings_today: 0,
      is_unaccompanied_minor: false,
    })
  })
})
```

- [ ] **Step 12: Run them to verify they fail**

Run: `npm --prefix web run test -- tests/views/ResidentsView.test.ts`

Expected: FAIL, because `@/api/stays` does not exist and the view is still the Plan 2 placeholder.

Run: `npm run db:reset`, then `npm --prefix web run test:integration -- tests/integration/residents.test.ts`

Expected: FAIL, because `@/api/stays` does not exist.

- [ ] **Step 13: Implement the list, the grid and the view**

Create `web/src/api/stays.ts`:

```ts
import type { CurrentResident } from '@/types/domain'
import { supabase } from './client'
import { toApiError } from './errors'

export async function listCurrentResidents(): Promise<CurrentResident[]> {
  const { data, error } = await supabase.from('current_residents').select('*').order('first_name')
  if (error) throw toApiError(error)
  return data ?? []
}
```

Create `web/src/components/residents/ResidentsGrid.vue`:

```vue
<script setup lang="ts">
import { computed, onBeforeUnmount, provide, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  ColumnDirective as EColumn,
  ColumnsDirective as EColumns,
  Filter,
  GridComponent as EjsGrid,
  Sort,
} from '@syncfusion/ej2-vue-grids'
import PersonThumb from '@/components/people/PersonThumb.vue'
import type { ResidentRow } from '@/composables/useResidents'

defineProps<{ rows: ResidentRow[] }>()

const { t } = useI18n()
provide('grid', [Sort, Filter])

// Phones get Syncfusion's adaptive layout, which stacks each row vertically.
const narrowQuery = window.matchMedia('(max-width: 767.98px)')
const narrow = ref(narrowQuery.matches)
function onNarrowChange(event: MediaQueryListEvent): void {
  narrow.value = event.matches
}
narrowQuery.addEventListener?.('change', onNarrowChange)
onBeforeUnmount(() => narrowQuery.removeEventListener?.('change', onNarrowChange))

const adaptive = computed(() => ({
  enableAdaptiveUI: narrow.value,
  rowRenderingMode: narrow.value ? 'Vertical' : 'Horizontal',
}))
const filterSettings = { type: 'CheckBox' }
</script>

<template>
  <ejs-grid
    :key="narrow ? 'narrow' : 'wide'"
    :data-source="rows"
    :allow-sorting="true"
    :allow-filtering="true"
    :filter-settings="filterSettings"
    v-bind="adaptive"
  >
    <e-columns>
      <e-column
        :header-text="t('residents.columns.photo')"
        width="64"
        :allow-sorting="false"
        :allow-filtering="false"
        :template="'photo'"
      >
        <template #photo="{ data }">
          <PersonThumb :url="data.thumb_url" :name="data.full_name" />
        </template>
      </e-column>
      <e-column
        field="full_name"
        :header-text="t('residents.columns.name')"
        width="190"
        :allow-filtering="false"
      />
      <e-column
        field="age"
        :header-text="t('residents.columns.age')"
        width="70"
        :allow-filtering="false"
        :template="'age'"
      >
        <template #age="{ data }">{{ data.age_label }}</template>
      </e-column>
      <e-column field="gender_label" :header-text="t('residents.columns.gender')" width="110" />
      <e-column field="country_label" :header-text="t('residents.columns.country')" width="120" />
      <e-column field="bed" :header-text="t('residents.columns.bed')" width="80" />
      <e-column
        field="entry_date"
        :header-text="t('residents.columns.entryDate')"
        width="105"
        :allow-filtering="false"
        :template="'entry'"
      >
        <template #entry="{ data }">{{ data.entry_date_label }}</template>
      </e-column>
      <e-column
        field="days_in_shelter"
        :header-text="t('residents.columns.days')"
        width="70"
        :allow-filtering="false"
      />
      <e-column
        field="presence_label"
        :header-text="t('residents.columns.presence')"
        width="105"
        :template="'presence'"
      >
        <template #presence="{ data }">
          <span
            class="badge"
            :class="data.presence === 'outside' ? 'text-bg-warning' : 'text-bg-success'"
            data-testid="presence"
            :data-presence="data.presence"
            >{{ data.presence_label }}</span
          >
        </template>
      </e-column>
      <e-column
        field="out_since"
        :header-text="t('residents.columns.outSince')"
        width="135"
        :allow-filtering="false"
        :template="'outsince'"
      >
        <template #outsince="{ data }">{{ data.out_since_label }}</template>
      </e-column>
      <e-column
        field="is_unaccompanied_minor"
        :header-text="t('residents.columns.unaccompanied')"
        width="140"
        :allow-filtering="false"
        :template="'unaccompanied'"
      >
        <template #unaccompanied="{ data }">
          <span
            v-if="data.is_unaccompanied_minor"
            class="badge text-bg-danger"
            data-testid="unaccompanied-badge"
            >{{ t('residents.unaccompaniedBadge') }}</span
          >
        </template>
      </e-column>
      <e-column
        :header-text="t('residents.columns.actions')"
        width="250"
        :allow-sorting="false"
        :allow-filtering="false"
        :template="'actions'"
      >
        <template #actions="{ data }">
          <div class="d-flex flex-wrap gap-1">
            <RouterLink class="btn btn-sm btn-link" :to="{ name: 'person', params: { id: data.person_id } }">{{
              t('residents.viewRecord')
            }}</RouterLink>
          </div>
        </template>
      </e-column>
    </e-columns>
  </ejs-grid>
</template>
```

Replace `web/src/views/ResidentsView.vue` with:

```vue
<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import PageHeader from '@/components/common/PageHeader.vue'
import HeadcountBar from '@/components/residents/HeadcountBar.vue'
import ResidentsGrid from '@/components/residents/ResidentsGrid.vue'
import { useResidents } from '@/composables/useResidents'

const { t } = useI18n()
const { rows, counts, loading, query, reload } = useResidents()

onMounted(reload)
</script>

<template>
  <div>
    <PageHeader title-key="nav.residents">
      <template #actions>
        <RouterLink class="btn btn-primary" :to="{ name: 'person-new' }">{{ t('nav.newPerson') }}</RouterLink>
        <button type="button" class="btn btn-outline-secondary" :disabled="loading" @click="reload">
          {{ t('residents.refresh') }}
        </button>
      </template>
    </PageHeader>
    <HeadcountBar :summary="counts" class="mb-3" />
    <div class="mb-3 residents-search">
      <label for="residents-search" class="form-label">{{ t('residents.search.label') }}</label>
      <input
        id="residents-search"
        v-model="query"
        type="search"
        class="form-control"
        :placeholder="t('residents.search.placeholder')"
        autocomplete="off"
      />
    </div>
    <ResidentsGrid :rows="rows" />
  </div>
</template>

<style scoped>
.residents-search {
  max-width: 24rem;
}
</style>
```

- [ ] **Step 14: Run the tests to verify they pass**

Run: `npm --prefix web run test -- tests/views/ResidentsView.test.ts`

Expected: PASS.

Run: `npm --prefix web run test:integration -- tests/integration/residents.test.ts`

Expected: PASS.

- [ ] **Step 15: Run the whole suite, the type check and the linter**

Run: `npm run web:test`, then `npm run web:typecheck`, then `npm run web:lint`

Expected: all pass with no errors.

- [ ] **Step 16: Commit**

```bash
git add web/package.json web/package-lock.json web/src/main.ts web/src/lib/people.ts web/src/api/stays.ts web/src/api/photos.ts web/src/composables/useThumbnails.ts web/src/composables/useResidents.ts web/src/components/people/PersonThumb.vue web/src/components/residents web/src/views/ResidentsView.vue web/src/i18n/locales/es-MX.json web/tests
git commit -m "feat(web): add residents home with headcount, grid and signed thumbnails"
```

---
### Task 2: Outing and return from the residents list

**Files:**
- Create: `web/src/api/outings.ts`
- Create: `web/src/components/outings/OutingStartDialog.vue`
- Modify: `web/src/components/residents/ResidentsGrid.vue`
- Replace: `web/src/views/ResidentsView.vue`
- Modify: `web/src/i18n/locales/es-MX.json`
- Create tests: `web/tests/views/ResidentsView.outings.test.ts`, `web/tests/integration/outings.test.ts`

**Interfaces:**
- Consumes: Task 1 (`useResidents`, `ResidentRow`, `ResidentsGrid`, fixtures, `body()`, factories), `isApiError` and `ApiError` (`@/api/errors`), `useConfirm().confirm`, `cleanText`.
- Produces:
  - `startOuting(stayId: string, comment?: string | null, confirmException = false): Promise<string>` and `endOuting(stayId: string): Promise<string>` in `api/outings.ts`.
  - `OutingStartDialog` (prop `name: string | null`; open while it is not null; emits `confirm(comment: string | null)` and `cancel()`). It stays mounted; the form inside it is recreated on each opening.
  - `ResidentsGrid` emits `start-outing(stayId)` and `end-outing(stayId)`.
  - `ResidentsView` runs one row action at a time through `runRowAction(row, action)`, which always reloads the list afterwards.

- [ ] **Step 1: Write the failing view and integration tests**

Create `web/tests/views/ResidentsView.outings.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { ApiError } from '@/api/errors'
import { endOuting, startOuting } from '@/api/outings'
import { listCurrentResidents } from '@/api/stays'
import ResidentsView from '@/views/ResidentsView.vue'
import { makeResident, uuid } from '../fixtures/data'
import { mountWithApp } from '../utils/mountWithApp'
import { body } from '../utils/syncfusion'

const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
const confirm = vi.hoisted(() => vi.fn())
vi.mock('@/composables/useNotify', () => ({ useNotify: () => notify }))
vi.mock('@/composables/useConfirm', () => ({ useConfirm: () => ({ confirm }) }))
vi.mock('@/api/stays', () => ({ listCurrentResidents: vi.fn(), checkOut: vi.fn() }))
vi.mock('@/api/outings', () => ({ startOuting: vi.fn(), endOuting: vi.fn() }))
vi.mock('@/api/photos', () => ({
  photoPathFor: (id: string) => `${id}.jpg`,
  thumbPathFor: (path: string) => path.replace(/\.jpg$/, '_thumb.jpg'),
  getSignedPhotoUrls: vi.fn(),
  uploadPersonPhoto: vi.fn(),
}))

type Wrapper = Awaited<ReturnType<typeof mountWithApp>>['wrapper']

const residents = [
  makeResident({ stay_id: uuid(101), person_id: uuid(1) }),
  makeResident({
    stay_id: uuid(102),
    person_id: uuid(2),
    first_name: 'Tomás',
    last_name: 'Gutiérrez',
    bed: 'B2',
    presence: 'outside',
    out_since: '2026-10-07T16:30:00+00:00',
    open_outing_id: uuid(201),
  }),
]

async function mountLoaded(): Promise<Wrapper> {
  const { wrapper } = await mountWithApp(ResidentsView)
  await vi.waitFor(() => expect(wrapper.findAll('.e-row')).toHaveLength(residents.length), { timeout: 5000 })
  return wrapper
}

function rowFor(w: Wrapper, text: string) {
  const row = w.findAll('.e-row').find((candidate) => candidate.text().includes(text))
  if (!row) throw new Error(`No row contains ${text}`)
  return row
}

function buttonIn(row: ReturnType<typeof rowFor>, label: string) {
  const button = row.findAll('button').find((candidate) => candidate.text() === label)
  if (!button) throw new Error(`No ${label} button`)
  return button
}

async function submitOutingDialog(comment?: string): Promise<void> {
  await vi.waitFor(() => expect(body().find('#outing-comment').exists()).toBe(true))
  if (comment !== undefined) await body().find('#outing-comment').setValue(comment)
  await body().find('form.outing-start-form').trigger('submit')
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(listCurrentResidents).mockResolvedValue(residents)
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('ResidentsView outings', () => {
  it('offers Salida to people inside and Regreso to people outside', async () => {
    const w = await mountLoaded()
    const rosaButtons = rowFor(w, 'Rosa Elena').findAll('button').map((b) => b.text())
    expect(rosaButtons).toContain('Salida')
    expect(rosaButtons).not.toContain('Regreso')
    const tomasButtons = rowFor(w, 'Tomás').findAll('button').map((b) => b.text())
    expect(tomasButtons).toContain('Regreso')
    expect(tomasButtons).not.toContain('Salida')
  })

  it('records an outing with an optional comment and reloads the list', async () => {
    vi.mocked(startOuting).mockResolvedValue(uuid(301))
    const w = await mountLoaded()
    await buttonIn(rowFor(w, 'Rosa Elena'), 'Salida').trigger('click')
    await submitOutingDialog('Cita en el consulado')
    await vi.waitFor(() =>
      expect(startOuting).toHaveBeenCalledWith(uuid(101), 'Cita en el consulado', false),
    )
    expect(notify.success).toHaveBeenCalledWith('outings.started', { name: 'Rosa Elena Pérez Lara' })
    await vi.waitFor(() => expect(listCurrentResidents).toHaveBeenCalledTimes(2))
  })

  it('asks before recording a second outing on the same day', async () => {
    vi.mocked(startOuting)
      .mockRejectedValueOnce(new ApiError('outing_exception_needs_confirmation'))
      .mockResolvedValueOnce(uuid(302))
    confirm.mockResolvedValue(true)
    const w = await mountLoaded()
    await buttonIn(rowFor(w, 'Rosa Elena'), 'Salida').trigger('click')
    await submitOutingDialog()
    await vi.waitFor(() => expect(startOuting).toHaveBeenCalledTimes(2))
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({ messageKey: 'errors.outing_exception_needs_confirmation', confirmKey: 'outings.exception.confirm' }),
    )
    expect(startOuting).toHaveBeenNthCalledWith(1, uuid(101), null, false)
    expect(startOuting).toHaveBeenNthCalledWith(2, uuid(101), null, true)
    expect(notify.success).toHaveBeenCalledWith('outings.started', { name: 'Rosa Elena Pérez Lara' })
  })

  it('records nothing when the exception is declined', async () => {
    vi.mocked(startOuting).mockRejectedValueOnce(new ApiError('outing_exception_needs_confirmation'))
    confirm.mockResolvedValue(false)
    const w = await mountLoaded()
    await buttonIn(rowFor(w, 'Rosa Elena'), 'Salida').trigger('click')
    await submitOutingDialog()
    await vi.waitFor(() => expect(confirm).toHaveBeenCalled())
    await flushPromises()
    expect(startOuting).toHaveBeenCalledTimes(1)
    expect(notify.success).not.toHaveBeenCalled()
    expect(notify.error).not.toHaveBeenCalled()
  })

  it('records a return', async () => {
    vi.mocked(endOuting).mockResolvedValue(uuid(201))
    const w = await mountLoaded()
    await buttonIn(rowFor(w, 'Tomás'), 'Regreso').trigger('click')
    await vi.waitFor(() => expect(endOuting).toHaveBeenCalledWith(uuid(102)))
    expect(notify.success).toHaveBeenCalledWith('outings.ended', { name: 'Tomás Gutiérrez' })
  })

  it('shows the error and reloads when another computer already recorded the return', async () => {
    vi.mocked(endOuting).mockRejectedValue(new ApiError('no_open_outing'))
    const w = await mountLoaded()
    await buttonIn(rowFor(w, 'Tomás'), 'Regreso').trigger('click')
    await vi.waitFor(() =>
      expect(notify.error).toHaveBeenCalledWith(expect.objectContaining({ code: 'no_open_outing' })),
    )
    await vi.waitFor(() => expect(listCurrentResidents).toHaveBeenCalledTimes(2))
  })

  it('sends one request when Regreso is clicked twice', async () => {
    vi.mocked(endOuting).mockReturnValue(new Promise(() => {}))
    const w = await mountLoaded()
    const button = buttonIn(rowFor(w, 'Tomás'), 'Regreso').element as HTMLButtonElement
    button.click()
    button.click()
    await flushPromises()
    expect(endOuting).toHaveBeenCalledTimes(1)
  })
})
```

Create `web/tests/integration/outings.test.ts`:

```ts
import { beforeAll, describe, expect, it } from 'vitest'
import { endOuting, startOuting } from '@/api/outings'
import { listCurrentResidents } from '@/api/stays'
import { createResident } from './factories'
import { signInAs } from './helpers'

async function presenceOf(stayId: string): Promise<string | null | undefined> {
  return (await listCurrentResidents()).find((resident) => resident.stay_id === stayId)?.presence
}

describe('outings', () => {
  beforeAll(async () => {
    await signInAs('volunteer')
  })

  it('records an outing and a return, and asks before a second outing the same day', async () => {
    const { stayId } = await createResident()
    await expect(startOuting(stayId, '  Cita en el consulado  ')).resolves.toEqual(expect.any(String))
    expect(await presenceOf(stayId)).toBe('outside')
    await expect(startOuting(stayId)).rejects.toMatchObject({ code: 'outing_already_open' })

    await expect(endOuting(stayId)).resolves.toEqual(expect.any(String))
    expect(await presenceOf(stayId)).toBe('inside')
    await expect(endOuting(stayId)).rejects.toMatchObject({ code: 'no_open_outing' })

    await expect(startOuting(stayId)).rejects.toMatchObject({
      code: 'outing_exception_needs_confirmation',
    })
    await expect(startOuting(stayId, null, true)).resolves.toEqual(expect.any(String))
    expect(await presenceOf(stayId)).toBe('outside')
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm --prefix web run test -- tests/views/ResidentsView.outings.test.ts`

Expected: FAIL, because `@/api/outings` does not exist and the rows have no Salida button.

Run: `npm run db:reset`, then `npm --prefix web run test:integration -- tests/integration/outings.test.ts`

Expected: FAIL, because `@/api/outings` does not exist.

- [ ] **Step 3: Implement the API, the dialog, the grid buttons and the view**

Create `web/src/api/outings.ts`:

```ts
import { cleanText } from '@/lib/text'
import { supabase } from './client'
import { toApiError } from './errors'

/** Starts an outing at the server's current time. */
export async function startOuting(
  stayId: string,
  comment?: string | null,
  confirmException = false,
): Promise<string> {
  const { data, error } = await supabase.rpc('start_outing', {
    p_stay_id: stayId,
    p_comment: cleanText(comment) ?? undefined,
    p_confirm_exception: confirmException,
  })
  if (error) throw toApiError(error)
  return data as string
}

/** Records the return of the open outing at the server's current time. */
export async function endOuting(stayId: string): Promise<string> {
  const { data, error } = await supabase.rpc('end_outing', { p_stay_id: stayId })
  if (error) throw toApiError(error)
  return data as string
}
```

Create `web/src/components/outings/OutingStartDialog.vue`:

```vue
<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { type CloseEventArgs, DialogComponent as EjsDialog } from '@syncfusion/ej2-vue-popups'
import { cleanText } from '@/lib/text'

const props = defineProps<{ name: string | null }>()
const emit = defineEmits<{ confirm: [comment: string | null]; cancel: [] }>()

const { t } = useI18n()
const comment = ref('')

// The dialog stays mounted; start every opening with an empty comment.
watch(
  () => props.name,
  (name) => {
    if (name !== null) comment.value = ''
  },
)

function submit(): void {
  emit('confirm', cleanText(comment.value))
}

// Escape or the close icon. Closing because the parent cleared `name` is not interacted.
function onClose(args: CloseEventArgs): void {
  if (args.isInteracted) emit('cancel')
}
</script>

<template>
  <ejs-dialog
    :visible="name !== null"
    :is-modal="true"
    :show-close-icon="true"
    :close-on-escape="true"
    :animation-settings="{ effect: 'None' }"
    :header="t('outings.startDialog.title')"
    width="min(28rem, 95vw)"
    @close="onClose"
  >
    <form v-if="name !== null" class="outing-start-form" @submit.prevent="submit">
      <p class="fw-semibold">{{ name }}</p>
      <label for="outing-comment" class="form-label">{{ t('outings.startDialog.commentLabel') }}</label>
      <input
        id="outing-comment"
        v-model="comment"
        type="text"
        class="form-control"
        maxlength="500"
        autocomplete="off"
        :placeholder="t('outings.startDialog.commentPlaceholder')"
      />
      <div class="d-flex justify-content-end gap-2 mt-3">
        <button type="button" class="btn btn-outline-secondary" @click="emit('cancel')">
          {{ t('common.cancel') }}
        </button>
        <button type="submit" class="btn btn-primary">{{ t('outings.startDialog.submit') }}</button>
      </div>
    </form>
  </ejs-dialog>
</template>
```

In `web/src/components/residents/ResidentsGrid.vue`, replace `defineProps<{ rows: ResidentRow[] }>()` with:

```ts
defineProps<{ rows: ResidentRow[] }>()
const emit = defineEmits<{
  'start-outing': [stayId: string]
  'end-outing': [stayId: string]
}>()
```

and replace the whole `<template #actions="{ data }">` block with:

```vue
        <template #actions="{ data }">
          <div class="d-flex flex-wrap gap-1">
            <button
              v-if="data.presence === 'inside'"
              type="button"
              class="btn btn-sm btn-outline-primary"
              :disabled="data.busy"
              @click="emit('start-outing', data.stay_id)"
            >
              {{ t('outings.start') }}
            </button>
            <button
              v-else
              type="button"
              class="btn btn-sm btn-outline-success"
              :disabled="data.busy"
              @click="emit('end-outing', data.stay_id)"
            >
              {{ t('outings.end') }}
            </button>
            <RouterLink class="btn btn-sm btn-link" :to="{ name: 'person', params: { id: data.person_id } }">{{
              t('residents.viewRecord')
            }}</RouterLink>
          </div>
        </template>
```

Replace `web/src/views/ResidentsView.vue` with:

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { isApiError } from '@/api/errors'
import { endOuting, startOuting } from '@/api/outings'
import PageHeader from '@/components/common/PageHeader.vue'
import OutingStartDialog from '@/components/outings/OutingStartDialog.vue'
import HeadcountBar from '@/components/residents/HeadcountBar.vue'
import ResidentsGrid from '@/components/residents/ResidentsGrid.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useNotify } from '@/composables/useNotify'
import { type ResidentRow, useResidents } from '@/composables/useResidents'

const { t } = useI18n()
const notify = useNotify()
const { confirm } = useConfirm()
const { rows, counts, loading, query, busyStayId, findRow, reload } = useResidents()

const outingTarget = ref<ResidentRow | null>(null)

onMounted(reload)

/**
 * Runs one row action at a time and always reloads afterwards, so a row that
 * another computer changed shows its real state after the error.
 */
async function runRowAction(row: ResidentRow, action: () => Promise<void>): Promise<void> {
  if (busyStayId.value) return
  busyStayId.value = row.stay_id
  try {
    await action()
  } catch (error) {
    notify.error(error)
  } finally {
    busyStayId.value = null
    await reload()
  }
}

function openOuting(stayId: string): void {
  outingTarget.value = findRow(stayId) ?? null
}

async function confirmOuting(comment: string | null): Promise<void> {
  const row = outingTarget.value
  outingTarget.value = null
  if (!row) return
  await runRowAction(row, async () => {
    try {
      await startOuting(row.stay_id, comment, false)
    } catch (error) {
      if (!isApiError(error, 'outing_exception_needs_confirmation')) throw error
      const approved = await confirm({
        titleKey: 'outings.exception.title',
        messageKey: 'errors.outing_exception_needs_confirmation',
        confirmKey: 'outings.exception.confirm',
      })
      if (!approved) return
      await startOuting(row.stay_id, comment, true)
    }
    notify.success('outings.started', { name: row.full_name })
  })
}

async function recordReturn(stayId: string): Promise<void> {
  const row = findRow(stayId)
  if (!row) return
  await runRowAction(row, async () => {
    await endOuting(row.stay_id)
    notify.success('outings.ended', { name: row.full_name })
  })
}
</script>

<template>
  <div>
    <PageHeader title-key="nav.residents">
      <template #actions>
        <RouterLink class="btn btn-primary" :to="{ name: 'person-new' }">{{ t('nav.newPerson') }}</RouterLink>
        <button type="button" class="btn btn-outline-secondary" :disabled="loading" @click="reload">
          {{ t('residents.refresh') }}
        </button>
      </template>
    </PageHeader>
    <HeadcountBar :summary="counts" class="mb-3" />
    <div class="mb-3 residents-search">
      <label for="residents-search" class="form-label">{{ t('residents.search.label') }}</label>
      <input
        id="residents-search"
        v-model="query"
        type="search"
        class="form-control"
        :placeholder="t('residents.search.placeholder')"
        autocomplete="off"
      />
    </div>
    <ResidentsGrid :rows="rows" @start-outing="openOuting" @end-outing="recordReturn" />
    <OutingStartDialog
      :name="outingTarget?.full_name ?? null"
      @confirm="confirmOuting"
      @cancel="outingTarget = null"
    />
  </div>
</template>

<style scoped>
.residents-search {
  max-width: 24rem;
}
</style>
```

Add this top-level key to `web/src/i18n/locales/es-MX.json`:

```json
{
  "outings": {
    "start": "Salida",
    "end": "Regreso",
    "startDialog": {
      "title": "Registrar salida",
      "commentLabel": "Comentario (opcional)",
      "commentPlaceholder": "Por ejemplo: cita en el consulado",
      "submit": "Registrar salida"
    },
    "exception": {
      "title": "Salida adicional",
      "confirm": "Registrar excepción"
    },
    "started": "Salida registrada: {name}",
    "ended": "Regreso registrado: {name}"
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm --prefix web run test -- tests/views/ResidentsView.outings.test.ts tests/views/ResidentsView.test.ts`

Expected: PASS.

Run: `npm --prefix web run test:integration -- tests/integration/outings.test.ts`

Expected: PASS.

- [ ] **Step 5: Run the whole suite, the type check and the linter**

Run: `npm run web:test`, then `npm run web:typecheck`, then `npm run web:lint`

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add web/src/api/outings.ts web/src/components/outings/OutingStartDialog.vue web/src/components/residents/ResidentsGrid.vue web/src/views/ResidentsView.vue web/src/i18n/locales/es-MX.json web/tests/views/ResidentsView.outings.test.ts web/tests/integration/outings.test.ts
git commit -m "feat(web): record outings and returns from the residents list"
```

---

### Task 3: Check-out from the residents list

**Files:**
- Modify: `web/src/api/stays.ts`, `web/src/components/residents/ResidentsGrid.vue`
- Create: `web/src/lib/dates.ts`, `web/src/components/forms/DateField.vue`, `web/src/components/stays/CheckOutDialog.vue`
- Modify: `web/src/views/ResidentsView.vue`
- Modify: `web/src/i18n/locales/es-MX.json`
- Create tests: `web/tests/lib/dates.test.ts`, `web/tests/components/forms/DateField.test.ts`, `web/tests/components/stays/CheckOutDialog.test.ts`, `web/tests/views/ResidentsView.checkOut.test.ts`, `web/tests/integration/check-out.test.ts`

**Interfaces:**
- Consumes: Task 1 and Task 2 (`ResidentRow`, `runRowAction` in the view), `useShelterTime().today`, `typeInto`, `body()`, `daysAgo`.
- Produces:
  - `toLocalDate(value: string | null | undefined): Date | null` and `fromLocalDate(value: Date | null | undefined): string | null` in `lib/dates.ts`.
  - `checkOut(stayId: string, exitDate?: string): Promise<void>` in `api/stays.ts`.
  - `DateField` (props `id: string`, `modelValue: string | null`, `min?: string | null`, `max?: string | null`, `invalid?: boolean`; emits `update:modelValue(value: string | null)` with `YYYY-MM-DD`).
  - `CheckOutDialog` (prop `resident: ResidentRow | null`; open while it is not null; emits `confirm(exitDate: string)` and `cancel()`).
  - `ResidentsGrid` also emits `check-out(stayId)`.

- [ ] **Step 1: Write the failing tests**

Create `web/tests/lib/dates.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { fromLocalDate, toLocalDate } from '@/lib/dates'

describe('toLocalDate and fromLocalDate', () => {
  it('round-trips a calendar date through a date picker value', () => {
    const date = toLocalDate('2026-03-09')
    expect(date?.getFullYear()).toBe(2026)
    expect(date?.getMonth()).toBe(2)
    expect(date?.getDate()).toBe(9)
    expect(fromLocalDate(date)).toBe('2026-03-09')
  })

  it('reads the calendar day the picker shows, even late at night', () => {
    expect(fromLocalDate(new Date(2026, 9, 7, 23, 59))).toBe('2026-10-07')
  })

  it('returns null for empty or invalid values', () => {
    expect(toLocalDate(null)).toBeNull()
    expect(toLocalDate('07/10/2026')).toBeNull()
    expect(fromLocalDate(null)).toBeNull()
    expect(fromLocalDate(new Date('not a date'))).toBeNull()
  })
})
```

Create `web/tests/components/forms/DateField.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import DateField from '@/components/forms/DateField.vue'
import { mountWithApp } from '../../utils/mountWithApp'
import { typeInto } from '../../utils/syncfusion'

afterEach(() => {
  document.body.innerHTML = ''
})

function inputValue(wrapper: Awaited<ReturnType<typeof mountWithApp>>['wrapper']): string {
  return (wrapper.find('#field').element as HTMLInputElement).value
}

describe('DateField', () => {
  it('shows a calendar date as dd/MM/yyyy', async () => {
    const { wrapper } = await mountWithApp(DateField, { props: { id: 'field', modelValue: '2026-10-07' } })
    expect(inputValue(wrapper)).toBe('07/10/2026')
  })

  it('emits a typed date as the same calendar day in YYYY-MM-DD', async () => {
    const { wrapper } = await mountWithApp(DateField, { props: { id: 'field', modelValue: null } })
    await typeInto(wrapper.find('#field'), '03/02/2026')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['2026-02-03'])
  })

  it('emits null when the field is cleared', async () => {
    const { wrapper } = await mountWithApp(DateField, { props: { id: 'field', modelValue: '2026-10-07' } })
    await typeInto(wrapper.find('#field'), '')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([null])
  })

  it('follows a new value from the parent without echoing it back', async () => {
    const { wrapper } = await mountWithApp(DateField, { props: { id: 'field', modelValue: '2026-10-07' } })
    await wrapper.setProps({ modelValue: '2026-01-15' })
    await vi.waitFor(() => expect(inputValue(wrapper)).toBe('15/01/2026'))
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})
```

Create `web/tests/components/stays/CheckOutDialog.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import CheckOutDialog from '@/components/stays/CheckOutDialog.vue'
import type { ResidentRow } from '@/composables/useResidents'
import { todayIn } from '@/lib/shelterTime'
import { uuid } from '../../fixtures/data'
import { mountWithApp } from '../../utils/mountWithApp'
import { body, typeInto } from '../../utils/syncfusion'

type Wrapper = Awaited<ReturnType<typeof mountWithApp>>['wrapper']

function makeRow(overrides: Partial<ResidentRow> = {}): ResidentRow {
  return {
    stay_id: uuid(101),
    person_id: uuid(1),
    full_name: 'Rosa Elena Pérez Lara',
    photo_path: null,
    thumb_url: null,
    age: 30,
    age_label: '30',
    gender_label: 'Mujer',
    country_label: 'Honduras',
    bed: 'A1',
    entry_date: '2026-10-03',
    entry_date_label: '03/10/2026',
    days_in_shelter: 4,
    presence: 'inside',
    presence_label: 'Dentro',
    out_since: null,
    out_since_label: '',
    outings_today: 0,
    phone_status: 'none',
    is_minor: false,
    is_unaccompanied_minor: false,
    busy: false,
    ...overrides,
  }
}

async function open(resident: ResidentRow): Promise<Wrapper> {
  const { wrapper } = await mountWithApp(CheckOutDialog, { props: { resident } })
  await vi.waitFor(() => expect(body().find('#check-out-date').exists()).toBe(true))
  return wrapper
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('CheckOutDialog', () => {
  it('defaults the exit date to today in the shelter timezone and confirms it', async () => {
    const today = todayIn('America/Mexico_City')
    const w = await open(makeRow())
    const [year, month, day] = today.split('-')
    expect((body().find('#check-out-date').element as HTMLInputElement).value).toBe(`${day}/${month}/${year}`)
    expect(body().text()).toContain('Rosa Elena Pérez Lara')
    await body().find('form.check-out-form').trigger('submit')
    expect(w.emitted('confirm')).toEqual([[today]])
  })

  it('shows no warnings for a person inside with no phone in custody', async () => {
    await open(makeRow())
    expect(body().find('[data-testid="phone-warning"]').exists()).toBe(false)
    expect(body().find('[data-testid="outside-warning"]').exists()).toBe(false)
  })

  it('reminds staff to return a phone in custody', async () => {
    await open(makeRow({ phone_status: 'in_custody' }))
    expect(body().find('[data-testid="phone-warning"]').text()).toContain('devolver el teléfono')
  })

  it('warns that a person who is outside will be recorded as not returned', async () => {
    await open(makeRow({ presence: 'outside' }))
    expect(body().find('[data-testid="outside-warning"]').text()).toContain(
      'se registrará como salió y no regresó',
    )
  })

  it('rejects an exit date before the entry date', async () => {
    const w = await open(makeRow({ entry_date: '2026-10-03' }))
    await typeInto(body().find('#check-out-date'), '01/10/2026')
    await body().find('form.check-out-form').trigger('submit')
    expect(body().text()).toContain('La fecha de egreso no puede ser anterior a la de ingreso.')
    expect(w.emitted('confirm')).toBeUndefined()
  })

  it('starts again from today each time it opens', async () => {
    const w = await open(makeRow())
    await typeInto(body().find('#check-out-date'), '01/10/2026')
    await w.setProps({ resident: null })
    await w.setProps({ resident: makeRow({ stay_id: uuid(102) }) })
    await vi.waitFor(() => expect(body().find('#check-out-date').exists()).toBe(true))
    const [year, month, day] = todayIn('America/Mexico_City').split('-')
    expect((body().find('#check-out-date').element as HTMLInputElement).value).toBe(`${day}/${month}/${year}`)
  })

  it('rejects an exit date in the future', async () => {
    const nextYear = Number(todayIn('America/Mexico_City').slice(0, 4)) + 1
    const w = await open(makeRow())
    await typeInto(body().find('#check-out-date'), `01/01/${nextYear}`)
    await body().find('form.check-out-form').trigger('submit')
    expect(body().text()).toContain('La fecha no puede ser posterior a hoy.')
    expect(w.emitted('confirm')).toBeUndefined()
  })
})
```

Create `web/tests/views/ResidentsView.checkOut.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/errors'
import { checkOut, listCurrentResidents } from '@/api/stays'
import { todayIn } from '@/lib/shelterTime'
import ResidentsView from '@/views/ResidentsView.vue'
import { makeResident, uuid } from '../fixtures/data'
import { mountWithApp } from '../utils/mountWithApp'
import { body } from '../utils/syncfusion'

const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('@/composables/useNotify', () => ({ useNotify: () => notify }))
vi.mock('@/composables/useConfirm', () => ({ useConfirm: () => ({ confirm: vi.fn() }) }))
vi.mock('@/api/stays', () => ({ listCurrentResidents: vi.fn(), checkOut: vi.fn() }))
vi.mock('@/api/outings', () => ({ startOuting: vi.fn(), endOuting: vi.fn() }))
vi.mock('@/api/photos', () => ({
  photoPathFor: (id: string) => `${id}.jpg`,
  thumbPathFor: (path: string) => path.replace(/\.jpg$/, '_thumb.jpg'),
  getSignedPhotoUrls: vi.fn(),
  uploadPersonPhoto: vi.fn(),
}))

type Wrapper = Awaited<ReturnType<typeof mountWithApp>>['wrapper']

async function mountLoaded(): Promise<Wrapper> {
  const { wrapper } = await mountWithApp(ResidentsView)
  await vi.waitFor(() => expect(wrapper.findAll('.e-row')).toHaveLength(1), { timeout: 5000 })
  return wrapper
}

async function checkOutFirstRow(w: Wrapper): Promise<void> {
  const button = w.find('.e-row').findAll('button').find((b) => b.text() === 'Egreso')
  if (!button) throw new Error('No Egreso button')
  await button.trigger('click')
  await vi.waitFor(() => expect(body().find('form.check-out-form').exists()).toBe(true))
  await body().find('form.check-out-form').trigger('submit')
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(listCurrentResidents).mockResolvedValue([
    makeResident({ stay_id: uuid(101), phone_status: 'in_custody' }),
  ])
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('ResidentsView check-out', () => {
  it('checks the person out on today and reloads the list', async () => {
    vi.mocked(checkOut).mockResolvedValue()
    const w = await mountLoaded()
    await checkOutFirstRow(w)
    await vi.waitFor(() =>
      expect(checkOut).toHaveBeenCalledWith(uuid(101), todayIn('America/Mexico_City')),
    )
    expect(notify.success).toHaveBeenCalledWith('stays.checkOut.done', { name: 'Rosa Elena Pérez Lara' })
    await vi.waitFor(() => expect(listCurrentResidents).toHaveBeenCalledTimes(2))
  })

  it('shows the error and reloads when another computer already checked the person out', async () => {
    vi.mocked(checkOut).mockRejectedValue(new ApiError('stay_not_open'))
    const w = await mountLoaded()
    await checkOutFirstRow(w)
    await vi.waitFor(() =>
      expect(notify.error).toHaveBeenCalledWith(expect.objectContaining({ code: 'stay_not_open' })),
    )
    await vi.waitFor(() => expect(listCurrentResidents).toHaveBeenCalledTimes(2))
  })
})
```

Create `web/tests/integration/check-out.test.ts`:

```ts
import { beforeAll, describe, expect, it } from 'vitest'
import { checkOut, listCurrentResidents } from '@/api/stays'
import { createResident, daysAgo } from './factories'
import { signInAs } from './helpers'

describe('check-out', () => {
  beforeAll(async () => {
    await signInAs('volunteer')
  })

  it('closes the stay today and refuses a second check-out', async () => {
    const { stayId } = await createResident()
    await checkOut(stayId)
    expect((await listCurrentResidents()).some((resident) => resident.stay_id === stayId)).toBe(false)
    await expect(checkOut(stayId)).rejects.toMatchObject({ code: 'stay_not_open' })
  })

  it('accepts a past exit date and rejects one before the entry', async () => {
    const first = await createResident({}, { entry_date: daysAgo(10) })
    await expect(checkOut(first.stayId, daysAgo(4))).resolves.toBeUndefined()
    const second = await createResident({}, { entry_date: daysAgo(3) })
    await expect(checkOut(second.stayId, daysAgo(5))).rejects.toMatchObject({ code: 'validation' })
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm --prefix web run test -- tests/lib/dates.test.ts tests/components/forms tests/components/stays tests/views/ResidentsView.checkOut.test.ts`

Expected: FAIL, because `@/lib/dates`, `DateField`, `CheckOutDialog` and `checkOut` do not exist yet.

Run: `npm run db:reset`, then `npm --prefix web run test:integration -- tests/integration/check-out.test.ts`

Expected: FAIL, because `checkOut` is not exported.

- [ ] **Step 3: Implement the date helpers, the date field and the API call**

Create `web/src/lib/dates.ts`:

```ts
// Calendar dates ('YYYY-MM-DD') and shelter wall-clock times for form controls.
// Nothing here uses the browser's timezone to decide which day something happened.

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

/** 'YYYY-MM-DD' as a Date at local midnight, the shape date pickers work with. */
export function toLocalDate(value: string | null | undefined): Date | null {
  const match = value ? DATE_ONLY.exec(value) : null
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null
}

/** A date picker value back to 'YYYY-MM-DD', read from the calendar day it shows. */
export function fromLocalDate(value: Date | null | undefined): string | null {
  if (!value || Number.isNaN(value.getTime())) return null
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
}
```

Create `web/src/components/forms/DateField.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { DatePickerComponent as EjsDatepicker } from '@syncfusion/ej2-vue-calendars'
import { fromLocalDate, toLocalDate } from '@/lib/dates'

const props = withDefaults(
  defineProps<{
    id: string
    modelValue: string | null
    min?: string | null
    max?: string | null
    invalid?: boolean
  }>(),
  { min: null, max: null, invalid: false },
)
const emit = defineEmits<{ 'update:modelValue': [value: string | null] }>()

// Syncfusion's own bounds, used when no bound is given.
const FIRST_DAY = new Date(1900, 0, 1)
const LAST_DAY = new Date(2099, 11, 31)

const pickerValue = computed(() => toLocalDate(props.modelValue))
const minDate = computed(() => toLocalDate(props.min) ?? FIRST_DAY)
const maxDate = computed(() => toLocalDate(props.max) ?? LAST_DAY)

function onChange(args: { value: Date | null }): void {
  const next = fromLocalDate(args.value)
  if (next !== props.modelValue) emit('update:modelValue', next)
}
</script>

<template>
  <ejs-datepicker
    :id="id"
    :value="pickerValue"
    format="dd/MM/yyyy"
    :min="minDate"
    :max="maxDate"
    :css-class="invalid ? 'e-error' : ''"
    @change="onChange"
  />
</template>
```

Append to `web/src/api/stays.ts`:

```ts
/** Closes a stay. The exit date defaults to today in the shelter timezone on the server. */
export async function checkOut(stayId: string, exitDate?: string): Promise<void> {
  const { error } = await supabase.rpc('check_out', { p_stay_id: stayId, p_exit_date: exitDate })
  if (error) throw toApiError(error)
}
```

- [ ] **Step 4: Implement the dialog, the Egreso button and the view**

Create `web/src/components/stays/CheckOutDialog.vue`:

```vue
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { type CloseEventArgs, DialogComponent as EjsDialog } from '@syncfusion/ej2-vue-popups'
import DateField from '@/components/forms/DateField.vue'
import type { ResidentRow } from '@/composables/useResidents'
import { useShelterTime } from '@/composables/useShelterTime'

const props = defineProps<{ resident: ResidentRow | null }>()
const emit = defineEmits<{ confirm: [exitDate: string]; cancel: [] }>()

const { t } = useI18n()
const { today } = useShelterTime()
const todayDate = ref(today())
const exitDate = ref<string | null>(todayDate.value)
const submitted = ref(false)

// The dialog stays mounted; every opening starts from today's date.
watch(
  () => props.resident,
  (resident) => {
    if (!resident) return
    todayDate.value = today()
    exitDate.value = todayDate.value
    submitted.value = false
  },
  { immediate: true },
)

const error = computed(() => {
  if (!props.resident) return null
  if (!exitDate.value) return 'validation.required'
  if (exitDate.value > todayDate.value) return 'validation.dateInFuture'
  if (exitDate.value < props.resident.entry_date) return 'validation.exitBeforeEntry'
  return null
})

function submit(): void {
  submitted.value = true
  if (error.value || !exitDate.value) return
  emit('confirm', exitDate.value)
}

function onClose(args: CloseEventArgs): void {
  if (args.isInteracted) emit('cancel')
}
</script>

<template>
  <ejs-dialog
    :visible="resident !== null"
    :is-modal="true"
    :show-close-icon="true"
    :close-on-escape="true"
    :animation-settings="{ effect: 'None' }"
    :header="t('stays.checkOut.title')"
    width="min(30rem, 95vw)"
    @close="onClose"
  >
    <form v-if="resident" class="check-out-form" novalidate @submit.prevent="submit">
      <p class="fw-semibold">{{ resident.full_name }}</p>
      <div
        v-if="resident.phone_status === 'in_custody'"
        class="alert alert-warning py-2"
        role="alert"
        data-testid="phone-warning"
      >
        {{ t('stays.checkOut.phoneWarning') }}
      </div>
      <div
        v-if="resident.presence === 'outside'"
        class="alert alert-warning py-2"
        role="alert"
        data-testid="outside-warning"
      >
        {{ t('stays.checkOut.outsideWarning') }}
      </div>
      <label for="check-out-date" class="form-label">{{ t('stays.checkOut.exitDate') }}</label>
      <DateField
        id="check-out-date"
        v-model="exitDate"
        :min="resident.entry_date"
        :max="todayDate"
        :invalid="submitted && error !== null"
      />
      <div v-if="submitted && error" class="invalid-feedback d-block">{{ t(error) }}</div>
      <div class="d-flex justify-content-end gap-2 mt-3">
        <button type="button" class="btn btn-outline-secondary" @click="emit('cancel')">
          {{ t('common.cancel') }}
        </button>
        <button type="submit" class="btn btn-danger">{{ t('stays.checkOut.submit') }}</button>
      </div>
    </form>
  </ejs-dialog>
</template>
```

In `web/src/components/residents/ResidentsGrid.vue`, change the emits to:

```ts
const emit = defineEmits<{
  'start-outing': [stayId: string]
  'end-outing': [stayId: string]
  'check-out': [stayId: string]
}>()
```

and insert this button in the actions template, between the Salida/Regreso buttons and the `RouterLink`:

```vue
            <button
              type="button"
              class="btn btn-sm btn-outline-danger"
              :disabled="data.busy"
              @click="emit('check-out', data.stay_id)"
            >
              {{ t('stays.checkOut.action') }}
            </button>
```

In `web/src/views/ResidentsView.vue`:
- add `import { checkOut } from '@/api/stays'` and `import CheckOutDialog from '@/components/stays/CheckOutDialog.vue'` to the imports;
- add these declarations after `const outingTarget = ref<ResidentRow | null>(null)`:

```ts
const checkOutTarget = ref<ResidentRow | null>(null)

function openCheckOut(stayId: string): void {
  checkOutTarget.value = findRow(stayId) ?? null
}

async function confirmCheckOut(exitDate: string): Promise<void> {
  const row = checkOutTarget.value
  checkOutTarget.value = null
  if (!row) return
  await runRowAction(row, async () => {
    await checkOut(row.stay_id, exitDate)
    notify.success('stays.checkOut.done', { name: row.full_name })
  })
}
```

- replace the `<ResidentsGrid ... />` element with:

```vue
    <ResidentsGrid
      :rows="rows"
      @start-outing="openOuting"
      @end-outing="recordReturn"
      @check-out="openCheckOut"
    />
```

- and add after the `<OutingStartDialog ... />` element:

```vue
    <CheckOutDialog :resident="checkOutTarget" @confirm="confirmCheckOut" @cancel="checkOutTarget = null" />
```

Add this top-level key to `web/src/i18n/locales/es-MX.json`:

```json
{
  "stays": {
    "checkOut": {
      "action": "Egreso",
      "title": "Registrar egreso",
      "exitDate": "Fecha de egreso",
      "phoneWarning": "Tiene su teléfono en custodia: devolver el teléfono.",
      "outsideWarning": "Está fuera del albergue: se registrará como salió y no regresó.",
      "submit": "Registrar egreso",
      "done": "Egreso registrado: {name}"
    }
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm --prefix web run test -- tests/lib/dates.test.ts tests/components/forms tests/components/stays tests/views`

Expected: PASS.

Run: `npm --prefix web run test:integration -- tests/integration/check-out.test.ts`

Expected: PASS.

- [ ] **Step 6: Run the whole suite, the type check and the linter**

Run: `npm run web:test`, then `npm run web:typecheck`, then `npm run web:lint`

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add web/src/lib/dates.ts web/src/api/stays.ts web/src/components/forms/DateField.vue web/src/components/stays/CheckOutDialog.vue web/src/components/residents/ResidentsGrid.vue web/src/views/ResidentsView.vue web/src/i18n/locales/es-MX.json web/tests
git commit -m "feat(web): check people out from the residents list with phone and outing warnings"
```

---
### Task 4: Registration form with carer picker

**Files:**
- Create: `web/src/api/people.ts`
- Modify: `web/src/api/stays.ts`
- Create: `web/src/components/forms/fieldErrors.ts`, `web/src/components/people/personFormModel.ts`, `web/src/components/people/PersonForm.vue`, `web/src/components/people/CarerPicker.vue`, `web/src/components/stays/stayFormModel.ts`, `web/src/components/stays/StayForm.vue`
- Replace: `web/src/views/PersonNewView.vue`
- Modify: `web/src/i18n/locales/es-MX.json`
- Create tests: `web/tests/components/people/personFormModel.test.ts`, `web/tests/components/stays/stayFormModel.test.ts`, `web/tests/components/people/CarerPicker.test.ts`, `web/tests/components/people/PersonForm.test.ts`, `web/tests/views/PersonNewView.test.ts`, `web/tests/integration/registration.test.ts`

**Interfaces:**
- Consumes: `DateField` (Task 3), `listCurrentResidents` (Task 1), `CatalogSelect` (props `catalog`, `modelValue`, `placeholderKey`, `allowEmpty`, `id`), `ageOn`, `todayIn`, `cleanText`, `Json` (`@/types/database`), `Person`, `Stay`, `PhoneStatus`.
- Produces:
  - In `api/stays.ts`: `NewStayInput`, `StayPatch` (contract shapes) and `cleanStay(input: StayPatch): StayPatch`.
  - In `api/people.ts`: `NewPersonInput`, `PersonPatch` (contract shapes), `registerAndCheckIn(person, stay): Promise<{ person_id: string; stay_id: string }>`.
  - `FieldErrors = Record<string, string>` (field name to i18n key) and `hasErrors(errors): boolean` in `components/forms/fieldErrors.ts`.
  - In `personFormModel.ts`: `PersonFormValue`, `OLDEST_BIRTH_DATE`, `emptyPerson()`, `personToForm(person)`, `isMinorOn(birthDate, today)`, `formToPersonInput(value, today)`, `validatePerson(value, today)`.
  - In `stayFormModel.ts`: `StayFormValue`, `emptyStay(today)`, `stayToForm(stay)`, `formToStayInput(value)`, `formToStayPatch(value, closed)`, `validateStay(value, today, closed = false)`.
  - `PersonForm` (`v-model` of `PersonFormValue`; props `errors?`, `personId?`, `carerLabel?`). Field ids: `person-first-name`, `person-last-name`, `person-birth-date`, `person-birth-estimated`, `person-gender`, `person-country`, `person-region`, `person-carer`.
  - `StayForm` (`v-model` of `StayFormValue`; props `errors?`, `idPrefix = 'stay'`, `showExitDate = false`). Field ids: `<prefix>-entry-date`, `<prefix>-exit-date`, `<prefix>-bed`, `<prefix>-case-type`, `<prefix>-phone-status`, `<prefix>-notes`.
  - `CarerPicker` (props `id`, `modelValue: string | null`, `excludeId?`, `currentLabel?`; emits `update:modelValue`).
  - `PersonNewView` submits the form `form.registration-form`.

- [ ] **Step 1: Write the failing model and integration tests**

Create `web/tests/components/people/personFormModel.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  emptyPerson,
  formToPersonInput,
  isMinorOn,
  personToForm,
  validatePerson,
} from '@/components/people/personFormModel'
import { makePerson, uuid } from '../../fixtures/data'

const today = '2026-10-07'

describe('validatePerson', () => {
  it('requires a first name', () => {
    expect(validatePerson({ ...emptyPerson(), first_name: '   ' }, today)).toEqual({
      first_name: 'validation.required',
    })
  })

  it('rejects a birth date after today', () => {
    expect(validatePerson({ ...emptyPerson(), first_name: 'Ana', birth_date: '2026-10-08' }, today)).toEqual({
      birth_date: 'validation.dateInFuture',
    })
  })

  it('rejects a birth date before 1900', () => {
    expect(validatePerson({ ...emptyPerson(), first_name: 'Ana', birth_date: '1899-12-31' }, today)).toEqual({
      birth_date: 'validation.birthDateImplausible',
    })
  })

  it('accepts a person with a single name and nothing else', () => {
    expect(validatePerson({ ...emptyPerson(), first_name: 'Wilmer' }, today)).toEqual({})
  })
})

describe('isMinorOn', () => {
  it('is true the day before the 18th birthday and false on it', () => {
    expect(isMinorOn('2008-10-08', today)).toBe(true)
    expect(isMinorOn('2008-10-07', today)).toBe(false)
  })

  it('is false when the birth date is unknown', () => {
    expect(isMinorOn(null, today)).toBe(false)
  })
})

describe('formToPersonInput', () => {
  it('keeps the carer for a minor', () => {
    const input = formToPersonInput(
      { ...emptyPerson(), first_name: 'Lucía', birth_date: '2016-01-01', carer_id: uuid(1) },
      today,
    )
    expect(input.carer_id).toBe(uuid(1))
  })

  it('drops the carer when the person is not a minor or the age is unknown', () => {
    expect(
      formToPersonInput({ ...emptyPerson(), first_name: 'Ana', birth_date: '1990-01-01', carer_id: uuid(1) }, today)
        .carer_id,
    ).toBeNull()
    expect(formToPersonInput({ ...emptyPerson(), first_name: 'Ana', carer_id: uuid(1) }, today).carer_id).toBeNull()
  })

  it('clears the estimated flag when there is no birth date', () => {
    expect(
      formToPersonInput({ ...emptyPerson(), first_name: 'Ana', birth_date_estimated: true }, today)
        .birth_date_estimated,
    ).toBe(false)
  })
})

describe('personToForm', () => {
  it('turns missing text into empty strings for the inputs', () => {
    const form = personToForm(makePerson({ last_name: null, region: null }))
    expect(form.last_name).toBe('')
    expect(form.region).toBe('')
    expect(form.first_name).toBe('Rosa Elena')
  })
})
```

Create `web/tests/components/stays/stayFormModel.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  emptyStay,
  formToStayInput,
  formToStayPatch,
  stayToForm,
  validateStay,
} from '@/components/stays/stayFormModel'
import { makeStay } from '../../fixtures/data'

const today = '2026-10-07'

describe('validateStay', () => {
  it('starts today with a phone status of none', () => {
    expect(emptyStay(today)).toEqual({
      entry_date: today,
      exit_date: null,
      case_type_code: null,
      bed: '',
      phone_status: 'none',
      notes: '',
    })
  })

  it('requires an entry date that is not in the future', () => {
    expect(validateStay({ ...emptyStay(today), entry_date: null }, today)).toEqual({
      entry_date: 'validation.required',
    })
    expect(validateStay({ ...emptyStay(today), entry_date: '2026-10-08' }, today)).toEqual({
      entry_date: 'validation.dateInFuture',
    })
  })

  it('checks the exit date only for a closed stay', () => {
    const value = { ...emptyStay(today), entry_date: '2026-10-05', exit_date: '2026-10-04' }
    expect(validateStay(value, today)).toEqual({})
    expect(validateStay(value, today, true)).toEqual({ exit_date: 'validation.exitBeforeEntry' })
    expect(validateStay({ ...value, exit_date: null }, today, true)).toEqual({
      exit_date: 'validation.required',
    })
    expect(validateStay({ ...value, exit_date: '2026-10-08' }, today, true)).toEqual({
      exit_date: 'validation.dateInFuture',
    })
  })
})

describe('form conversions', () => {
  it('sends the stay fields and leaves trimming to the API', () => {
    expect(formToStayInput({ ...emptyStay(today), bed: ' A1 ', notes: '' })).toEqual({
      entry_date: today,
      case_type_code: null,
      bed: ' A1 ',
      phone_status: 'none',
      notes: '',
    })
  })

  it('includes the exit date only when editing a closed stay', () => {
    const form = stayToForm(makeStay({ exit_date: '2026-10-05' }))
    expect(formToStayPatch(form, false)).not.toHaveProperty('exit_date')
    expect(formToStayPatch(form, true).exit_date).toBe('2026-10-05')
  })
})
```

Create `web/tests/integration/registration.test.ts`:

```ts
import { beforeAll, describe, expect, it } from 'vitest'
import { registerAndCheckIn } from '@/api/people'
import { listCurrentResidents } from '@/api/stays'
import { signInAs, uniqueSuffix } from './helpers'

describe('registration', () => {
  beforeAll(async () => {
    await signInAs('volunteer')
  })

  it('creates the person and an open stay in one call, trimming text', async () => {
    const name = `Prueba ${uniqueSuffix()}`
    const { person_id, stay_id } = await registerAndCheckIn(
      { first_name: `  ${name}  `, last_name: '   ', region: ' Cortés ' },
      { bed: ' A1 ', phone_status: 'with_person' },
    )
    const row = (await listCurrentResidents()).find((resident) => resident.stay_id === stay_id)
    expect(row).toMatchObject({
      person_id,
      first_name: name,
      last_name: null,
      region: 'Cortés',
      bed: 'A1',
      phone_status: 'with_person',
    })
  })

  it('rejects a blank first name and creates nothing', async () => {
    await expect(registerAndCheckIn({ first_name: '   ' }, {})).rejects.toMatchObject({ code: 'validation' })
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm --prefix web run test -- tests/components/people/personFormModel.test.ts tests/components/stays/stayFormModel.test.ts`

Expected: FAIL, because the model modules do not exist yet.

Run: `npm run db:reset`, then `npm --prefix web run test:integration -- tests/integration/registration.test.ts`

Expected: FAIL, because `@/api/people` does not exist yet.

- [ ] **Step 3: Implement the API input types and the form models**

In `web/src/api/stays.ts`, change the first import line to `import type { CurrentResident, PhoneStatus } from '@/types/domain'`, add `import { cleanText } from '@/lib/text'` below it, and append:

```ts
export interface NewStayInput {
  entry_date?: string
  case_type_code?: string | null
  bed?: string | null
  phone_status?: PhoneStatus
  notes?: string | null
}

export type StayPatch = Partial<NewStayInput> & { exit_date?: string | null }

/** Trims free text the same way the database does, so what is saved matches what was checked. */
export function cleanStay(input: StayPatch): StayPatch {
  const cleaned: StayPatch = { ...input }
  if ('bed' in input) cleaned.bed = cleanText(input.bed)
  if ('notes' in input) cleaned.notes = cleanText(input.notes)
  return cleaned
}
```

Create `web/src/api/people.ts`:

```ts
import { cleanText } from '@/lib/text'
import type { Json } from '@/types/database'
import { supabase } from './client'
import { toApiError } from './errors'
import { cleanStay, type NewStayInput } from './stays'

export interface NewPersonInput {
  first_name: string
  last_name?: string | null
  birth_date?: string | null
  birth_date_estimated?: boolean
  gender_code?: string | null
  country_code?: string | null
  region?: string | null
  carer_id?: string | null
}

export type PersonPatch = Partial<NewPersonInput>

/** Trims names and region the same way the database does. */
function cleanPerson(input: PersonPatch): PersonPatch {
  const cleaned: PersonPatch = { ...input }
  if ('first_name' in input) cleaned.first_name = cleanText(input.first_name) ?? ''
  if ('last_name' in input) cleaned.last_name = cleanText(input.last_name)
  if ('region' in input) cleaned.region = cleanText(input.region)
  return cleaned
}

/** Creates the person and opens their first stay in one transaction. */
export async function registerAndCheckIn(
  person: NewPersonInput,
  stay: NewStayInput,
): Promise<{ person_id: string; stay_id: string }> {
  const { data, error } = await supabase.rpc('register_person_and_check_in', {
    p_person: cleanPerson(person) as unknown as Json,
    p_stay: cleanStay(stay) as unknown as Json,
  })
  if (error) throw toApiError(error)
  return data as unknown as { person_id: string; stay_id: string }
}
```

Create `web/src/components/forms/fieldErrors.ts`:

```ts
/** Field name to the i18n key of its error message. */
export type FieldErrors = Record<string, string>

export function hasErrors(errors: FieldErrors): boolean {
  return Object.keys(errors).length > 0
}
```

Create `web/src/components/people/personFormModel.ts`:

```ts
import type { NewPersonInput } from '@/api/people'
import type { FieldErrors } from '@/components/forms/fieldErrors'
import { ageOn } from '@/lib/shelterTime'
import { cleanText } from '@/lib/text'
import type { Person } from '@/types/domain'

export interface PersonFormValue {
  first_name: string
  last_name: string
  birth_date: string | null
  birth_date_estimated: boolean
  gender_code: string | null
  country_code: string | null
  region: string
  carer_id: string | null
}

/** Mirrors the database check on people.birth_date. */
export const OLDEST_BIRTH_DATE = '1900-01-01'

export function emptyPerson(): PersonFormValue {
  return {
    first_name: '',
    last_name: '',
    birth_date: null,
    birth_date_estimated: false,
    gender_code: null,
    country_code: null,
    region: '',
    carer_id: null,
  }
}

export function personToForm(person: Person): PersonFormValue {
  return {
    first_name: person.first_name,
    last_name: person.last_name ?? '',
    birth_date: person.birth_date,
    birth_date_estimated: person.birth_date_estimated,
    gender_code: person.gender_code,
    country_code: person.country_code,
    region: person.region ?? '',
    carer_id: person.carer_id,
  }
}

export function isMinorOn(birthDate: string | null, today: string): boolean {
  const age = ageOn(birthDate, today)
  return age !== null && age < 18
}

/** The carer only applies to minors; it is cleared whenever the picker is hidden. */
export function formToPersonInput(value: PersonFormValue, today: string): NewPersonInput {
  return {
    first_name: value.first_name,
    last_name: value.last_name,
    birth_date: value.birth_date,
    birth_date_estimated: value.birth_date !== null && value.birth_date_estimated,
    gender_code: value.gender_code,
    country_code: value.country_code,
    region: value.region,
    carer_id: isMinorOn(value.birth_date, today) ? value.carer_id : null,
  }
}

export function validatePerson(value: PersonFormValue, today: string): FieldErrors {
  const errors: FieldErrors = {}
  if (!cleanText(value.first_name)) errors.first_name = 'validation.required'
  if (value.birth_date && value.birth_date > today) {
    errors.birth_date = 'validation.dateInFuture'
  } else if (value.birth_date && value.birth_date < OLDEST_BIRTH_DATE) {
    errors.birth_date = 'validation.birthDateImplausible'
  }
  return errors
}
```

Create `web/src/components/stays/stayFormModel.ts`:

```ts
import type { NewStayInput, StayPatch } from '@/api/stays'
import type { FieldErrors } from '@/components/forms/fieldErrors'
import type { PhoneStatus, Stay } from '@/types/domain'

export interface StayFormValue {
  entry_date: string | null
  exit_date: string | null
  case_type_code: string | null
  bed: string
  phone_status: PhoneStatus
  notes: string
}

export function emptyStay(today: string): StayFormValue {
  return { entry_date: today, exit_date: null, case_type_code: null, bed: '', phone_status: 'none', notes: '' }
}

export function stayToForm(stay: Stay): StayFormValue {
  return {
    entry_date: stay.entry_date,
    exit_date: stay.exit_date,
    case_type_code: stay.case_type_code,
    bed: stay.bed ?? '',
    phone_status: stay.phone_status as PhoneStatus,
    notes: stay.notes ?? '',
  }
}

export function formToStayInput(value: StayFormValue): NewStayInput {
  return {
    entry_date: value.entry_date ?? undefined,
    case_type_code: value.case_type_code,
    bed: value.bed,
    phone_status: value.phone_status,
    notes: value.notes,
  }
}

/** The exit date is editable only on a stay that is already closed. */
export function formToStayPatch(value: StayFormValue, closed: boolean): StayPatch {
  const patch: StayPatch = formToStayInput(value)
  if (closed) patch.exit_date = value.exit_date
  return patch
}

export function validateStay(value: StayFormValue, today: string, closed = false): FieldErrors {
  const errors: FieldErrors = {}
  if (!value.entry_date) errors.entry_date = 'validation.required'
  else if (value.entry_date > today) errors.entry_date = 'validation.dateInFuture'
  if (closed) {
    if (!value.exit_date) errors.exit_date = 'validation.required'
    else if (value.exit_date > today) errors.exit_date = 'validation.dateInFuture'
    else if (value.entry_date && value.exit_date < value.entry_date) {
      errors.exit_date = 'validation.exitBeforeEntry'
    }
  }
  return errors
}
```

- [ ] **Step 4: Run them to verify they pass**

Run: `npm --prefix web run test -- tests/components/people/personFormModel.test.ts tests/components/stays/stayFormModel.test.ts`

Expected: PASS.

Run: `npm --prefix web run test:integration -- tests/integration/registration.test.ts`

Expected: PASS.

- [ ] **Step 5: Write the failing component and view tests**

Create `web/tests/components/people/CarerPicker.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DropDownListComponent } from '@syncfusion/ej2-vue-dropdowns'
import { listCurrentResidents } from '@/api/stays'
import CarerPicker from '@/components/people/CarerPicker.vue'
import { makeResident, uuid } from '../../fixtures/data'
import { mountWithApp } from '../../utils/mountWithApp'

const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('@/composables/useNotify', () => ({ useNotify: () => notify }))
vi.mock('@/api/stays', () => ({ listCurrentResidents: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(listCurrentResidents).mockResolvedValue([
    makeResident({ person_id: uuid(1), bed: 'A1' }),
    makeResident({ person_id: uuid(2), first_name: 'Tomás', last_name: 'Gutiérrez', bed: null }),
  ])
})

afterEach(() => {
  document.body.innerHTML = ''
})

async function mountPicker(props: Record<string, unknown>) {
  const { wrapper } = await mountWithApp(CarerPicker, { props: { id: 'carer', modelValue: null, ...props } })
  await vi.waitFor(() => expect(wrapper.findComponent(DropDownListComponent).exists()).toBe(true))
  return wrapper
}

describe('CarerPicker', () => {
  it('offers the current residents except the person being edited, with their bed', async () => {
    const wrapper = await mountPicker({ excludeId: uuid(2) })
    expect(wrapper.findComponent(DropDownListComponent).props('dataSource')).toEqual([
      { value: uuid(1), text: 'Rosa Elena Pérez Lara (A1)' },
    ])
  })

  it('keeps a carer who is no longer staying, using the label it is given', async () => {
    const wrapper = await mountPicker({ modelValue: uuid(9), currentLabel: 'Carmen Ríos' })
    expect(wrapper.findComponent(DropDownListComponent).props('dataSource')).toContainEqual({
      value: uuid(9),
      text: 'Carmen Ríos',
    })
    expect((wrapper.find('#carer').element as HTMLInputElement).value).toBe('Carmen Ríos')
  })

  it('emits the chosen carer', async () => {
    const wrapper = await mountPicker({})
    wrapper.findComponent(DropDownListComponent).vm.$emit('change', { value: uuid(1), isInteracted: true })
    expect(wrapper.emitted('update:modelValue')).toEqual([[uuid(1)]])
  })
})
```

Create `web/tests/components/people/PersonForm.test.ts`:

```ts
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
```

Create `web/tests/views/PersonNewView.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { ApiError } from '@/api/errors'
import { registerAndCheckIn } from '@/api/people'
import { todayIn } from '@/lib/shelterTime'
import PersonNewView from '@/views/PersonNewView.vue'
import { uuid } from '../fixtures/data'
import { mountWithApp } from '../utils/mountWithApp'

const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('@/composables/useNotify', () => ({ useNotify: () => notify }))
vi.mock('@/composables/useConfirm', () => ({ useConfirm: () => ({ confirm: vi.fn() }) }))
vi.mock('@/api/people', () => ({
  registerAndCheckIn: vi.fn(),
  findPossibleDuplicates: vi.fn(async () => []),
}))
vi.mock('@/api/stays', () => ({ listCurrentResidents: vi.fn(async () => []) }))
vi.mock('@/api/photos', () => ({
  photoPathFor: (id: string) => `${id}.jpg`,
  thumbPathFor: (path: string) => path.replace(/\.jpg$/, '_thumb.jpg'),
  getSignedPhotoUrls: vi.fn(async () => ({})),
  uploadPersonPhoto: vi.fn(),
}))

const tz = 'America/Mexico_City'

function mountView() {
  return mountWithApp(PersonNewView, { initialRoute: '/people/new' })
}

function valueOf(wrapper: Awaited<ReturnType<typeof mountView>>['wrapper'], selector: string): string {
  return (wrapper.find(selector).element as HTMLInputElement).value
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('PersonNewView', () => {
  it('registers the person and the first stay in one call, then opens the record', async () => {
    vi.mocked(registerAndCheckIn).mockResolvedValue({ person_id: uuid(1), stay_id: uuid(101) })
    const { wrapper, router } = await mountView()
    await wrapper.find('#person-first-name').setValue('Rosa Elena')
    await wrapper.find('#person-last-name').setValue('Pérez Lara')
    await wrapper.find('#stay-bed').setValue('A1')
    await wrapper.find('#stay-phone-status').setValue('in_custody')
    await wrapper.find('form.registration-form').trigger('submit')
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('person'))
    expect(router.currentRoute.value.params.id).toBe(uuid(1))
    expect(registerAndCheckIn).toHaveBeenCalledWith(
      {
        first_name: 'Rosa Elena',
        last_name: 'Pérez Lara',
        birth_date: null,
        birth_date_estimated: false,
        gender_code: null,
        country_code: null,
        region: '',
        carer_id: null,
      },
      { entry_date: todayIn(tz), case_type_code: null, bed: 'A1', phone_status: 'in_custody', notes: '' },
    )
    expect(notify.success).toHaveBeenCalledWith('registration.saved')
  })

  it('does not call the server when the first name is blank', async () => {
    const { wrapper } = await mountView()
    await wrapper.find('form.registration-form').trigger('submit')
    expect(registerAndCheckIn).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Este dato es obligatorio.')
    expect(wrapper.text()).toContain('Revisa los campos marcados.')
  })

  it('keeps everything typed when the server fails', async () => {
    vi.mocked(registerAndCheckIn).mockRejectedValue(new ApiError('network'))
    const { wrapper, router } = await mountView()
    await wrapper.find('#person-first-name').setValue('Rosa Elena')
    await wrapper.find('#stay-bed').setValue('A1')
    await wrapper.find('form.registration-form').trigger('submit')
    await vi.waitFor(() =>
      expect(notify.error).toHaveBeenCalledWith(expect.objectContaining({ code: 'network' })),
    )
    expect(valueOf(wrapper, '#person-first-name')).toBe('Rosa Elena')
    expect(valueOf(wrapper, '#stay-bed')).toBe('A1')
    expect(router.currentRoute.value.name).toBe('person-new')
  })

  it('sends one request when the form is submitted twice', async () => {
    vi.mocked(registerAndCheckIn).mockReturnValue(new Promise(() => {}))
    const { wrapper } = await mountView()
    await wrapper.find('#person-first-name').setValue('Rosa Elena')
    const form = wrapper.find('form.registration-form')
    void form.trigger('submit')
    void form.trigger('submit')
    await flushPromises()
    expect(registerAndCheckIn).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 6: Run them to verify they fail**

Run: `npm --prefix web run test -- tests/components/people tests/views/PersonNewView.test.ts`

Expected: FAIL, because `CarerPicker`, `PersonForm` and the real `PersonNewView` do not exist yet.

- [ ] **Step 7: Implement the carer picker and the two forms**

Create `web/src/components/people/CarerPicker.vue`:

```vue
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { DropDownListComponent as EjsDropdownlist } from '@syncfusion/ej2-vue-dropdowns'
import { listCurrentResidents } from '@/api/stays'
import { useNotify } from '@/composables/useNotify'
import { fullName } from '@/lib/people'
import type { CurrentResident } from '@/types/domain'

const props = withDefaults(
  defineProps<{
    id: string
    modelValue: string | null
    excludeId?: string | null
    currentLabel?: string | null
  }>(),
  { excludeId: null, currentLabel: null },
)
const emit = defineEmits<{ 'update:modelValue': [value: string | null] }>()

const { t } = useI18n()
const notify = useNotify()
const residents = ref<CurrentResident[]>([])
const loaded = ref(false)

onMounted(async () => {
  try {
    residents.value = await listCurrentResidents()
  } catch (error) {
    notify.error(error)
  } finally {
    loaded.value = true
  }
})

interface Option {
  value: string
  text: string
}

const options = computed<Option[]>(() => {
  const list = residents.value
    .filter(
      (resident): resident is CurrentResident & { person_id: string } =>
        !!resident.person_id && resident.person_id !== props.excludeId,
    )
    .map((resident) => {
      const name = fullName(resident.first_name, resident.last_name)
      return { value: resident.person_id, text: resident.bed ? `${name} (${resident.bed})` : name }
    })
    .sort((a, b) => a.text.localeCompare(b.text, 'es'))
  // A carer who already left the shelter stays selectable so editing does not lose them.
  if (props.modelValue && props.currentLabel && !list.some((option) => option.value === props.modelValue)) {
    list.unshift({ value: props.modelValue, text: props.currentLabel })
  }
  return list
})

const fields = { text: 'text', value: 'value' }

function onChange(args: { value: string | null }): void {
  const next = args.value ?? null
  if (next !== props.modelValue) emit('update:modelValue', next)
}
</script>

<template>
  <ejs-dropdownlist
    v-if="loaded"
    :id="id"
    :value="modelValue"
    :data-source="options"
    :fields="fields"
    :allow-filtering="true"
    filter-type="Contains"
    :ignore-accent="true"
    :show-clear-button="true"
    :placeholder="t('person.form.carerPlaceholder')"
    :filter-bar-placeholder="t('person.form.carerFilter')"
    @change="onChange"
  />
  <input v-else :id="id" class="form-control" disabled :placeholder="t('person.form.carerLoading')" />
</template>
```

Create `web/src/components/people/PersonForm.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import CatalogSelect from '@/components/common/CatalogSelect.vue'
import DateField from '@/components/forms/DateField.vue'
import type { FieldErrors } from '@/components/forms/fieldErrors'
import CarerPicker from '@/components/people/CarerPicker.vue'
import { isMinorOn, OLDEST_BIRTH_DATE, type PersonFormValue } from '@/components/people/personFormModel'
import { useShelterTime } from '@/composables/useShelterTime'
import { formatAge } from '@/lib/people'
import { ageOn } from '@/lib/shelterTime'

const model = defineModel<PersonFormValue>({ required: true })
withDefaults(defineProps<{ errors?: FieldErrors; personId?: string | null; carerLabel?: string | null }>(), {
  errors: () => ({}),
  personId: null,
  carerLabel: null,
})

const { t } = useI18n()
const { today } = useShelterTime()
const todayDate = today()
const age = computed(() => ageOn(model.value.birth_date, todayDate))
const minor = computed(() => isMinorOn(model.value.birth_date, todayDate))
</script>

<template>
  <div class="row g-3">
    <div class="col-md-6">
      <label for="person-first-name" class="form-label">{{ t('person.form.firstName') }}</label>
      <input
        id="person-first-name"
        v-model="model.first_name"
        type="text"
        class="form-control"
        :class="{ 'is-invalid': errors.first_name }"
        autocomplete="off"
        required
      />
      <div v-if="errors.first_name" class="invalid-feedback">{{ t(errors.first_name) }}</div>
    </div>
    <div class="col-md-6">
      <label for="person-last-name" class="form-label">{{ t('person.form.lastName') }}</label>
      <input id="person-last-name" v-model="model.last_name" type="text" class="form-control" autocomplete="off" />
    </div>
    <div class="col-md-6">
      <label for="person-birth-date" class="form-label">{{ t('person.form.birthDate') }}</label>
      <DateField
        id="person-birth-date"
        v-model="model.birth_date"
        :min="OLDEST_BIRTH_DATE"
        :max="todayDate"
        :invalid="!!errors.birth_date"
      />
      <div v-if="errors.birth_date" class="invalid-feedback d-block">{{ t(errors.birth_date) }}</div>
      <div class="d-flex flex-wrap align-items-center gap-3 mt-2">
        <div class="form-check mb-0">
          <input
            id="person-birth-estimated"
            v-model="model.birth_date_estimated"
            class="form-check-input"
            type="checkbox"
            :disabled="!model.birth_date"
          />
          <label for="person-birth-estimated" class="form-check-label">{{ t('person.form.birthDateEstimated') }}</label>
        </div>
        <span v-if="age !== null" class="small text-body-secondary" data-testid="person-age">{{
          t('person.form.age', { age: formatAge(age, model.birth_date_estimated) })
        }}</span>
      </div>
    </div>
    <div class="col-md-6">
      <label for="person-gender" class="form-label">{{ t('person.form.gender') }}</label>
      <CatalogSelect
        id="person-gender"
        v-model="model.gender_code"
        catalog="genders"
        placeholder-key="person.form.genderPlaceholder"
        allow-empty
      />
    </div>
    <div class="col-md-6">
      <label for="person-country" class="form-label">{{ t('person.form.country') }}</label>
      <CatalogSelect
        id="person-country"
        v-model="model.country_code"
        catalog="countries"
        placeholder-key="person.form.countryPlaceholder"
        allow-empty
      />
    </div>
    <div class="col-md-6">
      <label for="person-region" class="form-label">{{ t('person.form.region') }}</label>
      <input id="person-region" v-model="model.region" type="text" class="form-control" autocomplete="off" />
    </div>
    <div v-if="minor" class="col-12" data-testid="carer-section">
      <label for="person-carer" class="form-label">{{ t('person.form.carer') }}</label>
      <CarerPicker
        id="person-carer"
        v-model="model.carer_id"
        :exclude-id="personId"
        :current-label="carerLabel"
      />
      <div class="form-text">{{ t('person.form.carerHelp') }}</div>
    </div>
  </div>
</template>
```

Create `web/src/components/stays/StayForm.vue`:

```vue
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import CatalogSelect from '@/components/common/CatalogSelect.vue'
import DateField from '@/components/forms/DateField.vue'
import type { FieldErrors } from '@/components/forms/fieldErrors'
import type { StayFormValue } from '@/components/stays/stayFormModel'
import { useShelterTime } from '@/composables/useShelterTime'
import type { PhoneStatus } from '@/types/domain'

const model = defineModel<StayFormValue>({ required: true })
withDefaults(defineProps<{ errors?: FieldErrors; idPrefix?: string; showExitDate?: boolean }>(), {
  errors: () => ({}),
  idPrefix: 'stay',
  showExitDate: false,
})

const { t } = useI18n()
const { today } = useShelterTime()
const todayDate = today()
const phoneStatuses: PhoneStatus[] = ['none', 'with_person', 'in_custody']
</script>

<template>
  <div class="row g-3">
    <div class="col-md-6">
      <label :for="`${idPrefix}-entry-date`" class="form-label">{{ t('stays.form.entryDate') }}</label>
      <DateField
        :id="`${idPrefix}-entry-date`"
        v-model="model.entry_date"
        :max="todayDate"
        :invalid="!!errors.entry_date"
      />
      <div v-if="errors.entry_date" class="invalid-feedback d-block">{{ t(errors.entry_date) }}</div>
    </div>
    <div v-if="showExitDate" class="col-md-6">
      <label :for="`${idPrefix}-exit-date`" class="form-label">{{ t('stays.form.exitDate') }}</label>
      <DateField
        :id="`${idPrefix}-exit-date`"
        v-model="model.exit_date"
        :min="model.entry_date"
        :max="todayDate"
        :invalid="!!errors.exit_date"
      />
      <div v-if="errors.exit_date" class="invalid-feedback d-block">{{ t(errors.exit_date) }}</div>
    </div>
    <div class="col-md-6">
      <label :for="`${idPrefix}-bed`" class="form-label">{{ t('stays.form.bed') }}</label>
      <input :id="`${idPrefix}-bed`" v-model="model.bed" type="text" class="form-control" autocomplete="off" />
    </div>
    <div class="col-md-6">
      <label :for="`${idPrefix}-case-type`" class="form-label">{{ t('stays.form.caseType') }}</label>
      <CatalogSelect
        :id="`${idPrefix}-case-type`"
        v-model="model.case_type_code"
        catalog="case_types"
        placeholder-key="stays.form.caseTypePlaceholder"
        allow-empty
      />
    </div>
    <div class="col-md-6">
      <label :for="`${idPrefix}-phone-status`" class="form-label">{{ t('stays.form.phoneStatus') }}</label>
      <select :id="`${idPrefix}-phone-status`" v-model="model.phone_status" class="form-select">
        <option v-for="status in phoneStatuses" :key="status" :value="status">
          {{ t(`phoneStatus.${status}`) }}
        </option>
      </select>
    </div>
    <div class="col-12">
      <label :for="`${idPrefix}-notes`" class="form-label">{{ t('stays.form.notes') }}</label>
      <textarea :id="`${idPrefix}-notes`" v-model="model.notes" class="form-control" rows="2" />
    </div>
  </div>
</template>
```

- [ ] **Step 8: Implement the registration view**

Replace `web/src/views/PersonNewView.vue` with:

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { registerAndCheckIn } from '@/api/people'
import PageHeader from '@/components/common/PageHeader.vue'
import { type FieldErrors, hasErrors } from '@/components/forms/fieldErrors'
import PersonForm from '@/components/people/PersonForm.vue'
import { emptyPerson, formToPersonInput, validatePerson } from '@/components/people/personFormModel'
import StayForm from '@/components/stays/StayForm.vue'
import { emptyStay, formToStayInput, validateStay } from '@/components/stays/stayFormModel'
import { useNotify } from '@/composables/useNotify'
import { useShelterTime } from '@/composables/useShelterTime'

const { t } = useI18n()
const router = useRouter()
const notify = useNotify()
const { today } = useShelterTime()

const person = ref(emptyPerson())
const stay = ref(emptyStay(today()))
const personErrors = ref<FieldErrors>({})
const stayErrors = ref<FieldErrors>({})
const saving = ref(false)
const showErrorSummary = computed(() => hasErrors(personErrors.value) || hasErrors(stayErrors.value))

async function save(): Promise<void> {
  if (saving.value) return
  const todayDate = today()
  personErrors.value = validatePerson(person.value, todayDate)
  stayErrors.value = validateStay(stay.value, todayDate)
  if (showErrorSummary.value) return
  saving.value = true
  try {
    const { person_id } = await registerAndCheckIn(
      formToPersonInput(person.value, todayDate),
      formToStayInput(stay.value),
    )
    notify.success('registration.saved')
    await router.push({ name: 'person', params: { id: person_id } })
  } catch (error) {
    notify.error(error)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <PageHeader title-key="nav.newPerson" />
    <form class="registration-form" novalidate @submit.prevent="save">
      <div class="row g-4">
        <div class="col-lg-8">
          <section class="card mb-4">
            <div class="card-body">
              <h2 class="h5 card-title">{{ t('registration.personSection') }}</h2>
              <PersonForm v-model="person" :errors="personErrors" />
            </div>
          </section>
          <section class="card mb-4">
            <div class="card-body">
              <h2 class="h5 card-title">{{ t('registration.staySection') }}</h2>
              <StayForm v-model="stay" :errors="stayErrors" />
            </div>
          </section>
          <p v-if="showErrorSummary" class="text-danger" role="alert">{{ t('registration.fixErrors') }}</p>
          <button type="submit" class="btn btn-primary btn-lg" :disabled="saving">
            {{ saving ? t('registration.saving') : t('registration.save') }}
          </button>
        </div>
      </div>
    </form>
  </div>
</template>
```

Add these top-level keys to `web/src/i18n/locales/es-MX.json`:

```json
{
  "registration": {
    "personSection": "Datos de la persona",
    "staySection": "Ingreso",
    "save": "Registrar e ingresar",
    "saving": "Guardando...",
    "saved": "Persona registrada. Su estancia quedó abierta.",
    "fixErrors": "Revisa los campos marcados."
  },
  "person": {
    "form": {
      "firstName": "Nombre(s)",
      "lastName": "Apellidos",
      "birthDate": "Fecha de nacimiento",
      "birthDateEstimated": "Fecha aproximada",
      "age": "Edad: {age}",
      "gender": "Género",
      "genderPlaceholder": "Selecciona",
      "country": "País de origen",
      "countryPlaceholder": "Selecciona un país",
      "region": "Departamento o estado",
      "carer": "Persona que lo cuida",
      "carerHelp": "Busca entre las personas que están en el albergue.",
      "carerPlaceholder": "Elige a la persona que lo cuida",
      "carerFilter": "Escribe un nombre",
      "carerLoading": "Cargando personas..."
    }
  }
}
```

Inside the existing `stays` object, add:

```json
"form": {
  "entryDate": "Fecha de ingreso",
  "exitDate": "Fecha de egreso",
  "bed": "Cama",
  "caseType": "Tipo de caso",
  "caseTypePlaceholder": "Selecciona un tipo de caso",
  "phoneStatus": "Teléfono",
  "notes": "Notas"
}
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `npm --prefix web run test -- tests/components/people tests/components/stays tests/views/PersonNewView.test.ts`

Expected: PASS.

Run: `npm --prefix web run test:integration -- tests/integration/registration.test.ts`

Expected: PASS.

- [ ] **Step 10: Run the whole suite, the type check and the linter**

Run: `npm run web:test`, then `npm run web:typecheck`, then `npm run web:lint`

Expected: all pass.

- [ ] **Step 11: Commit**

```bash
git add web/src/api/people.ts web/src/api/stays.ts web/src/components/forms/fieldErrors.ts web/src/components/people web/src/components/stays web/src/views/PersonNewView.vue web/src/i18n/locales/es-MX.json web/tests
git commit -m "feat(web): register a person and open the first stay from one form"
```

---

### Task 5: Duplicate panel on registration

**Files:**
- Modify: `web/src/api/people.ts`
- Create: `web/src/composables/useDuplicateCheck.ts`, `web/src/components/people/DuplicatePanel.vue`
- Replace: `web/src/views/PersonNewView.vue`
- Modify: `web/src/i18n/locales/es-MX.json`
- Create tests: `web/tests/composables/useDuplicateCheck.test.ts`, `web/tests/components/people/DuplicatePanel.test.ts`, `web/tests/views/PersonNewView.duplicates.test.ts`, `web/tests/integration/duplicates.test.ts`

**Interfaces:**
- Consumes: Task 4 (`PersonNewView`, `PersonFormValue`), `useThumbnails`, `PersonThumb`, `useShelterTime().formatDate`, `formatAge`, `fullName`, `ageOn`, `cleanText`, `normalizeForSearch`.
- Produces:
  - In `api/people.ts`: `PersonSearchResult`, `DuplicateCandidate` (contract shapes) and `findPossibleDuplicates(input): Promise<DuplicateCandidate[]>`.
  - `DUPLICATE_DEBOUNCE_MS = 400`, `DuplicateQuery`, `useDuplicateCheck(source: () => DuplicateQuery): { candidates, checking, failed }`.
  - `DuplicatePanel` (props `candidates`, `checking`, `failed`; emits `select(personId)` and `dismiss()`); each candidate is `[data-testid="duplicate-candidate"]`.
  - "Es esta persona" navigates to `{ name: 'person', params: { id }, query: { checkIn: '1' } }`, which Task 6 reads.

- [ ] **Step 1: Write the failing tests**

Create `web/tests/composables/useDuplicateCheck.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, reactive } from 'vue'
import { type DuplicateCandidate, findPossibleDuplicates } from '@/api/people'
import { useDuplicateCheck } from '@/composables/useDuplicateCheck'
import { uuid } from '../fixtures/data'

vi.mock('@/api/people', () => ({ findPossibleDuplicates: vi.fn() }))

const find = vi.mocked(findPossibleDuplicates)

function candidate(n: number, firstName: string): DuplicateCandidate {
  return {
    person_id: uuid(n),
    first_name: firstName,
    last_name: 'Pérez',
    birth_date: null,
    birth_date_estimated: false,
    country_code: 'HN',
    photo_path: null,
    score: 0.8,
    last_entry_date: '2026-08-01',
    last_exit_date: '2026-08-15',
  }
}

function setup() {
  const form = reactive({
    first_name: '',
    last_name: '',
    birth_date: null as string | null,
    country_code: null as string | null,
  })
  const scope = effectScope()
  const check = scope.run(() => useDuplicateCheck(() => ({ ...form })))
  if (!check) throw new Error('scope did not run')
  return { form, check, scope }
}

beforeEach(() => {
  vi.useFakeTimers()
  find.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useDuplicateCheck', () => {
  it('waits 400 ms after the last change before asking', async () => {
    const rosa = candidate(1, 'Rosa')
    find.mockResolvedValue([rosa])
    const { form, check, scope } = setup()
    form.first_name = 'Ro'
    await nextTick()
    await vi.advanceTimersByTimeAsync(300)
    form.first_name = ' Rosa '
    await nextTick()
    await vi.advanceTimersByTimeAsync(399)
    expect(find).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(find).toHaveBeenCalledTimes(1)
    expect(find).toHaveBeenCalledWith({ first_name: 'Rosa', last_name: null, birth_date: null, country_code: null })
    await vi.waitFor(() => expect(check.candidates.value).toEqual([rosa]))
    scope.stop()
  })

  it('keeps the answer for the latest input when an earlier request is slower', async () => {
    const first = candidate(1, 'Rosa')
    const second = candidate(2, 'Tomás')
    let resolveFirst: (value: DuplicateCandidate[]) => void = () => {}
    find.mockImplementationOnce(
      () =>
        new Promise<DuplicateCandidate[]>((resolve) => {
          resolveFirst = resolve
        }),
    )
    find.mockResolvedValueOnce([second])
    const { form, check, scope } = setup()
    form.first_name = 'Rosa'
    await nextTick()
    await vi.advanceTimersByTimeAsync(400)
    form.first_name = 'Tomás'
    await nextTick()
    await vi.advanceTimersByTimeAsync(400)
    await vi.waitFor(() => expect(check.candidates.value).toEqual([second]))
    resolveFirst([first])
    await Promise.resolve()
    await Promise.resolve()
    expect(check.candidates.value).toEqual([second])
    scope.stop()
  })

  it('does not ask for a one-letter name and clears earlier suggestions', async () => {
    find.mockResolvedValue([candidate(1, 'Rosa')])
    const { form, check, scope } = setup()
    form.first_name = 'Rosa'
    await nextTick()
    await vi.advanceTimersByTimeAsync(400)
    await vi.waitFor(() => expect(check.candidates.value).toHaveLength(1))
    form.first_name = 'R'
    await nextTick()
    await vi.advanceTimersByTimeAsync(400)
    expect(find).toHaveBeenCalledTimes(1)
    expect(check.candidates.value).toEqual([])
    scope.stop()
  })

  it('reports a failed lookup without throwing', async () => {
    find.mockRejectedValue(new Error('offline'))
    const { form, check, scope } = setup()
    form.first_name = 'Rosa'
    await nextTick()
    await vi.advanceTimersByTimeAsync(400)
    await vi.waitFor(() => expect(check.failed.value).toBe(true))
    expect(check.candidates.value).toEqual([])
    scope.stop()
  })
})
```

Create `web/tests/components/people/DuplicatePanel.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DuplicateCandidate } from '@/api/people'
import DuplicatePanel from '@/components/people/DuplicatePanel.vue'
import { uuid } from '../../fixtures/data'
import { mountWithApp } from '../../utils/mountWithApp'

vi.mock('@/api/photos', () => ({
  photoPathFor: (id: string) => `${id}.jpg`,
  thumbPathFor: (path: string) => path.replace(/\.jpg$/, '_thumb.jpg'),
  getSignedPhotoUrls: vi.fn(async () => ({})),
  uploadPersonPhoto: vi.fn(),
}))

const returning: DuplicateCandidate = {
  person_id: uuid(7),
  first_name: 'Rosa Elena',
  last_name: 'Pérez Lara',
  birth_date: '1996-04-12',
  birth_date_estimated: true,
  country_code: 'HN',
  photo_path: null,
  score: 0.92,
  last_entry_date: '2026-08-01',
  last_exit_date: '2026-08-15',
}

function mountPanel(candidates: DuplicateCandidate[]) {
  return mountWithApp(DuplicatePanel, { props: { candidates, checking: false, failed: false } })
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('DuplicatePanel', () => {
  it('shows each candidate with name, estimated age, country and last stay', async () => {
    const { wrapper } = await mountPanel([returning])
    const item = wrapper.find('[data-testid="duplicate-candidate"]')
    expect(item.text()).toContain('Rosa Elena Pérez Lara')
    expect(item.text()).toContain('~')
    expect(item.text()).toContain('Honduras')
    expect(item.text()).toContain('Última estancia: 01/08/2026 a 15/08/2026')
  })

  it('says when the candidate is staying right now', async () => {
    const { wrapper } = await mountPanel([{ ...returning, last_exit_date: null }])
    expect(wrapper.text()).toContain('En el albergue desde 01/08/2026')
  })

  it('emits the chosen person or the decision that this is someone new', async () => {
    const { wrapper } = await mountPanel([returning])
    await wrapper.find('[data-testid="duplicate-candidate"] button').trigger('click')
    expect(wrapper.emitted('select')).toEqual([[uuid(7)]])
    const newPerson = wrapper.findAll('button').find((button) => button.text() === 'Es una persona nueva')
    await newPerson?.trigger('click')
    expect(wrapper.emitted('dismiss')).toHaveLength(1)
  })
})
```

Create `web/tests/views/PersonNewView.duplicates.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type DuplicateCandidate, findPossibleDuplicates } from '@/api/people'
import PersonNewView from '@/views/PersonNewView.vue'
import { uuid } from '../fixtures/data'
import { mountWithApp } from '../utils/mountWithApp'

const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('@/composables/useNotify', () => ({ useNotify: () => notify }))
vi.mock('@/composables/useConfirm', () => ({ useConfirm: () => ({ confirm: vi.fn() }) }))
vi.mock('@/api/people', () => ({ registerAndCheckIn: vi.fn(), findPossibleDuplicates: vi.fn() }))
vi.mock('@/api/stays', () => ({ listCurrentResidents: vi.fn(async () => []) }))
vi.mock('@/api/photos', () => ({
  photoPathFor: (id: string) => `${id}.jpg`,
  thumbPathFor: (path: string) => path.replace(/\.jpg$/, '_thumb.jpg'),
  getSignedPhotoUrls: vi.fn(async () => ({})),
  uploadPersonPhoto: vi.fn(),
}))

const returning: DuplicateCandidate = {
  person_id: uuid(7),
  first_name: 'Rosa Elena',
  last_name: 'Pérez Lara',
  birth_date: '1996-04-12',
  birth_date_estimated: false,
  country_code: 'HN',
  photo_path: null,
  score: 0.92,
  last_entry_date: '2026-08-01',
  last_exit_date: '2026-08-15',
}

async function mountWithCandidate() {
  const result = await mountWithApp(PersonNewView, { initialRoute: '/people/new' })
  await result.wrapper.find('#person-first-name').setValue('rosa elena')
  await result.wrapper.find('#person-last-name').setValue('perez')
  await vi.waitFor(
    () => expect(result.wrapper.find('[data-testid="duplicate-candidate"]').exists()).toBe(true),
    { timeout: 2000 },
  )
  return result
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(findPossibleDuplicates).mockResolvedValue([returning])
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('PersonNewView duplicates', () => {
  it('looks for duplicates of what is being typed', async () => {
    await mountWithCandidate()
    expect(findPossibleDuplicates).toHaveBeenLastCalledWith({
      first_name: 'rosa elena',
      last_name: 'perez',
      birth_date: null,
      country_code: null,
    })
  })

  it('opens the existing record ready for a new stay when it is the same person', async () => {
    const { wrapper, router } = await mountWithCandidate()
    await wrapper.find('[data-testid="duplicate-candidate"] button').trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('person'))
    expect(router.currentRoute.value.params.id).toBe(uuid(7))
    expect(router.currentRoute.value.query.checkIn).toBe('1')
  })

  it('hides the panel and keeps the form when it is a new person', async () => {
    const { wrapper } = await mountWithCandidate()
    const newPerson = wrapper.findAll('button').find((button) => button.text() === 'Es una persona nueva')
    await newPerson?.trigger('click')
    expect(wrapper.find('[data-testid="duplicate-panel"]').exists()).toBe(false)
    expect((wrapper.find('#person-first-name').element as HTMLInputElement).value).toBe('rosa elena')
  })
})
```

Create `web/tests/integration/duplicates.test.ts`:

```ts
import { beforeAll, describe, expect, it } from 'vitest'
import { findPossibleDuplicates } from '@/api/people'
import { createPerson } from './factories'
import { signInAs, uniqueSuffix } from './helpers'

describe('duplicate detection', () => {
  beforeAll(async () => {
    await signInAs('volunteer')
  })

  it('finds a person typed with swapped names, no accents and swapped day and month', async () => {
    const surname = `Quintanilla ${uniqueSuffix()}`
    const personId = await createPerson({ first_name: 'Xóchitl', last_name: surname, birth_date: '1991-03-07' })
    const found = await findPossibleDuplicates({
      first_name: surname.toUpperCase(),
      last_name: 'xochitl',
      birth_date: '1991-07-03',
    })
    expect(found[0]?.person_id).toBe(personId)
  })

  it('returns nothing for a one-letter name', async () => {
    await expect(findPossibleDuplicates({ first_name: 'X' })).resolves.toEqual([])
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm --prefix web run test -- tests/composables/useDuplicateCheck.test.ts tests/components/people/DuplicatePanel.test.ts tests/views/PersonNewView.duplicates.test.ts`

Expected: FAIL, because the composable, the panel and `findPossibleDuplicates` do not exist yet.

Run: `npm --prefix web run test:integration -- tests/integration/duplicates.test.ts`

Expected: FAIL, because `findPossibleDuplicates` is not exported.

- [ ] **Step 3: Implement the API call and the composable**

Append to `web/src/api/people.ts`:

```ts
export interface PersonSearchResult {
  person_id: string
  first_name: string
  last_name: string | null
  birth_date: string | null
  birth_date_estimated: boolean
  country_code: string | null
  photo_path: string | null
  score: number
  last_entry_date: string | null
  last_exit_date: string | null
  has_open_stay: boolean
}

export type DuplicateCandidate = Omit<PersonSearchResult, 'has_open_stay'>

/** Up to 5 likely matches, best first. Merged records are never suggested. */
export async function findPossibleDuplicates(input: {
  first_name: string
  last_name?: string | null
  birth_date?: string | null
  country_code?: string | null
}): Promise<DuplicateCandidate[]> {
  const { data, error } = await supabase.rpc('find_possible_duplicates', {
    p_first_name: cleanText(input.first_name) ?? '',
    p_last_name: cleanText(input.last_name) ?? undefined,
    p_birth_date: input.birth_date ?? undefined,
    p_country_code: input.country_code ?? undefined,
  })
  if (error) throw toApiError(error)
  return (data ?? []) as DuplicateCandidate[]
}
```

Create `web/src/composables/useDuplicateCheck.ts`:

```ts
import { onScopeDispose, ref, watch } from 'vue'
import { type DuplicateCandidate, findPossibleDuplicates } from '@/api/people'
import { normalizeForSearch } from '@/lib/people'
import { cleanText } from '@/lib/text'

export const DUPLICATE_DEBOUNCE_MS = 400

export interface DuplicateQuery {
  first_name: string
  last_name: string
  birth_date: string | null
  country_code: string | null
}

/** Looks for likely duplicates 400 ms after the last change. Only the latest answer is kept. */
export function useDuplicateCheck(source: () => DuplicateQuery) {
  const candidates = ref<DuplicateCandidate[]>([])
  const checking = ref(false)
  const failed = ref(false)
  let timer: ReturnType<typeof setTimeout> | undefined
  let latest = 0

  async function check(query: DuplicateQuery): Promise<void> {
    const request = ++latest
    const firstName = cleanText(query.first_name)
    const lastName = cleanText(query.last_name)
    if (!firstName || normalizeForSearch(`${firstName} ${lastName ?? ''}`).length < 2) {
      candidates.value = []
      checking.value = false
      failed.value = false
      return
    }
    checking.value = true
    try {
      const found = await findPossibleDuplicates({
        first_name: firstName,
        last_name: lastName,
        birth_date: query.birth_date,
        country_code: query.country_code,
      })
      if (request !== latest) return
      candidates.value = found
      failed.value = false
    } catch {
      if (request !== latest) return
      candidates.value = []
      failed.value = true
    } finally {
      if (request === latest) checking.value = false
    }
  }

  watch(source, (query) => {
    clearTimeout(timer)
    timer = setTimeout(() => void check(query), DUPLICATE_DEBOUNCE_MS)
  })
  onScopeDispose(() => clearTimeout(timer))

  return { candidates, checking, failed }
}
```

- [ ] **Step 4: Implement the panel and wire it into the registration view**

Create `web/src/components/people/DuplicatePanel.vue`:

```vue
<script setup lang="ts">
import { watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DuplicateCandidate } from '@/api/people'
import PersonThumb from '@/components/people/PersonThumb.vue'
import { useShelterTime } from '@/composables/useShelterTime'
import { useThumbnails } from '@/composables/useThumbnails'
import { formatAge, fullName } from '@/lib/people'
import { ageOn } from '@/lib/shelterTime'
import { useCatalogsStore } from '@/stores/catalogs'

const props = defineProps<{ candidates: DuplicateCandidate[]; checking: boolean; failed: boolean }>()
const emit = defineEmits<{ select: [personId: string]; dismiss: [] }>()

const { t } = useI18n()
const { formatDate, today } = useShelterTime()
const catalogs = useCatalogsStore()
const thumbs = useThumbnails()

watch(
  () => props.candidates,
  (list) => thumbs.load(list.map((candidate) => candidate.photo_path)),
  { immediate: true },
)

function ageLabel(candidate: DuplicateCandidate): string {
  const age = formatAge(ageOn(candidate.birth_date, today()), candidate.birth_date_estimated)
  return age ? t('registration.duplicates.age', { age }) : ''
}

function stayLabel(candidate: DuplicateCandidate): string {
  if (!candidate.last_entry_date) return t('registration.duplicates.noStays')
  if (!candidate.last_exit_date) {
    return t('registration.duplicates.staying', { from: formatDate(candidate.last_entry_date) })
  }
  return t('registration.duplicates.lastStay', {
    from: formatDate(candidate.last_entry_date),
    to: formatDate(candidate.last_exit_date),
  })
}
</script>

<template>
  <section class="card border-warning" aria-live="polite" data-testid="duplicate-panel">
    <div class="card-body">
      <h2 class="h5 card-title">{{ t('registration.duplicates.title') }}</h2>
      <p class="small text-body-secondary">{{ t('registration.duplicates.intro') }}</p>
      <p v-if="checking" class="small">{{ t('registration.duplicates.checking') }}</p>
      <p v-if="failed" class="small text-danger">{{ t('registration.duplicates.failed') }}</p>
      <ul class="list-unstyled mb-3">
        <li
          v-for="candidate in candidates"
          :key="candidate.person_id"
          class="d-flex gap-2 align-items-start border-bottom py-2"
          data-testid="duplicate-candidate"
        >
          <PersonThumb
            :url="thumbs.thumbUrl(candidate.photo_path)"
            :name="fullName(candidate.first_name, candidate.last_name)"
            :size="48"
          />
          <div class="flex-grow-1">
            <div class="fw-semibold">{{ fullName(candidate.first_name, candidate.last_name) }}</div>
            <div class="small text-body-secondary">
              <span v-if="ageLabel(candidate)">{{ ageLabel(candidate) }}</span>
              <span v-if="ageLabel(candidate) && candidate.country_code">, </span>
              <span v-if="candidate.country_code">{{ catalogs.label('countries', candidate.country_code) }}</span>
            </div>
            <div class="small">{{ stayLabel(candidate) }}</div>
            <button
              type="button"
              class="btn btn-sm btn-outline-primary mt-1"
              @click="emit('select', candidate.person_id)"
            >
              {{ t('registration.duplicates.isThisPerson') }}
            </button>
          </div>
        </li>
      </ul>
      <button type="button" class="btn btn-sm btn-outline-secondary" @click="emit('dismiss')">
        {{ t('registration.duplicates.isNewPerson') }}
      </button>
    </div>
  </section>
</template>
```

Replace `web/src/views/PersonNewView.vue` with:

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { registerAndCheckIn } from '@/api/people'
import PageHeader from '@/components/common/PageHeader.vue'
import { type FieldErrors, hasErrors } from '@/components/forms/fieldErrors'
import DuplicatePanel from '@/components/people/DuplicatePanel.vue'
import PersonForm from '@/components/people/PersonForm.vue'
import { emptyPerson, formToPersonInput, validatePerson } from '@/components/people/personFormModel'
import StayForm from '@/components/stays/StayForm.vue'
import { emptyStay, formToStayInput, validateStay } from '@/components/stays/stayFormModel'
import { useDuplicateCheck } from '@/composables/useDuplicateCheck'
import { useNotify } from '@/composables/useNotify'
import { useShelterTime } from '@/composables/useShelterTime'

const { t } = useI18n()
const router = useRouter()
const notify = useNotify()
const { today } = useShelterTime()

const person = ref(emptyPerson())
const stay = ref(emptyStay(today()))
const personErrors = ref<FieldErrors>({})
const stayErrors = ref<FieldErrors>({})
const saving = ref(false)
const showErrorSummary = computed(() => hasErrors(personErrors.value) || hasErrors(stayErrors.value))

const { candidates, checking, failed } = useDuplicateCheck(() => ({
  first_name: person.value.first_name,
  last_name: person.value.last_name,
  birth_date: person.value.birth_date,
  country_code: person.value.country_code,
}))
// Candidates dismissed with "Es una persona nueva" stay hidden; new ones still show.
const dismissed = ref<Set<string>>(new Set())
const visibleCandidates = computed(() =>
  candidates.value.filter((candidate) => !dismissed.value.has(candidate.person_id)),
)
const showPanel = computed(() => visibleCandidates.value.length > 0 || failed.value)

function dismissCandidates(): void {
  dismissed.value = new Set([...dismissed.value, ...candidates.value.map((candidate) => candidate.person_id)])
}

async function openCandidate(personId: string): Promise<void> {
  await router.push({ name: 'person', params: { id: personId }, query: { checkIn: '1' } })
}

async function save(): Promise<void> {
  if (saving.value) return
  const todayDate = today()
  personErrors.value = validatePerson(person.value, todayDate)
  stayErrors.value = validateStay(stay.value, todayDate)
  if (showErrorSummary.value) return
  saving.value = true
  try {
    const { person_id } = await registerAndCheckIn(
      formToPersonInput(person.value, todayDate),
      formToStayInput(stay.value),
    )
    notify.success('registration.saved')
    await router.push({ name: 'person', params: { id: person_id } })
  } catch (error) {
    notify.error(error)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <PageHeader title-key="nav.newPerson" />
    <form class="registration-form" novalidate @submit.prevent="save">
      <div class="row g-4">
        <div class="col-lg-8">
          <section class="card mb-4">
            <div class="card-body">
              <h2 class="h5 card-title">{{ t('registration.personSection') }}</h2>
              <PersonForm v-model="person" :errors="personErrors" />
            </div>
          </section>
          <section class="card mb-4">
            <div class="card-body">
              <h2 class="h5 card-title">{{ t('registration.staySection') }}</h2>
              <StayForm v-model="stay" :errors="stayErrors" />
            </div>
          </section>
          <p v-if="showErrorSummary" class="text-danger" role="alert">{{ t('registration.fixErrors') }}</p>
          <button type="submit" class="btn btn-primary btn-lg" :disabled="saving">
            {{ saving ? t('registration.saving') : t('registration.save') }}
          </button>
        </div>
        <aside class="col-lg-4">
          <DuplicatePanel
            v-if="showPanel"
            :candidates="visibleCandidates"
            :checking="checking"
            :failed="failed"
            @select="openCandidate"
            @dismiss="dismissCandidates"
          />
        </aside>
      </div>
    </form>
  </div>
</template>
```

Inside the existing `registration` object in `web/src/i18n/locales/es-MX.json`, add:

```json
"duplicates": {
  "title": "Posibles coincidencias",
  "intro": "Antes de continuar, revisa si la persona ya estuvo en el albergue.",
  "checking": "Buscando coincidencias...",
  "failed": "No se pudieron buscar coincidencias. Puedes continuar con el registro.",
  "age": "{age} años",
  "lastStay": "Última estancia: {from} a {to}",
  "staying": "En el albergue desde {from}",
  "noStays": "Sin estancias registradas",
  "isThisPerson": "Es esta persona",
  "isNewPerson": "Es una persona nueva"
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm --prefix web run test -- tests/composables/useDuplicateCheck.test.ts tests/components/people tests/views/PersonNewView.test.ts tests/views/PersonNewView.duplicates.test.ts`

Expected: PASS.

Run: `npm --prefix web run test:integration -- tests/integration/duplicates.test.ts`

Expected: PASS.

- [ ] **Step 6: Run the whole suite, the type check and the linter**

Run: `npm run web:test`, then `npm run web:typecheck`, then `npm run web:lint`

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add web/src/api/people.ts web/src/composables/useDuplicateCheck.ts web/src/components/people/DuplicatePanel.vue web/src/views/PersonNewView.vue web/src/i18n/locales/es-MX.json web/tests
git commit -m "feat(web): suggest possible duplicates while registering a person"
```

---
### Task 6: Person record with edit and new stay

**Files:**
- Modify: `web/src/api/people.ts`, `web/src/api/stays.ts`, `web/src/api/outings.ts`
- Create: `web/src/components/people/PersonDetails.vue`, `web/src/components/stays/StayHistory.vue`, `web/src/components/outings/OutingList.vue`
- Replace: `web/src/views/PersonView.vue`
- Modify: `web/src/i18n/locales/es-MX.json`
- Create tests: `web/tests/views/PersonView.test.ts`, `web/tests/integration/person-record.test.ts`

**Interfaces:**
- Consumes: `updateVersioned` (`@/api/rows`), `PersonForm`, `personFormModel`, `StayForm`, `stayFormModel`, `hasErrors` (Task 4), `cleanStay` (Task 4), `useConfirm`, `useShelterTime().formatDate`, `fullName`, `formatAge`, `ageOn`, the `checkIn` query flag from Task 5, `checkOut`, `startOuting`, `endOuting` (integration test only).
- Produces:
  - `getPerson(id): Promise<Person>` and `updatePerson(id, expectedUpdatedAt, patch: PersonPatch): Promise<Person>` in `api/people.ts`.
  - `listStaysForPerson(personId): Promise<Stay[]>` (newest entry first) and `checkIn(personId, stay: NewStayInput): Promise<string>` in `api/stays.ts`.
  - `listOutingsForStay(stayId): Promise<Outing[]>` (newest first) in `api/outings.ts`.
  - `PersonDetails` (props `person`, `carer`), `StayHistory` (prop `stays`; rows are `[data-testid="stay-row"]`), `OutingList` (prop `outings`; rows are `[data-testid="outing-row"]`).
  - `PersonView` forms: `form.person-edit-form` and `form.new-stay-form` (StayForm `id-prefix="new-stay"`). Test ids: `person-name`, `stay-status`, `merged-alert`, `overlap-hint`.

- [ ] **Step 1: Write the failing integration test**

Create `web/tests/integration/person-record.test.ts`:

```ts
import { beforeAll, describe, expect, it } from 'vitest'
import { endOuting, listOutingsForStay, startOuting } from '@/api/outings'
import { getPerson, updatePerson } from '@/api/people'
import { checkIn, checkOut, listStaysForPerson } from '@/api/stays'
import { createPerson, createResident, daysAgo } from './factories'
import { signInAs } from './helpers'

describe('person record', () => {
  beforeAll(async () => {
    await signInAs('volunteer')
  })

  it('reads a person and reports an unknown id as not found', async () => {
    const id = await createPerson()
    await expect(getPerson(id)).resolves.toMatchObject({ id })
    await expect(getPerson('00000000-0000-4000-8000-00000000dead')).rejects.toMatchObject({ code: 'not_found' })
  })

  it('updates a person with optimistic concurrency and trims text', async () => {
    const id = await createPerson()
    const loaded = await getPerson(id)
    const updated = await updatePerson(id, loaded.updated_at, { last_name: '  Ríos  ', region: '   ' })
    expect(updated).toMatchObject({ last_name: 'Ríos', region: null })
    await expect(updatePerson(id, loaded.updated_at, { region: 'Cortés' })).rejects.toMatchObject({
      code: 'stale_record',
    })
  })

  it('lists stays newest first and checks a returning person in', async () => {
    const { personId, stayId } = await createResident({}, { entry_date: daysAgo(20) })
    await checkOut(stayId, daysAgo(10))
    await expect(checkIn(personId, { bed: ' B7 ' })).resolves.toEqual(expect.any(String))
    await expect(checkIn(personId, {})).rejects.toMatchObject({ code: 'already_checked_in' })
    const stays = await listStaysForPerson(personId)
    expect(stays.map((stay) => stay.exit_date)).toEqual([null, daysAgo(10)])
    expect(stays[0]?.bed).toBe('B7')
  })

  it('refuses a new stay today after a same-day check-out', async () => {
    const { personId, stayId } = await createResident()
    await checkOut(stayId)
    await expect(checkIn(personId, {})).rejects.toMatchObject({ code: 'overlapping_stays' })
  })

  it('lists the outings of a stay newest first', async () => {
    const { stayId } = await createResident({}, { entry_date: daysAgo(2) })
    await startOuting(stayId)
    await endOuting(stayId)
    await startOuting(stayId, null, true)
    const outings = await listOutingsForStay(stayId)
    expect(outings).toHaveLength(2)
    expect(outings[0]?.returned_at).toBeNull()
    expect(outings[1]?.returned_at).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run db:reset`, then `npm --prefix web run test:integration -- tests/integration/person-record.test.ts`

Expected: FAIL, because `getPerson`, `listStaysForPerson`, `checkIn` and `listOutingsForStay` are not exported yet.

- [ ] **Step 3: Implement the API functions**

In `web/src/api/people.ts`, add `import type { Person } from '@/types/domain'` and `import { updateVersioned } from './rows'` to the imports, then append:

```ts
export async function getPerson(id: string): Promise<Person> {
  const { data, error } = await supabase.from('people').select('*').eq('id', id).single()
  if (error) throw toApiError(error)
  return data
}

/** Saves only if nobody changed the record since `expectedUpdatedAt`; otherwise throws stale_record. */
export async function updatePerson(
  id: string,
  expectedUpdatedAt: string,
  patch: PersonPatch,
): Promise<Person> {
  return updateVersioned('people', { column: 'id', value: id }, expectedUpdatedAt, cleanPerson(patch))
}
```

In `web/src/api/stays.ts`, change the domain import to `import type { CurrentResident, PhoneStatus, Stay } from '@/types/domain'`, add `import type { Json } from '@/types/database'`, then append:

```ts
/** Every stay of a person, newest entry first. */
export async function listStaysForPerson(personId: string): Promise<Stay[]> {
  const { data, error } = await supabase
    .from('stays')
    .select('*')
    .eq('person_id', personId)
    .order('entry_date', { ascending: false })
  if (error) throw toApiError(error)
  return data ?? []
}

/** Opens a new stay for someone already registered. Returns the stay id. */
export async function checkIn(personId: string, stay: NewStayInput): Promise<string> {
  const { data, error } = await supabase.rpc('check_in', {
    p_person_id: personId,
    p_stay: cleanStay(stay) as unknown as Json,
  })
  if (error) throw toApiError(error)
  return data as string
}
```

In `web/src/api/outings.ts`, add `import type { Outing } from '@/types/domain'`, then append:

```ts
/** The outings of one stay, newest first. */
export async function listOutingsForStay(stayId: string): Promise<Outing[]> {
  const { data, error } = await supabase
    .from('outings')
    .select('*')
    .eq('stay_id', stayId)
    .order('left_at', { ascending: false })
  if (error) throw toApiError(error)
  return data ?? []
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm --prefix web run test:integration -- tests/integration/person-record.test.ts`

Expected: PASS.

- [ ] **Step 5: Write the failing view test**

Create `web/tests/views/PersonView.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/errors'
import { listOutingsForStay } from '@/api/outings'
import { getPerson, updatePerson } from '@/api/people'
import { checkIn, listStaysForPerson } from '@/api/stays'
import { todayIn } from '@/lib/shelterTime'
import PersonView from '@/views/PersonView.vue'
import { makeOuting, makePerson, makeStay, STAMP, uuid } from '../fixtures/data'
import { mountWithApp } from '../utils/mountWithApp'

const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
const confirm = vi.hoisted(() => vi.fn())
vi.mock('@/composables/useNotify', () => ({ useNotify: () => notify }))
vi.mock('@/composables/useConfirm', () => ({ useConfirm: () => ({ confirm }) }))
vi.mock('@/api/people', () => ({ getPerson: vi.fn(), updatePerson: vi.fn() }))
vi.mock('@/api/stays', () => ({
  listStaysForPerson: vi.fn(),
  checkIn: vi.fn(),
  listCurrentResidents: vi.fn(async () => []),
  updateStay: vi.fn(),
  deleteStay: vi.fn(),
}))
vi.mock('@/api/outings', () => ({
  listOutingsForStay: vi.fn(),
  updateOuting: vi.fn(),
  deleteOuting: vi.fn(),
}))
vi.mock('@/api/photos', () => ({
  photoPathFor: (id: string) => `${id}.jpg`,
  thumbPathFor: (path: string) => path.replace(/\.jpg$/, '_thumb.jpg'),
  getSignedPhotoUrls: vi.fn(async () => ({})),
  uploadPersonPhoto: vi.fn(),
}))

const tz = 'America/Mexico_City'
const person = makePerson({ id: uuid(1) })
const openStay = makeStay({ id: uuid(101), entry_date: '2026-10-03', bed: 'A1' })
const pastStay = makeStay({
  id: uuid(100),
  entry_date: '2026-08-01',
  exit_date: '2026-08-15',
  bed: 'C4',
  phone_status: 'none',
})
const outing = makeOuting({ id: uuid(201), stay_id: uuid(101), comment: 'Cita en el consulado' })

async function mountLoaded(path = `/people/${uuid(1)}`) {
  const result = await mountWithApp(PersonView, { initialRoute: path })
  await vi.waitFor(() => expect(result.wrapper.find('[data-testid="person-name"]').exists()).toBe(true))
  return result
}

function button(wrapper: Awaited<ReturnType<typeof mountLoaded>>['wrapper'], label: string) {
  const found = wrapper.findAll('button').find((candidate) => candidate.text() === label)
  if (!found) throw new Error(`No ${label} button`)
  return found
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getPerson).mockResolvedValue(person)
  vi.mocked(listStaysForPerson).mockResolvedValue([openStay, pastStay])
  vi.mocked(listOutingsForStay).mockResolvedValue([outing])
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('PersonView', () => {
  it('shows the details, the open stay, its outings and the stay history', async () => {
    const { wrapper } = await mountLoaded()
    expect(wrapper.find('[data-testid="person-name"]').text()).toBe('Rosa Elena Pérez Lara')
    expect(wrapper.find('[data-testid="stay-status"]').text()).toBe('En el albergue desde 03/10/2026')
    const details = wrapper.find('[data-testid="person-details"]').text()
    expect(details).toContain('12/04/1996')
    expect(details).toContain('Mujer')
    expect(details).toContain('Honduras')
    expect(details).toContain('Cortés')

    const stays = wrapper.findAll('[data-testid="stay-row"]')
    expect(stays).toHaveLength(2)
    expect(stays[0]?.text()).toContain('Abierta')
    expect(stays[1]?.text()).toContain('15/08/2026')

    expect(listOutingsForStay).toHaveBeenCalledWith(uuid(101))
    const outingRow = wrapper.find('[data-testid="outing-row"]')
    expect(outingRow.text()).toContain('06/10/2026 10:00')
    expect(outingRow.text()).toContain('06/10/2026 12:30')
    expect(outingRow.text()).toContain('Cita en el consulado')
    expect(wrapper.findAll('button').some((candidate) => candidate.text() === 'Nueva estancia')).toBe(false)
  })

  it('points a merged record to the one that was kept and hides the actions', async () => {
    vi.mocked(getPerson).mockResolvedValue(makePerson({ merged_into_id: uuid(2) }))
    vi.mocked(listStaysForPerson).mockResolvedValue([])
    const { wrapper } = await mountLoaded()
    expect(wrapper.find('[data-testid="merged-alert"] a').attributes('href')).toBe(`/people/${uuid(2)}`)
    const labels = wrapper.findAll('button').map((candidate) => candidate.text())
    expect(labels).not.toContain('Editar datos')
    expect(labels).not.toContain('Nueva estancia')
  })

  it('says when the record does not exist', async () => {
    vi.mocked(getPerson).mockRejectedValue(new ApiError('not_found'))
    const { wrapper } = await mountWithApp(PersonView, { initialRoute: `/people/${uuid(9)}` })
    await vi.waitFor(() => expect(wrapper.text()).toContain('No encontramos este registro.'))
  })

  it('saves edited details with the version that was loaded', async () => {
    vi.mocked(updatePerson).mockResolvedValue(makePerson({ last_name: 'Pérez de Ríos' }))
    const { wrapper } = await mountLoaded()
    await button(wrapper, 'Editar datos').trigger('click')
    await wrapper.find('#person-last-name').setValue('Pérez de Ríos')
    await wrapper.find('form.person-edit-form').trigger('submit')
    await vi.waitFor(() =>
      expect(updatePerson).toHaveBeenCalledWith(
        uuid(1),
        STAMP,
        expect.objectContaining({ first_name: 'Rosa Elena', last_name: 'Pérez de Ríos' }),
      ),
    )
    expect(notify.success).toHaveBeenCalledWith('person.saved')
    await vi.waitFor(() => expect(wrapper.find('form.person-edit-form').exists()).toBe(false))
  })

  it('offers to reload when someone else changed the record', async () => {
    vi.mocked(updatePerson).mockRejectedValue(new ApiError('stale_record'))
    confirm.mockResolvedValue(true)
    const { wrapper } = await mountLoaded()
    await button(wrapper, 'Editar datos').trigger('click')
    await wrapper.find('form.person-edit-form').trigger('submit')
    await vi.waitFor(() =>
      expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ messageKey: 'person.staleMessage' })),
    )
    await vi.waitFor(() => expect(getPerson).toHaveBeenCalledTimes(2))
    expect(notify.error).not.toHaveBeenCalled()
    expect(wrapper.find('form.person-edit-form').exists()).toBe(false)
  })

  it('opens a new stay for a person who is not staying', async () => {
    vi.mocked(listStaysForPerson).mockResolvedValue([pastStay])
    vi.mocked(checkIn).mockResolvedValue(uuid(102))
    const { wrapper } = await mountLoaded()
    expect(wrapper.find('[data-testid="stay-status"]').text()).toBe('No está en el albergue')
    await button(wrapper, 'Nueva estancia').trigger('click')
    await wrapper.find('#new-stay-bed').setValue('B7')
    await wrapper.find('form.new-stay-form').trigger('submit')
    await vi.waitFor(() =>
      expect(checkIn).toHaveBeenCalledWith(uuid(1), {
        entry_date: todayIn(tz),
        case_type_code: null,
        bed: 'B7',
        phone_status: 'none',
        notes: '',
      }),
    )
    expect(notify.success).toHaveBeenCalledWith('stays.newStay.saved')
    await vi.waitFor(() => expect(listStaysForPerson).toHaveBeenCalledTimes(2))
  })

  it('opens the new stay form directly when coming from the duplicate panel', async () => {
    vi.mocked(listStaysForPerson).mockResolvedValue([pastStay])
    const { wrapper } = await mountLoaded(`/people/${uuid(1)}?checkIn=1`)
    await vi.waitFor(() => expect(wrapper.find('form.new-stay-form').exists()).toBe(true))
  })

  it('explains how to fix a new stay that overlaps one closed today by mistake', async () => {
    vi.mocked(listStaysForPerson).mockResolvedValue([pastStay])
    vi.mocked(checkIn).mockRejectedValue(new ApiError('overlapping_stays'))
    const { wrapper } = await mountLoaded()
    await button(wrapper, 'Nueva estancia').trigger('click')
    await wrapper.find('form.new-stay-form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.find('[data-testid="overlap-hint"]').exists()).toBe(true))
    expect(wrapper.find('[data-testid="overlap-hint"]').text()).toContain('reabre esa estancia')
    expect(notify.error).toHaveBeenCalledWith(expect.objectContaining({ code: 'overlapping_stays' }))
  })

  it('reloads when another computer already checked the person in', async () => {
    vi.mocked(listStaysForPerson).mockResolvedValue([pastStay])
    vi.mocked(checkIn).mockRejectedValue(new ApiError('already_checked_in'))
    const { wrapper } = await mountLoaded()
    await button(wrapper, 'Nueva estancia').trigger('click')
    await wrapper.find('form.new-stay-form').trigger('submit')
    await vi.waitFor(() => expect(listStaysForPerson).toHaveBeenCalledTimes(2))
    expect(wrapper.find('form.new-stay-form').exists()).toBe(false)
  })

  it('saves edits with the version the form was opened from, even after a reload', async () => {
    vi.mocked(listStaysForPerson).mockResolvedValue([pastStay])
    vi.mocked(checkIn).mockResolvedValue(uuid(102))
    const { wrapper } = await mountLoaded()
    await button(wrapper, 'Editar datos').trigger('click')
    // Another computer changes the person; the check-in below reloads the record.
    vi.mocked(getPerson).mockResolvedValue(makePerson({ updated_at: '2026-10-07T18:00:00+00:00' }))
    await button(wrapper, 'Nueva estancia').trigger('click')
    await wrapper.find('form.new-stay-form').trigger('submit')
    await vi.waitFor(() => expect(getPerson).toHaveBeenCalledTimes(2))
    await wrapper.find('form.person-edit-form').trigger('submit')
    await vi.waitFor(() => expect(updatePerson).toHaveBeenCalled())
    expect(vi.mocked(updatePerson).mock.calls[0]?.[1]).toBe(STAMP)
  })
})
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npm --prefix web run test -- tests/views/PersonView.test.ts`

Expected: FAIL, because `PersonView` is still the Plan 2 placeholder.

- [ ] **Step 7: Implement the record components**

Create `web/src/components/people/PersonDetails.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useShelterTime } from '@/composables/useShelterTime'
import { formatAge, fullName } from '@/lib/people'
import { ageOn } from '@/lib/shelterTime'
import { useCatalogsStore } from '@/stores/catalogs'
import type { Person } from '@/types/domain'

const props = defineProps<{ person: Person; carer: Person | null }>()

const { t } = useI18n()
const { formatDate, today } = useShelterTime()
const catalogs = useCatalogsStore()
const unknown = computed(() => t('person.details.unknown'))
const age = computed(() =>
  formatAge(ageOn(props.person.birth_date, today()), props.person.birth_date_estimated),
)
</script>

<template>
  <dl class="row mb-0" data-testid="person-details">
    <dt class="col-sm-4">{{ t('person.details.birthDate') }}</dt>
    <dd class="col-sm-8">{{ formatDate(person.birth_date) || unknown }}</dd>
    <dt class="col-sm-4">{{ t('person.details.age') }}</dt>
    <dd class="col-sm-8">{{ age || unknown }}</dd>
    <dt class="col-sm-4">{{ t('person.details.gender') }}</dt>
    <dd class="col-sm-8">{{ catalogs.label('genders', person.gender_code) || unknown }}</dd>
    <dt class="col-sm-4">{{ t('person.details.country') }}</dt>
    <dd class="col-sm-8">{{ catalogs.label('countries', person.country_code) || unknown }}</dd>
    <dt class="col-sm-4">{{ t('person.details.region') }}</dt>
    <dd class="col-sm-8">{{ person.region || unknown }}</dd>
    <template v-if="person.carer_id">
      <dt class="col-sm-4">{{ t('person.details.carer') }}</dt>
      <dd class="col-sm-8">
        <RouterLink :to="{ name: 'person', params: { id: person.carer_id } }">{{
          carer ? fullName(carer.first_name, carer.last_name) : t('person.details.carerRecord')
        }}</RouterLink>
      </dd>
    </template>
  </dl>
</template>
```

Create `web/src/components/stays/StayHistory.vue`:

```vue
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useShelterTime } from '@/composables/useShelterTime'
import { useCatalogsStore } from '@/stores/catalogs'
import type { Stay } from '@/types/domain'

defineProps<{ stays: Stay[] }>()

const { t } = useI18n()
const { formatDate } = useShelterTime()
const catalogs = useCatalogsStore()
</script>

<template>
  <p v-if="stays.length === 0" class="text-body-secondary mb-0">{{ t('stays.history.empty') }}</p>
  <div v-else class="table-responsive">
    <table class="table table-sm align-middle mb-0">
      <thead>
        <tr>
          <th scope="col">{{ t('stays.history.entry') }}</th>
          <th scope="col">{{ t('stays.history.exit') }}</th>
          <th scope="col">{{ t('stays.history.bed') }}</th>
          <th scope="col">{{ t('stays.history.caseType') }}</th>
          <th scope="col">{{ t('stays.history.phone') }}</th>
          <th scope="col">{{ t('stays.history.notes') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="stay in stays" :key="stay.id" data-testid="stay-row">
          <td>{{ formatDate(stay.entry_date) }}</td>
          <td>
            <span v-if="stay.exit_date">{{ formatDate(stay.exit_date) }}</span>
            <span v-else class="badge text-bg-success">{{ t('stays.history.open') }}</span>
          </td>
          <td>{{ stay.bed }}</td>
          <td>{{ catalogs.label('case_types', stay.case_type_code) }}</td>
          <td>{{ t(`phoneStatus.${stay.phone_status}`) }}</td>
          <td class="text-break">{{ stay.notes }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
```

Create `web/src/components/outings/OutingList.vue`:

```vue
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useShelterTime } from '@/composables/useShelterTime'
import type { Outing } from '@/types/domain'

defineProps<{ outings: Outing[] }>()

const { t } = useI18n()
const { formatDateTime } = useShelterTime()
</script>

<template>
  <p v-if="outings.length === 0" class="text-body-secondary mb-0">{{ t('outings.list.empty') }}</p>
  <div v-else class="table-responsive">
    <table class="table table-sm align-middle mb-0">
      <thead>
        <tr>
          <th scope="col">{{ t('outings.list.left') }}</th>
          <th scope="col">{{ t('outings.list.returned') }}</th>
          <th scope="col">{{ t('outings.list.comment') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="outing in outings" :key="outing.id" data-testid="outing-row">
          <td>
            {{ formatDateTime(outing.left_at) }}
            <span v-if="outing.is_exception" class="badge text-bg-warning ms-1">{{
              t('outings.list.exception')
            }}</span>
          </td>
          <td>
            <span v-if="outing.returned_at">{{ formatDateTime(outing.returned_at) }}</span>
            <span v-else class="badge text-bg-warning">{{ t('outings.list.notReturned') }}</span>
          </td>
          <td class="text-break">{{ outing.comment }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
```

- [ ] **Step 8: Implement the view**

Replace `web/src/views/PersonView.vue` with:

```vue
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { isApiError } from '@/api/errors'
import { listOutingsForStay } from '@/api/outings'
import { getPerson, updatePerson } from '@/api/people'
import { checkIn, listStaysForPerson } from '@/api/stays'
import PageHeader from '@/components/common/PageHeader.vue'
import { type FieldErrors, hasErrors } from '@/components/forms/fieldErrors'
import OutingList from '@/components/outings/OutingList.vue'
import PersonDetails from '@/components/people/PersonDetails.vue'
import PersonForm from '@/components/people/PersonForm.vue'
import {
  formToPersonInput,
  type PersonFormValue,
  personToForm,
  validatePerson,
} from '@/components/people/personFormModel'
import StayForm from '@/components/stays/StayForm.vue'
import StayHistory from '@/components/stays/StayHistory.vue'
import { emptyStay, formToStayInput, type StayFormValue, validateStay } from '@/components/stays/stayFormModel'
import { useConfirm } from '@/composables/useConfirm'
import { useNotify } from '@/composables/useNotify'
import { useShelterTime } from '@/composables/useShelterTime'
import { fullName } from '@/lib/people'
import type { Outing, Person, Stay } from '@/types/domain'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const notify = useNotify()
const { confirm } = useConfirm()
const { formatDate, today } = useShelterTime()

const personId = computed(() => String(route.params.id))
const person = ref<Person | null>(null)
const carer = ref<Person | null>(null)
const stays = ref<Stay[]>([])
const outings = ref<Outing[]>([])
const notFound = ref(false)

const openStay = computed(() => stays.value.find((stay) => stay.exit_date === null) ?? null)
const merged = computed(() => !!person.value?.merged_into_id)
const name = computed(() => (person.value ? fullName(person.value.first_name, person.value.last_name) : ''))
const carerName = computed(() => (carer.value ? fullName(carer.value.first_name, carer.value.last_name) : null))

const personForm = ref<PersonFormValue | null>(null)
// The version the form was opened from. load() can refresh person while the form is open
// (a photo, a correction, a check-in), and saving must not overwrite someone else's change.
const personVersion = ref<string | null>(null)
const personErrors = ref<FieldErrors>({})
const savingPerson = ref(false)

const stayForm = ref<StayFormValue | null>(null)
const stayErrors = ref<FieldErrors>({})
const savingStay = ref(false)
const overlapHint = ref(false)

async function load(): Promise<void> {
  const id = personId.value
  try {
    const loadedPerson = await getPerson(id)
    const [loadedStays, loadedCarer] = await Promise.all([
      listStaysForPerson(id),
      loadedPerson.carer_id ? getPerson(loadedPerson.carer_id).catch(() => null) : Promise.resolve(null),
    ])
    const current = loadedStays.find((stay) => stay.exit_date === null)
    outings.value = current ? await listOutingsForStay(current.id) : []
    person.value = loadedPerson
    stays.value = loadedStays
    carer.value = loadedCarer
    notFound.value = false
  } catch (error) {
    if (isApiError(error, 'not_found') || isApiError(error, 'validation')) notFound.value = true
    else notify.error(error)
  }
}

watch(
  personId,
  async () => {
    person.value = null
    personForm.value = null
    stayForm.value = null
    overlapHint.value = false
    await load()
    if (route.query.checkIn === '1' && person.value && !openStay.value && !merged.value) startCheckIn()
  },
  { immediate: true },
)

/** stale_record offers a reload; any other error is shown and the form keeps its input. */
async function handleSaveError(error: unknown, discard: () => void): Promise<void> {
  if (!isApiError(error, 'stale_record')) {
    notify.error(error)
    return
  }
  const reload = await confirm({
    titleKey: 'person.staleTitle',
    messageKey: 'person.staleMessage',
    confirmKey: 'common.reload',
    cancelKey: 'person.keepEditing',
  })
  if (!reload) return
  discard()
  await load()
}

function startEdit(): void {
  if (!person.value) return
  personForm.value = personToForm(person.value)
  personVersion.value = person.value.updated_at
  personErrors.value = {}
}

async function savePerson(): Promise<void> {
  const current = person.value
  const version = personVersion.value
  if (!current || !version || !personForm.value || savingPerson.value) return
  const todayDate = today()
  personErrors.value = validatePerson(personForm.value, todayDate)
  if (hasErrors(personErrors.value)) return
  savingPerson.value = true
  try {
    await updatePerson(current.id, version, formToPersonInput(personForm.value, todayDate))
    personForm.value = null
    notify.success('person.saved')
    await load()
  } catch (error) {
    await handleSaveError(error, () => {
      personForm.value = null
    })
  } finally {
    savingPerson.value = false
  }
}

function startCheckIn(): void {
  stayForm.value = emptyStay(today())
  stayErrors.value = {}
  overlapHint.value = false
}

function cancelCheckIn(): void {
  stayForm.value = null
  overlapHint.value = false
}

async function saveCheckIn(): Promise<void> {
  if (!stayForm.value || savingStay.value) return
  stayErrors.value = validateStay(stayForm.value, today())
  if (hasErrors(stayErrors.value)) return
  savingStay.value = true
  overlapHint.value = false
  try {
    await checkIn(personId.value, formToStayInput(stayForm.value))
    notify.success('stays.newStay.saved')
    stayForm.value = null
    if (route.query.checkIn) await router.replace({ name: 'person', params: { id: personId.value } })
    await load()
  } catch (error) {
    notify.error(error)
    // A stay that started and ended today occupies today; reopening it is the fix (see the stay history).
    if (isApiError(error, 'overlapping_stays')) overlapHint.value = true
    // Another computer checked the person in first: show what is really there.
    if (isApiError(error, 'already_checked_in')) {
      stayForm.value = null
      await load()
    }
  } finally {
    savingStay.value = false
  }
}
</script>

<template>
  <div>
    <PageHeader title-key="common.personRecord" />
    <div v-if="notFound" class="alert alert-warning" role="alert">{{ t('person.notFound') }}</div>
    <p v-else-if="!person" class="text-body-secondary">{{ t('common.loading') }}</p>
    <template v-else>
      <div v-if="merged" class="alert alert-info" role="status" data-testid="merged-alert">
        {{ t('person.merged') }}
        <RouterLink :to="{ name: 'person', params: { id: person.merged_into_id ?? '' } }">{{
          t('person.mergedLink')
        }}</RouterLink>
      </div>
      <div class="row g-4">
        <div class="col-lg-4">
          <section class="card mb-4">
            <div class="card-body">
              <h2 class="h4" data-testid="person-name">{{ name }}</h2>
              <p class="mb-0" data-testid="stay-status">
                <span v-if="openStay" class="badge text-bg-success">{{
                  t('person.status.staying', { date: formatDate(openStay.entry_date) })
                }}</span>
                <span v-else class="badge text-bg-secondary">{{ t('person.status.notStaying') }}</span>
              </p>
            </div>
          </section>
        </div>
        <div class="col-lg-8">
          <section class="card mb-4">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-center mb-3">
                <h2 class="h5 mb-0">{{ t('person.detailsTitle') }}</h2>
                <button
                  v-if="!personForm && !merged"
                  type="button"
                  class="btn btn-sm btn-outline-primary"
                  @click="startEdit"
                >
                  {{ t('person.edit') }}
                </button>
              </div>
              <form v-if="personForm" class="person-edit-form" novalidate @submit.prevent="savePerson">
                <PersonForm
                  v-model="personForm"
                  :errors="personErrors"
                  :person-id="person.id"
                  :carer-label="carerName"
                />
                <div class="d-flex gap-2 mt-3">
                  <button type="submit" class="btn btn-primary" :disabled="savingPerson">
                    {{ t('person.save') }}
                  </button>
                  <button type="button" class="btn btn-outline-secondary" @click="personForm = null">
                    {{ t('common.cancel') }}
                  </button>
                </div>
              </form>
              <PersonDetails v-else :person="person" :carer="carer" />
            </div>
          </section>

          <section v-if="!merged && !openStay" class="card mb-4">
            <div class="card-body">
              <button v-if="!stayForm" type="button" class="btn btn-primary" @click="startCheckIn">
                {{ t('stays.newStay.action') }}
              </button>
              <form v-else class="new-stay-form" novalidate @submit.prevent="saveCheckIn">
                <h2 class="h5">{{ t('stays.newStay.title') }}</h2>
                <StayForm v-model="stayForm" :errors="stayErrors" id-prefix="new-stay" />
                <div
                  v-if="overlapHint"
                  class="alert alert-warning mt-3 mb-0"
                  role="alert"
                  data-testid="overlap-hint"
                >
                  {{ t('stays.newStay.overlapHint') }}
                </div>
                <div class="d-flex gap-2 mt-3">
                  <button type="submit" class="btn btn-primary" :disabled="savingStay">
                    {{ t('stays.newStay.save') }}
                  </button>
                  <button type="button" class="btn btn-outline-secondary" @click="cancelCheckIn">
                    {{ t('common.cancel') }}
                  </button>
                </div>
              </form>
            </div>
          </section>

          <section v-if="openStay" class="card mb-4">
            <div class="card-body">
              <h2 class="h5">{{ t('outings.list.title') }}</h2>
              <OutingList :outings="outings" />
            </div>
          </section>

          <section class="card mb-4">
            <div class="card-body">
              <h2 class="h5">{{ t('stays.history.title') }}</h2>
              <StayHistory :stays="stays" />
            </div>
          </section>
        </div>
      </div>
    </template>
  </div>
</template>
```

Inside the existing `person` object in `web/src/i18n/locales/es-MX.json`, add:

```json
"notFound": "No encontramos este registro.",
"merged": "Este registro se unió con otro de la misma persona.",
"mergedLink": "Ver el registro que se conservó",
"detailsTitle": "Datos",
"edit": "Editar datos",
"save": "Guardar cambios",
"saved": "Datos guardados.",
"staleTitle": "Alguien más cambió este registro",
"staleMessage": "Otra persona guardó cambios mientras editabas. ¿Quieres recargar el registro? Se perderán los cambios que no guardaste.",
"keepEditing": "Seguir editando",
"details": {
  "birthDate": "Fecha de nacimiento",
  "age": "Edad",
  "gender": "Género",
  "country": "País de origen",
  "region": "Departamento o estado",
  "carer": "Persona que lo cuida",
  "carerRecord": "Ver ficha",
  "unknown": "Sin dato"
},
"status": {
  "staying": "En el albergue desde {date}",
  "notStaying": "No está en el albergue"
}
```

Inside the existing `stays` object, add:

```json
"history": {
  "title": "Estancias",
  "entry": "Ingreso",
  "exit": "Egreso",
  "open": "Abierta",
  "bed": "Cama",
  "caseType": "Tipo de caso",
  "phone": "Teléfono",
  "notes": "Notas",
  "empty": "Sin estancias registradas."
},
"newStay": {
  "action": "Nueva estancia",
  "title": "Nueva estancia",
  "save": "Abrir estancia",
  "saved": "Estancia abierta.",
  "overlapHint": "Las fechas se cruzan con otra estancia de esta persona. Si ingresó y egresó hoy por error, reabre esa estancia desde el historial. Si no, revisa la fecha de ingreso."
}
```

Inside the existing `outings` object, add:

```json
"list": {
  "title": "Salidas de la estancia actual",
  "left": "Salió",
  "returned": "Regresó",
  "comment": "Comentario",
  "exception": "Excepción",
  "notReturned": "No ha regresado",
  "empty": "Sin salidas en esta estancia."
}
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `npm --prefix web run test -- tests/views/PersonView.test.ts`

Expected: PASS.

- [ ] **Step 10: Run the whole suite, the type check and the linter**

Run: `npm run web:test`, then `npm run web:typecheck`, then `npm run web:lint`

Expected: all pass.

- [ ] **Step 11: Commit**

```bash
git add web/src/api web/src/components/people/PersonDetails.vue web/src/components/stays/StayHistory.vue web/src/components/outings/OutingList.vue web/src/views/PersonView.vue web/src/i18n/locales/es-MX.json web/tests/views/PersonView.test.ts web/tests/integration/person-record.test.ts
git commit -m "feat(web): show the person record with edit and new stay"
```

---

### Task 7: Corrections on the person record

**Files:**
- Modify: `web/src/lib/dates.ts`, `web/src/api/stays.ts`, `web/src/api/outings.ts`
- Create: `web/src/components/forms/DateTimeField.vue`, `web/src/components/outings/outingFormModel.ts`, `web/src/components/outings/OutingEditDialog.vue`, `web/src/components/stays/StayEditDialog.vue`
- Replace: `web/src/components/stays/StayHistory.vue`, `web/src/components/outings/OutingList.vue`
- Modify: `web/src/views/PersonView.vue`
- Modify: `web/src/i18n/locales/es-MX.json`
- Create tests: `web/tests/lib/dates.wallClock.test.ts`, `web/tests/components/forms/DateTimeField.test.ts`, `web/tests/components/outings/outingFormModel.test.ts`, `web/tests/views/PersonView.corrections.test.ts`, `web/tests/integration/corrections.test.ts`

**Interfaces:**
- Consumes: Task 6 (`PersonView`, `handleSaveError`, `load`), `stayFormModel`, `StayForm`, `useSettingsStore().timezone`, `useSessionStore().isAdmin`, `ApiError`.
- Produces:
  - In `lib/dates.ts`: `addDays(value, days): string`, `startOfDayInstant(value, timeZone): string`, `toWallClock(instant, timeZone): Date | null`, `fromWallClock(wall, timeZone): string | null`.
  - In `api/stays.ts`: `updateStay(id, expectedUpdatedAt, patch: StayPatch): Promise<Stay>`, `deleteStay(id): Promise<void>`.
  - In `api/outings.ts`: `updateOuting(id, expectedUpdatedAt, patch): Promise<Outing>`, `deleteOuting(id): Promise<void>`.
  - `DateTimeField` (props `id`, `modelValue: string | null` ISO instant, `max?: string | null` ISO instant, `invalid?`; emits `update:modelValue`).
  - `outingFormModel.ts`: `OutingFormValue`, `OutingPatch`, `outingToForm`, `validateOuting(value, now: Date)`, `formToOutingPatch(value, original)`.
  - `StayEditDialog` (props `stay: Stay | null`, `saving`; open while `stay` is not null; emits `save(patch: StayPatch)`, `cancel`) and `OutingEditDialog` (props `outing: Outing | null`, `saving`; emits `save(patch: OutingPatch)`, `cancel`). Both stay mounted in `PersonView`.
  - `StayHistory` gains props `canEdit`, `canDelete`, `reopenableId` and emits `edit`, `remove`, `reopen`. `PersonView` offers reopen only on the newest stay, only while none is open, and only if it was checked out today. `OutingList` gains props `canEdit`, `canDelete` and emits `edit`, `remove`.

- [ ] **Step 1: Write the failing tests for time handling**

Create `web/tests/lib/dates.wallClock.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { addDays, fromWallClock, startOfDayInstant, toWallClock } from '@/lib/dates'

describe('addDays', () => {
  it('crosses months and years', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })
})

describe('startOfDayInstant', () => {
  it('finds local midnight in the shelter timezone', () => {
    expect(startOfDayInstant('2026-10-07', 'America/Mexico_City')).toBe('2026-10-07T06:00:00.000Z')
  })

  it('follows daylight saving time where the timezone has it', () => {
    expect(startOfDayInstant('2026-01-01', 'America/Tijuana')).toBe('2026-01-01T08:00:00.000Z')
    expect(startOfDayInstant('2026-07-01', 'America/Tijuana')).toBe('2026-07-01T07:00:00.000Z')
  })
})

describe('toWallClock and fromWallClock', () => {
  it('shows an instant as the shelter wall clock, whatever the browser timezone is', () => {
    const wall = toWallClock('2026-01-01T06:30:00.000Z', 'America/Mexico_City')
    expect([wall?.getFullYear(), wall?.getMonth(), wall?.getDate(), wall?.getHours(), wall?.getMinutes()]).toEqual([
      2026, 0, 1, 0, 30,
    ])
  })

  it('reads a wall-clock time back as an instant in the shelter timezone', () => {
    expect(fromWallClock(new Date(2026, 6, 1, 12, 15), 'America/Tijuana')).toBe('2026-07-01T19:15:00.000Z')
    expect(fromWallClock(new Date(2026, 9, 7, 23, 59), 'Europe/Madrid')).toBe('2026-10-07T21:59:00.000Z')
  })

  it('handles empty values', () => {
    expect(toWallClock(null, 'America/Mexico_City')).toBeNull()
    expect(fromWallClock(null, 'America/Mexico_City')).toBeNull()
  })
})
```

Create `web/tests/components/forms/DateTimeField.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import DateTimeField from '@/components/forms/DateTimeField.vue'
import { mountWithApp } from '../../utils/mountWithApp'
import { typeInto } from '../../utils/syncfusion'

afterEach(() => {
  document.body.innerHTML = ''
})

type Wrapper = Awaited<ReturnType<typeof mountWithApp>>['wrapper']

function inputValue(wrapper: Wrapper): string {
  return (wrapper.find('#when').element as HTMLInputElement).value
}

describe('DateTimeField', () => {
  it('shows the instant as the shelter wall-clock time', async () => {
    const { wrapper } = await mountWithApp(DateTimeField, {
      props: { id: 'when', modelValue: '2026-10-07T16:30:00.000Z' },
      timezone: 'America/Mexico_City',
    })
    expect(inputValue(wrapper)).toBe('07/10/2026 10:30')
  })

  it('emits a typed time as the instant it means in the shelter timezone', async () => {
    const { wrapper } = await mountWithApp(DateTimeField, {
      props: { id: 'when', modelValue: null },
      timezone: 'America/Tijuana',
    })
    await typeInto(wrapper.find('#when'), '01/07/2026 12:15')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['2026-07-01T19:15:00.000Z'])
  })

  it('follows the parent without echoing a value that only differs in seconds', async () => {
    const { wrapper } = await mountWithApp(DateTimeField, {
      props: { id: 'when', modelValue: '2026-10-07T16:30:45.000Z' },
      timezone: 'America/Mexico_City',
    })
    await wrapper.setProps({ modelValue: '2026-10-07T17:00:20.000Z' })
    await vi.waitFor(() => expect(inputValue(wrapper)).toBe('07/10/2026 11:00'))
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('emits null when cleared', async () => {
    const { wrapper } = await mountWithApp(DateTimeField, {
      props: { id: 'when', modelValue: '2026-10-07T16:30:00.000Z' },
      timezone: 'America/Mexico_City',
    })
    await typeInto(wrapper.find('#when'), '')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([null])
  })
})
```

Create `web/tests/components/outings/outingFormModel.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { formToOutingPatch, outingToForm, validateOuting } from '@/components/outings/outingFormModel'
import { makeOuting } from '../../fixtures/data'

const now = new Date('2026-10-07T18:00:00Z')

describe('validateOuting', () => {
  it('requires the time the person left', () => {
    expect(validateOuting({ left_at: null, returned_at: null, comment: '' }, now)).toEqual({
      left_at: 'validation.required',
    })
  })

  it('rejects times later than now', () => {
    expect(
      validateOuting({ left_at: '2026-10-07T18:05:00Z', returned_at: '2026-10-07T18:10:00Z', comment: '' }, now),
    ).toEqual({ left_at: 'outings.validation.future', returned_at: 'outings.validation.future' })
  })

  it('requires the return to come after leaving', () => {
    expect(
      validateOuting({ left_at: '2026-10-07T16:00:00Z', returned_at: '2026-10-07T16:00:00Z', comment: '' }, now),
    ).toEqual({ returned_at: 'outings.validation.returnBeforeLeave' })
  })

  it('accepts an outing with no return yet', () => {
    expect(validateOuting({ left_at: '2026-10-07T16:00:00Z', returned_at: null, comment: '' }, now)).toEqual({})
  })
})

describe('formToOutingPatch', () => {
  it('sends only what changed, so untouched times keep their seconds', () => {
    const original = makeOuting({ left_at: '2026-10-06T16:00:27+00:00', returned_at: null, comment: null })
    const form = outingToForm(original)
    expect(formToOutingPatch(form, original)).toEqual({})
    form.returned_at = '2026-10-06T19:00:00.000Z'
    form.comment = 'Regresó tarde'
    expect(formToOutingPatch(form, original)).toEqual({
      returned_at: '2026-10-06T19:00:00.000Z',
      comment: 'Regresó tarde',
    })
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm --prefix web run test -- tests/lib/dates.wallClock.test.ts tests/components/forms/DateTimeField.test.ts tests/components/outings`

Expected: FAIL, because the helpers, the field and the model do not exist yet.

- [ ] **Step 3: Implement the time helpers, the field and the outing model**

Append to `web/src/lib/dates.ts`:

```ts
/** Calendar arithmetic on 'YYYY-MM-DD' values. */
export function addDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

interface WallClock {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

function wallClockIn(instant: Date, timeZone: string): WallClock {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant)
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0)
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  }
}

/** How far the timezone's wall clock is ahead of UTC at a given instant. */
function offsetMs(instantMs: number, timeZone: string): number {
  const wall = wallClockIn(new Date(instantMs), timeZone)
  const wholeSecond = Math.floor(instantMs / 1000) * 1000
  return Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second) - wholeSecond
}

function zonedToInstant(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): string {
  const asUtc = Date.UTC(year, month - 1, day, hour, minute)
  let instant = asUtc - offsetMs(asUtc, timeZone)
  // A second pass fixes the guess when the offset changes in between (daylight saving time).
  const corrected = asUtc - offsetMs(instant, timeZone)
  if (corrected !== instant) instant = corrected
  return new Date(instant).toISOString()
}

/** The instant local midnight starts the given day in the timezone. */
export function startOfDayInstant(value: string, timeZone: string): string {
  const match = DATE_ONLY.exec(value)
  if (!match) throw new Error('startOfDayInstant expects YYYY-MM-DD')
  return zonedToInstant(Number(match[1]), Number(match[2]), Number(match[3]), 0, 0, timeZone)
}

/**
 * An instant as a Date whose local fields show the wall-clock time in `timeZone`.
 * Date-time pickers display local fields, so this makes them show shelter time.
 */
export function toWallClock(value: string | null | undefined, timeZone: string): Date | null {
  if (!value) return null
  const instant = new Date(value)
  if (Number.isNaN(instant.getTime())) return null
  const wall = wallClockIn(instant, timeZone)
  return new Date(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute)
}

/** The reverse of toWallClock: a picker value read as shelter wall-clock time. */
export function fromWallClock(value: Date | null | undefined, timeZone: string): string | null {
  if (!value || Number.isNaN(value.getTime())) return null
  return zonedToInstant(
    value.getFullYear(),
    value.getMonth() + 1,
    value.getDate(),
    value.getHours(),
    value.getMinutes(),
    timeZone,
  )
}
```

Create `web/src/components/forms/DateTimeField.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { DateTimePickerComponent as EjsDatetimepicker } from '@syncfusion/ej2-vue-calendars'
import { fromWallClock, toWallClock } from '@/lib/dates'
import { useSettingsStore } from '@/stores/settings'

const props = withDefaults(
  defineProps<{ id: string; modelValue: string | null; max?: string | null; invalid?: boolean }>(),
  { max: null, invalid: false },
)
const emit = defineEmits<{ 'update:modelValue': [value: string | null] }>()

const settings = useSettingsStore()
const LAST_MOMENT = new Date(2099, 11, 31, 23, 59)

// The picker shows the shelter's wall-clock time, whatever the browser's timezone is.
const pickerValue = computed(() => toWallClock(props.modelValue, settings.timezone))
const maxValue = computed(() => toWallClock(props.max, settings.timezone) ?? LAST_MOMENT)

function sameMinute(a: string | null, b: string | null): boolean {
  if (a === null || b === null) return a === b
  return Math.floor(Date.parse(a) / 60_000) === Math.floor(Date.parse(b) / 60_000)
}

function onChange(args: { value: Date | null }): void {
  const next = fromWallClock(args.value, settings.timezone)
  if (!sameMinute(next, props.modelValue)) emit('update:modelValue', next)
}
</script>

<template>
  <ejs-datetimepicker
    :id="id"
    :value="pickerValue"
    format="dd/MM/yyyy HH:mm"
    time-format="HH:mm"
    :step="5"
    :max="maxValue"
    :css-class="invalid ? 'e-error' : ''"
    @change="onChange"
  />
</template>
```

Create `web/src/components/outings/outingFormModel.ts`:

```ts
import type { FieldErrors } from '@/components/forms/fieldErrors'
import type { Outing } from '@/types/domain'

export interface OutingFormValue {
  left_at: string | null
  returned_at: string | null
  comment: string
}

export type OutingPatch = Partial<Pick<Outing, 'left_at' | 'returned_at' | 'comment'>>

export function outingToForm(outing: Outing): OutingFormValue {
  return { left_at: outing.left_at, returned_at: outing.returned_at, comment: outing.comment ?? '' }
}

/** Mirrors the database: no times later than now, and the return after leaving. */
export function validateOuting(value: OutingFormValue, now: Date): FieldErrors {
  const errors: FieldErrors = {}
  const nowMs = now.getTime()
  if (!value.left_at) errors.left_at = 'validation.required'
  else if (Date.parse(value.left_at) > nowMs) errors.left_at = 'outings.validation.future'
  if (value.returned_at) {
    if (Date.parse(value.returned_at) > nowMs) errors.returned_at = 'outings.validation.future'
    else if (value.left_at && Date.parse(value.returned_at) <= Date.parse(value.left_at)) {
      errors.returned_at = 'outings.validation.returnBeforeLeave'
    }
  }
  return errors
}

function sameInstant(a: string | null, b: string | null): boolean {
  if (a === null || b === null) return a === b
  return Date.parse(a) === Date.parse(b)
}

/** Only the fields that changed, so untouched times keep their exact value. */
export function formToOutingPatch(value: OutingFormValue, original: Outing): OutingPatch {
  const patch: OutingPatch = {}
  if (value.left_at && !sameInstant(value.left_at, original.left_at)) patch.left_at = value.left_at
  if (!sameInstant(value.returned_at, original.returned_at)) patch.returned_at = value.returned_at
  if (value.comment !== (original.comment ?? '')) patch.comment = value.comment
  return patch
}
```

- [ ] **Step 4: Run them to verify they pass**

Run: `npm --prefix web run test -- tests/lib tests/components/forms tests/components/outings`

Expected: PASS.

- [ ] **Step 5: Write the failing view and integration tests**

Create `web/tests/views/PersonView.corrections.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteOuting, listOutingsForStay, updateOuting } from '@/api/outings'
import { getPerson } from '@/api/people'
import { deleteStay, listStaysForPerson, updateStay } from '@/api/stays'
import { todayIn } from '@/lib/shelterTime'
import PersonView from '@/views/PersonView.vue'
import { makeOuting, makePerson, makeStay, STAMP, uuid } from '../fixtures/data'
import { mountWithApp } from '../utils/mountWithApp'
import { body, typeInto } from '../utils/syncfusion'

const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
const confirm = vi.hoisted(() => vi.fn())
vi.mock('@/composables/useNotify', () => ({ useNotify: () => notify }))
vi.mock('@/composables/useConfirm', () => ({ useConfirm: () => ({ confirm }) }))
vi.mock('@/api/people', () => ({ getPerson: vi.fn(), updatePerson: vi.fn() }))
vi.mock('@/api/stays', () => ({
  listStaysForPerson: vi.fn(),
  checkIn: vi.fn(),
  listCurrentResidents: vi.fn(async () => []),
  updateStay: vi.fn(),
  deleteStay: vi.fn(),
}))
vi.mock('@/api/outings', () => ({
  listOutingsForStay: vi.fn(),
  updateOuting: vi.fn(),
  deleteOuting: vi.fn(),
}))
vi.mock('@/api/photos', () => ({
  photoPathFor: (id: string) => `${id}.jpg`,
  thumbPathFor: (path: string) => path.replace(/\.jpg$/, '_thumb.jpg'),
  getSignedPhotoUrls: vi.fn(async () => ({})),
  uploadPersonPhoto: vi.fn(),
}))

type Wrapper = Awaited<ReturnType<typeof mountWithApp>>['wrapper']

const openStay = makeStay({ id: uuid(101), entry_date: '2026-10-03', bed: 'A1' })
const pastStay = makeStay({ id: uuid(100), entry_date: '2026-08-01', exit_date: '2026-08-15', bed: 'C4' })
const outing = makeOuting({ id: uuid(201), stay_id: uuid(101), returned_at: '2026-10-06T18:30:00+00:00' })

async function mountLoaded(role: 'volunteer' | 'admin' = 'volunteer'): Promise<Wrapper> {
  const { wrapper } = await mountWithApp(PersonView, { initialRoute: `/people/${uuid(1)}`, session: { role } })
  await vi.waitFor(() => expect(wrapper.find('[data-testid="person-name"]').exists()).toBe(true))
  return wrapper
}

function rowButton(w: Wrapper, rowTestId: string, index: number, label: string) {
  const row = w.findAll(`[data-testid="${rowTestId}"]`)[index]
  const found = row?.findAll('button').find((candidate) => candidate.text() === label)
  if (!found) throw new Error(`No ${label} button in ${rowTestId} ${index}`)
  return found
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getPerson).mockResolvedValue(makePerson())
  vi.mocked(listStaysForPerson).mockResolvedValue([openStay, pastStay])
  vi.mocked(listOutingsForStay).mockResolvedValue([outing])
  confirm.mockResolvedValue(true)
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('PersonView corrections', () => {
  it('edits the open stay without touching its exit date', async () => {
    vi.mocked(updateStay).mockResolvedValue(makeStay({ bed: 'B3' }))
    const w = await mountLoaded()
    await rowButton(w, 'stay-row', 0, 'Editar').trigger('click')
    await vi.waitFor(() => expect(body().find('#stay-edit-bed').exists()).toBe(true))
    expect(body().find('#stay-edit-exit-date').exists()).toBe(false)
    await body().find('#stay-edit-bed').setValue('B3')
    await body().find('form.stay-edit-form').trigger('submit')
    await vi.waitFor(() =>
      expect(updateStay).toHaveBeenCalledWith(uuid(101), STAMP, expect.objectContaining({ bed: 'B3' })),
    )
    expect(vi.mocked(updateStay).mock.calls[0]?.[2]).not.toHaveProperty('exit_date')
    expect(notify.success).toHaveBeenCalledWith('stays.edit.saved')
  })

  it('lets a closed stay have its exit date corrected', async () => {
    const w = await mountLoaded()
    await rowButton(w, 'stay-row', 1, 'Editar').trigger('click')
    await vi.waitFor(() => expect(body().find('#stay-edit-exit-date').exists()).toBe(true))
  })

  it('shows delete only to admins, and asks first', async () => {
    const volunteerView = await mountLoaded()
    expect(volunteerView.findAll('button').some((candidate) => candidate.text() === 'Eliminar')).toBe(false)
    document.body.innerHTML = ''
    vi.mocked(deleteStay).mockResolvedValue()
    const adminView = await mountLoaded('admin')
    await rowButton(adminView, 'stay-row', 1, 'Eliminar').trigger('click')
    await vi.waitFor(() => expect(deleteStay).toHaveBeenCalledWith(uuid(100)))
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ messageKey: 'stays.edit.deleteMessage', danger: true }))
    expect(notify.success).toHaveBeenCalledWith('stays.edit.deleted')
  })

  it('reopens the most recent stay when it was closed by mistake', async () => {
    const closedToday = makeStay({ id: uuid(102), entry_date: todayIn('America/Mexico_City'), exit_date: todayIn('America/Mexico_City') })
    vi.mocked(listStaysForPerson).mockResolvedValue([closedToday, pastStay])
    vi.mocked(updateStay).mockResolvedValue(makeStay({ id: uuid(102), exit_date: null }))
    const w = await mountLoaded()
    expect(w.findAll('[data-testid="stay-row"]')[1]?.text()).not.toContain('Reabrir estancia')
    await rowButton(w, 'stay-row', 0, 'Reabrir estancia').trigger('click')
    await vi.waitFor(() => expect(updateStay).toHaveBeenCalledWith(uuid(102), STAMP, { exit_date: null }))
    expect(notify.success).toHaveBeenCalledWith('stays.reopen.done')
  })

  it('offers no reopen while a stay is open', async () => {
    const w = await mountLoaded()
    expect(w.findAll('button').some((candidate) => candidate.text() === 'Reabrir estancia')).toBe(false)
  })

  it('offers no reopen for a stay closed on an earlier day', async () => {
    vi.mocked(listStaysForPerson).mockResolvedValue([pastStay])
    const w = await mountLoaded()
    expect(w.findAll('button').some((candidate) => candidate.text() === 'Reabrir estancia')).toBe(false)
  })

  it('corrects an outing return time, read as shelter time', async () => {
    vi.mocked(updateOuting).mockResolvedValue(outing)
    const w = await mountLoaded()
    await rowButton(w, 'outing-row', 0, 'Editar').trigger('click')
    await vi.waitFor(() => expect(body().find('#outing-returned-at').exists()).toBe(true))
    await typeInto(body().find('#outing-returned-at'), '06/10/2026 13:00')
    await body().find('form.outing-edit-form').trigger('submit')
    await vi.waitFor(() =>
      expect(updateOuting).toHaveBeenCalledWith(uuid(201), STAMP, { returned_at: '2026-10-06T19:00:00.000Z' }),
    )
    expect(notify.success).toHaveBeenCalledWith('outings.edit.saved')
  })

  it('refuses an outing time in the future', async () => {
    const w = await mountLoaded()
    await rowButton(w, 'outing-row', 0, 'Editar').trigger('click')
    await vi.waitFor(() => expect(body().find('#outing-left-at').exists()).toBe(true))
    const nextYear = Number(todayIn('America/Mexico_City').slice(0, 4)) + 1
    await typeInto(body().find('#outing-left-at'), `01/01/${nextYear} 10:00`)
    await body().find('form.outing-edit-form').trigger('submit')
    expect(body().text()).toContain('La hora no puede ser posterior a este momento.')
    expect(updateOuting).not.toHaveBeenCalled()
  })

  it('lets an admin delete an outing recorded by mistake', async () => {
    vi.mocked(deleteOuting).mockResolvedValue()
    const w = await mountLoaded('admin')
    await rowButton(w, 'outing-row', 0, 'Eliminar').trigger('click')
    await vi.waitFor(() => expect(deleteOuting).toHaveBeenCalledWith(uuid(201)))
    expect(notify.success).toHaveBeenCalledWith('outings.edit.deleted')
  })
})
```

Create `web/tests/integration/corrections.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { deleteOuting, endOuting, listOutingsForStay, startOuting, updateOuting } from '@/api/outings'
import { checkOut, deleteStay, listCurrentResidents, listStaysForPerson, updateStay } from '@/api/stays'
import { createResident, daysAgo } from './factories'
import { signInAs } from './helpers'

describe('corrections', () => {
  beforeAll(async () => {
    await signInAs('volunteer')
  })

  afterAll(async () => {
    await signInAs('volunteer')
  })

  it('updates a stay with optimistic concurrency and trims text', async () => {
    const { personId, stayId } = await createResident({}, { bed: 'A1' })
    const [stay] = await listStaysForPerson(personId)
    if (!stay) throw new Error('missing stay')
    const updated = await updateStay(stayId, stay.updated_at, { bed: ' B3 ', notes: '  ' })
    expect(updated).toMatchObject({ bed: 'B3', notes: null })
    await expect(updateStay(stayId, stay.updated_at, { bed: 'C1' })).rejects.toMatchObject({ code: 'stale_record' })
  })

  it('reopens a stay checked out today by mistake', async () => {
    const { personId, stayId } = await createResident()
    await checkOut(stayId)
    const [closed] = await listStaysForPerson(personId)
    if (!closed) throw new Error('missing stay')
    await updateStay(stayId, closed.updated_at, { exit_date: null })
    expect((await listCurrentResidents()).some((resident) => resident.stay_id === stayId)).toBe(true)
  })

  it('corrects an outing and trims its comment', async () => {
    const { stayId } = await createResident({}, { entry_date: daysAgo(2) })
    await startOuting(stayId)
    await endOuting(stayId)
    const [outing] = await listOutingsForStay(stayId)
    if (!outing) throw new Error('missing outing')
    const updated = await updateOuting(outing.id, outing.updated_at, {
      returned_at: null,
      comment: '  Olvidó registrar el regreso  ',
    })
    expect(updated).toMatchObject({ returned_at: null, comment: 'Olvidó registrar el regreso' })
  })

  it('lets only an admin delete stays and outings', async () => {
    const { stayId } = await createResident({}, { entry_date: daysAgo(2) })
    const outingId = await startOuting(stayId)
    await expect(deleteOuting(outingId)).rejects.toMatchObject({ code: 'not_found' })
    await expect(deleteStay(stayId)).rejects.toMatchObject({ code: 'not_found' })
    await signInAs('admin')
    await expect(deleteOuting(outingId)).resolves.toBeUndefined()
    await expect(deleteStay(stayId)).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 6: Run them to verify they fail**

Run: `npm --prefix web run test -- tests/views/PersonView.corrections.test.ts`

Expected: FAIL, because the rows have no Editar buttons yet.

Run: `npm run db:reset`, then `npm --prefix web run test:integration -- tests/integration/corrections.test.ts`

Expected: FAIL, because `updateStay`, `deleteStay`, `updateOuting` and `deleteOuting` are not exported yet.

- [ ] **Step 7: Implement the API functions**

In `web/src/api/stays.ts`, change `import { toApiError } from './errors'` to `import { ApiError, toApiError } from './errors'`, add `import { updateVersioned } from './rows'`, then append:

```ts
/** Saves only if nobody changed the stay since `expectedUpdatedAt`. `{ exit_date: null }` reopens it. */
export async function updateStay(id: string, expectedUpdatedAt: string, patch: StayPatch): Promise<Stay> {
  return updateVersioned('stays', { column: 'id', value: id }, expectedUpdatedAt, cleanStay(patch))
}

/** Admin only. Deleting a stay also deletes its outings. */
export async function deleteStay(id: string): Promise<void> {
  const { data, error } = await supabase.from('stays').delete().eq('id', id).select('id')
  if (error) throw toApiError(error)
  // RLS hides rows the caller may not delete, so nothing deleted means not found or not allowed.
  if (!data || data.length === 0) throw new ApiError('not_found')
}
```

In `web/src/api/outings.ts`, change `import { toApiError } from './errors'` to `import { ApiError, toApiError } from './errors'`, add `import { updateVersioned } from './rows'`, then append:

```ts
export async function updateOuting(
  id: string,
  expectedUpdatedAt: string,
  patch: Partial<Pick<Outing, 'left_at' | 'returned_at' | 'comment'>>,
): Promise<Outing> {
  const cleaned = { ...patch }
  if ('comment' in patch) cleaned.comment = cleanText(patch.comment)
  return updateVersioned('outings', { column: 'id', value: id }, expectedUpdatedAt, cleaned)
}

/** Admin only. */
export async function deleteOuting(id: string): Promise<void> {
  const { data, error } = await supabase.from('outings').delete().eq('id', id).select('id')
  if (error) throw toApiError(error)
  // RLS hides rows the caller may not delete, so nothing deleted means not found or not allowed.
  if (!data || data.length === 0) throw new ApiError('not_found')
}
```

- [ ] **Step 8: Implement the dialogs and the row actions**

Create `web/src/components/stays/StayEditDialog.vue`:

```vue
<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { type CloseEventArgs, DialogComponent as EjsDialog } from '@syncfusion/ej2-vue-popups'
import type { StayPatch } from '@/api/stays'
import { type FieldErrors, hasErrors } from '@/components/forms/fieldErrors'
import StayForm from '@/components/stays/StayForm.vue'
import {
  formToStayPatch,
  type StayFormValue,
  stayToForm,
  validateStay,
} from '@/components/stays/stayFormModel'
import { useShelterTime } from '@/composables/useShelterTime'
import type { Stay } from '@/types/domain'

const props = defineProps<{ stay: Stay | null; saving: boolean }>()
const emit = defineEmits<{ save: [patch: StayPatch]; cancel: [] }>()

const { t } = useI18n()
const { today } = useShelterTime()
const form = ref<StayFormValue | null>(null)
const errors = ref<FieldErrors>({})
const closed = ref(false)

// The dialog stays mounted; each opening loads the chosen stay into a fresh form.
watch(
  () => props.stay,
  (stay) => {
    form.value = stay ? stayToForm(stay) : null
    closed.value = stay?.exit_date !== null && stay?.exit_date !== undefined
    errors.value = {}
  },
  { immediate: true },
)

function submit(): void {
  if (!form.value) return
  errors.value = validateStay(form.value, today(), closed.value)
  if (hasErrors(errors.value)) return
  emit('save', formToStayPatch(form.value, closed.value))
}

function onClose(args: CloseEventArgs): void {
  if (args.isInteracted) emit('cancel')
}
</script>

<template>
  <ejs-dialog
    :visible="stay !== null"
    :is-modal="true"
    :show-close-icon="true"
    :close-on-escape="true"
    :animation-settings="{ effect: 'None' }"
    :header="t('stays.edit.title')"
    width="min(40rem, 95vw)"
    @close="onClose"
  >
    <form v-if="form" class="stay-edit-form" novalidate @submit.prevent="submit">
      <StayForm v-model="form" :errors="errors" id-prefix="stay-edit" :show-exit-date="closed" />
      <div class="d-flex justify-content-end gap-2 mt-3">
        <button type="button" class="btn btn-outline-secondary" @click="emit('cancel')">
          {{ t('common.cancel') }}
        </button>
        <button type="submit" class="btn btn-primary" :disabled="saving">{{ t('common.save') }}</button>
      </div>
    </form>
  </ejs-dialog>
</template>
```

Create `web/src/components/outings/OutingEditDialog.vue`:

```vue
<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { type CloseEventArgs, DialogComponent as EjsDialog } from '@syncfusion/ej2-vue-popups'
import DateTimeField from '@/components/forms/DateTimeField.vue'
import { type FieldErrors, hasErrors } from '@/components/forms/fieldErrors'
import {
  formToOutingPatch,
  type OutingFormValue,
  type OutingPatch,
  outingToForm,
  validateOuting,
} from '@/components/outings/outingFormModel'
import type { Outing } from '@/types/domain'

const props = defineProps<{ outing: Outing | null; saving: boolean }>()
const emit = defineEmits<{ save: [patch: OutingPatch]; cancel: [] }>()

const { t } = useI18n()
const form = ref<OutingFormValue | null>(null)
const errors = ref<FieldErrors>({})
// The pickers stop at the current time; the database checks the same against its own clock.
const now = ref(new Date().toISOString())

// The dialog stays mounted; each opening starts from the recorded times.
watch(
  () => props.outing,
  (outing) => {
    form.value = outing ? outingToForm(outing) : null
    errors.value = {}
    now.value = new Date().toISOString()
  },
  { immediate: true },
)

function submit(): void {
  if (!form.value || !props.outing) return
  errors.value = validateOuting(form.value, new Date())
  if (hasErrors(errors.value)) return
  const patch = formToOutingPatch(form.value, props.outing)
  if (Object.keys(patch).length === 0) emit('cancel')
  else emit('save', patch)
}

function onClose(args: CloseEventArgs): void {
  if (args.isInteracted) emit('cancel')
}
</script>

<template>
  <ejs-dialog
    :visible="outing !== null"
    :is-modal="true"
    :show-close-icon="true"
    :close-on-escape="true"
    :animation-settings="{ effect: 'None' }"
    :header="t('outings.edit.title')"
    width="min(32rem, 95vw)"
    @close="onClose"
  >
    <form v-if="form" class="outing-edit-form" novalidate @submit.prevent="submit">
      <div class="mb-3">
        <label for="outing-left-at" class="form-label">{{ t('outings.edit.leftAt') }}</label>
        <DateTimeField id="outing-left-at" v-model="form.left_at" :max="now" :invalid="!!errors.left_at" />
        <div v-if="errors.left_at" class="invalid-feedback d-block">{{ t(errors.left_at) }}</div>
      </div>
      <div class="mb-3">
        <label for="outing-returned-at" class="form-label">{{ t('outings.edit.returnedAt') }}</label>
        <DateTimeField
          id="outing-returned-at"
          v-model="form.returned_at"
          :max="now"
          :invalid="!!errors.returned_at"
        />
        <div class="form-text">{{ t('outings.edit.returnedHelp') }}</div>
        <div v-if="errors.returned_at" class="invalid-feedback d-block">{{ t(errors.returned_at) }}</div>
      </div>
      <div class="mb-3">
        <label for="outing-edit-comment" class="form-label">{{ t('outings.edit.comment') }}</label>
        <input
          id="outing-edit-comment"
          v-model="form.comment"
          type="text"
          class="form-control"
          maxlength="500"
          autocomplete="off"
        />
      </div>
      <div class="d-flex justify-content-end gap-2">
        <button type="button" class="btn btn-outline-secondary" @click="emit('cancel')">
          {{ t('common.cancel') }}
        </button>
        <button type="submit" class="btn btn-primary" :disabled="saving">{{ t('common.save') }}</button>
      </div>
    </form>
  </ejs-dialog>
</template>
```

Replace `web/src/components/stays/StayHistory.vue` with:

```vue
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useShelterTime } from '@/composables/useShelterTime'
import { useCatalogsStore } from '@/stores/catalogs'
import type { Stay } from '@/types/domain'

withDefaults(
  defineProps<{ stays: Stay[]; canEdit?: boolean; canDelete?: boolean; reopenableId?: string | null }>(),
  { canEdit: false, canDelete: false, reopenableId: null },
)
const emit = defineEmits<{ edit: [stay: Stay]; remove: [stay: Stay]; reopen: [stay: Stay] }>()

const { t } = useI18n()
const { formatDate } = useShelterTime()
const catalogs = useCatalogsStore()
</script>

<template>
  <p v-if="stays.length === 0" class="text-body-secondary mb-0">{{ t('stays.history.empty') }}</p>
  <div v-else class="table-responsive">
    <table class="table table-sm align-middle mb-0">
      <thead>
        <tr>
          <th scope="col">{{ t('stays.history.entry') }}</th>
          <th scope="col">{{ t('stays.history.exit') }}</th>
          <th scope="col">{{ t('stays.history.bed') }}</th>
          <th scope="col">{{ t('stays.history.caseType') }}</th>
          <th scope="col">{{ t('stays.history.phone') }}</th>
          <th scope="col">{{ t('stays.history.notes') }}</th>
          <th v-if="canEdit" scope="col">
            <span class="visually-hidden">{{ t('stays.history.actions') }}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="stay in stays" :key="stay.id" data-testid="stay-row">
          <td>{{ formatDate(stay.entry_date) }}</td>
          <td>
            <span v-if="stay.exit_date">{{ formatDate(stay.exit_date) }}</span>
            <span v-else class="badge text-bg-success">{{ t('stays.history.open') }}</span>
          </td>
          <td>{{ stay.bed }}</td>
          <td>{{ catalogs.label('case_types', stay.case_type_code) }}</td>
          <td>{{ t(`phoneStatus.${stay.phone_status}`) }}</td>
          <td class="text-break">{{ stay.notes }}</td>
          <td v-if="canEdit" class="text-nowrap">
            <button type="button" class="btn btn-sm btn-link" @click="emit('edit', stay)">
              {{ t('stays.edit.action') }}
            </button>
            <button
              v-if="stay.id === reopenableId"
              type="button"
              class="btn btn-sm btn-link"
              @click="emit('reopen', stay)"
            >
              {{ t('stays.reopen.action') }}
            </button>
            <button
              v-if="canDelete"
              type="button"
              class="btn btn-sm btn-link text-danger"
              @click="emit('remove', stay)"
            >
              {{ t('stays.edit.delete') }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
```

Replace `web/src/components/outings/OutingList.vue` with:

```vue
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useShelterTime } from '@/composables/useShelterTime'
import type { Outing } from '@/types/domain'

withDefaults(defineProps<{ outings: Outing[]; canEdit?: boolean; canDelete?: boolean }>(), {
  canEdit: false,
  canDelete: false,
})
const emit = defineEmits<{ edit: [outing: Outing]; remove: [outing: Outing] }>()

const { t } = useI18n()
const { formatDateTime } = useShelterTime()
</script>

<template>
  <p v-if="outings.length === 0" class="text-body-secondary mb-0">{{ t('outings.list.empty') }}</p>
  <div v-else class="table-responsive">
    <table class="table table-sm align-middle mb-0">
      <thead>
        <tr>
          <th scope="col">{{ t('outings.list.left') }}</th>
          <th scope="col">{{ t('outings.list.returned') }}</th>
          <th scope="col">{{ t('outings.list.comment') }}</th>
          <th v-if="canEdit" scope="col">
            <span class="visually-hidden">{{ t('outings.list.actions') }}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="outing in outings" :key="outing.id" data-testid="outing-row">
          <td>
            {{ formatDateTime(outing.left_at) }}
            <span v-if="outing.is_exception" class="badge text-bg-warning ms-1">{{
              t('outings.list.exception')
            }}</span>
          </td>
          <td>
            <span v-if="outing.returned_at">{{ formatDateTime(outing.returned_at) }}</span>
            <span v-else class="badge text-bg-warning">{{ t('outings.list.notReturned') }}</span>
          </td>
          <td class="text-break">{{ outing.comment }}</td>
          <td v-if="canEdit" class="text-nowrap">
            <button type="button" class="btn btn-sm btn-link" @click="emit('edit', outing)">
              {{ t('outings.edit.action') }}
            </button>
            <button
              v-if="canDelete"
              type="button"
              class="btn btn-sm btn-link text-danger"
              @click="emit('remove', outing)"
            >
              {{ t('outings.edit.delete') }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
```

- [ ] **Step 9: Wire the corrections into the person record**

In `web/src/views/PersonView.vue`, make these changes.

Replace the three API import lines with:

```ts
import { deleteOuting, listOutingsForStay, updateOuting } from '@/api/outings'
import { getPerson, updatePerson } from '@/api/people'
import { checkIn, deleteStay, listStaysForPerson, type StayPatch, updateStay } from '@/api/stays'
```

Add these imports below the existing component imports:

```ts
import OutingEditDialog from '@/components/outings/OutingEditDialog.vue'
import type { OutingPatch } from '@/components/outings/outingFormModel'
import StayEditDialog from '@/components/stays/StayEditDialog.vue'
import { useSessionStore } from '@/stores/session'
```

Add after `const { today } = useShelterTime()`:

```ts
const session = useSessionStore()
```

Add after the `overlapHint` declaration:

```ts
const editingStay = ref<Stay | null>(null)
const editingOuting = ref<Outing | null>(null)
const savingCorrection = ref(false)

// Only the newest stay, only while none is open, and only if it was checked out today (by mistake).
const reopenableId = computed(() => {
  if (merged.value || openStay.value) return null
  const newest = stays.value[0]
  return newest && newest.exit_date === today() ? newest.id : null
})
```

In the `watch(personId, ...)` callback, add `editingStay.value = null` and `editingOuting.value = null` next to the other resets.

Append these functions at the end of the script:

```ts
async function saveStay(patch: StayPatch): Promise<void> {
  const stay = editingStay.value
  if (!stay || savingCorrection.value) return
  savingCorrection.value = true
  try {
    await updateStay(stay.id, stay.updated_at, patch)
    editingStay.value = null
    notify.success('stays.edit.saved')
    await load()
  } catch (error) {
    await handleSaveError(error, () => {
      editingStay.value = null
    })
  } finally {
    savingCorrection.value = false
  }
}

async function removeStay(stay: Stay): Promise<void> {
  const approved = await confirm({
    titleKey: 'stays.edit.deleteTitle',
    messageKey: 'stays.edit.deleteMessage',
    confirmKey: 'stays.edit.deleteConfirm',
    danger: true,
  })
  if (!approved) return
  try {
    await deleteStay(stay.id)
    notify.success('stays.edit.deleted')
  } catch (error) {
    notify.error(error)
  } finally {
    await load()
  }
}

async function reopenStay(stay: Stay): Promise<void> {
  const approved = await confirm({
    titleKey: 'stays.reopen.title',
    messageKey: 'stays.reopen.message',
    confirmKey: 'stays.reopen.confirm',
  })
  if (!approved) return
  try {
    await updateStay(stay.id, stay.updated_at, { exit_date: null })
    notify.success('stays.reopen.done')
    stayForm.value = null
    overlapHint.value = false
  } catch (error) {
    notify.error(error)
  } finally {
    await load()
  }
}

async function saveOuting(patch: OutingPatch): Promise<void> {
  const outing = editingOuting.value
  if (!outing || savingCorrection.value) return
  savingCorrection.value = true
  try {
    await updateOuting(outing.id, outing.updated_at, patch)
    editingOuting.value = null
    notify.success('outings.edit.saved')
    await load()
  } catch (error) {
    await handleSaveError(error, () => {
      editingOuting.value = null
    })
  } finally {
    savingCorrection.value = false
  }
}

async function removeOuting(outing: Outing): Promise<void> {
  const approved = await confirm({
    titleKey: 'outings.edit.deleteTitle',
    messageKey: 'outings.edit.deleteMessage',
    confirmKey: 'outings.edit.deleteConfirm',
    danger: true,
  })
  if (!approved) return
  try {
    await deleteOuting(outing.id)
    notify.success('outings.edit.deleted')
  } catch (error) {
    notify.error(error)
  } finally {
    await load()
  }
}
```

In the template, replace `<OutingList :outings="outings" />` with:

```vue
              <OutingList
                :outings="outings"
                :can-edit="!merged"
                :can-delete="session.isAdmin"
                @edit="editingOuting = $event"
                @remove="removeOuting"
              />
```

replace `<StayHistory :stays="stays" />` with:

```vue
              <StayHistory
                :stays="stays"
                :can-edit="!merged"
                :can-delete="session.isAdmin"
                :reopenable-id="reopenableId"
                @edit="editingStay = $event"
                @remove="removeStay"
                @reopen="reopenStay"
              />
```

and add these two dialogs just before the closing `</template>` of the `v-else` block (after the closing `</div>` of `.row`). They stay mounted while the record is shown and open when their prop is set:

```vue
      <StayEditDialog :stay="editingStay" :saving="savingCorrection" @save="saveStay" @cancel="editingStay = null" />
      <OutingEditDialog
        :outing="editingOuting"
        :saving="savingCorrection"
        @save="saveOuting"
        @cancel="editingOuting = null"
      />
```

Inside the existing `stays` object in `web/src/i18n/locales/es-MX.json`, add `"actions": "Acciones"` to `history`, and add:

```json
"edit": {
  "action": "Editar",
  "title": "Editar estancia",
  "saved": "Estancia actualizada.",
  "delete": "Eliminar",
  "deleteTitle": "Eliminar estancia",
  "deleteMessage": "Se eliminará esta estancia con todas sus salidas. Úsalo solo para corregir un registro hecho por error.",
  "deleteConfirm": "Eliminar",
  "deleted": "Estancia eliminada."
},
"reopen": {
  "action": "Reabrir estancia",
  "title": "Reabrir estancia",
  "message": "Se quitará la fecha de egreso y la persona volverá a aparecer en el albergue. Úsalo cuando el egreso se registró por error.",
  "confirm": "Reabrir",
  "done": "Estancia reabierta."
}
```

Inside the existing `outings` object, add `"actions": "Acciones"` to `list`, and add:

```json
"edit": {
  "action": "Editar",
  "title": "Corregir salida",
  "leftAt": "Salió",
  "returnedAt": "Regresó",
  "returnedHelp": "Déjalo vacío si la persona no ha regresado.",
  "comment": "Comentario",
  "saved": "Salida corregida.",
  "delete": "Eliminar",
  "deleteTitle": "Eliminar salida",
  "deleteMessage": "Se eliminará esta salida. Úsalo solo para corregir un registro hecho por error.",
  "deleteConfirm": "Eliminar",
  "deleted": "Salida eliminada."
},
"validation": {
  "future": "La hora no puede ser posterior a este momento.",
  "returnBeforeLeave": "El regreso debe ser después de la salida."
}
```

- [ ] **Step 10: Run the tests to verify they pass**

Run: `npm --prefix web run test -- tests/views/PersonView.test.ts tests/views/PersonView.corrections.test.ts`

Expected: PASS.

Run: `npm --prefix web run test:integration -- tests/integration/corrections.test.ts`

Expected: PASS.

- [ ] **Step 11: Run the whole suite, the type check and the linter**

Run: `npm run web:test`, then `npm run web:typecheck`, then `npm run web:lint`

Expected: all pass.

- [ ] **Step 12: Commit**

```bash
git add web/src/lib/dates.ts web/src/api/stays.ts web/src/api/outings.ts web/src/components/forms/DateTimeField.vue web/src/components/outings web/src/components/stays web/src/views/PersonView.vue web/src/i18n/locales/es-MX.json web/tests
git commit -m "feat(web): correct, reopen and delete stays and outings from the person record"
```

---
### Task 8: Photos: capture, resize, upload and retry

**Files:**
- Create: `web/src/lib/imageResize.ts`, `web/src/composables/usePendingPhotos.ts`, `web/src/components/people/PhotoCapture.vue`, `web/src/components/people/PersonPhoto.vue`
- Modify: `web/src/api/photos.ts`, `web/src/views/PersonNewView.vue`, `web/src/views/PersonView.vue`
- Modify: `web/src/i18n/locales/es-MX.json`
- Create tests: `web/tests/lib/imageResize.test.ts`, `web/tests/components/people/PhotoCapture.test.ts`, `web/tests/components/people/PersonPhoto.test.ts`, `web/tests/views/PersonNewView.photo.test.ts`, `web/tests/integration/photos.test.ts`

**Interfaces:**
- Consumes: `photoPathFor`, `thumbPathFor`, `getSignedPhotoUrls` (Task 1), `getPerson` (Task 6), `PersonNewView` (Task 5), `PersonView` (Task 7).
- Produces:
  - In `lib/imageResize.ts`: `PhotoPair { full: Blob; thumb: Blob }`, `FULL_SIZE = 800`, `THUMB_SIZE = 160`, `fitWithin(width, height, max)`, `resizeToJpeg(source, max, quality?)`, `makePhotoPair(source): Promise<PhotoPair>`.
  - `uploadPersonPhoto(personId, full, thumb): Promise<string>` in `api/photos.ts` (uploads both objects with upsert, then sets `people.photo_path`).
  - `usePendingPhotos(): { get(personId), set(personId, photo), clear(personId) }`, kept in memory only.
  - `PhotoCapture` (prop `idPrefix = 'photo'`; emits `captured(photo: PhotoPair)`; file input id `<idPrefix>-file`).
  - `PersonPhoto` (props `personId`, `photoPath`, `name`, `readonly?`; emits `updated()`).

- [ ] **Step 1: Write the failing tests**

Create `web/tests/lib/imageResize.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fitWithin, makePhotoPair } from '@/lib/imageResize'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('fitWithin', () => {
  it('scales the longest side down to the limit', () => {
    expect(fitWithin(1600, 1200, 800)).toEqual({ width: 800, height: 600 })
    expect(fitWithin(1200, 1600, 160)).toEqual({ width: 120, height: 160 })
  })

  it('never enlarges a small image', () => {
    expect(fitWithin(300, 200, 800)).toEqual({ width: 300, height: 200 })
  })
})

describe('makePhotoPair', () => {
  it('produces an 800 px photo and a 160 px thumbnail, both JPEG', async () => {
    const close = vi.fn()
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 1200, height: 1600, close })))
    const drawImage = vi.fn()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
      this: HTMLCanvasElement,
      callback: BlobCallback,
      type?: string,
    ) {
      callback(new Blob([`${this.width}x${this.height}`], { type }))
    })

    const pair = await makePhotoPair(new Blob(['photo'], { type: 'image/png' }))

    expect(pair.full.type).toBe('image/jpeg')
    expect(await pair.full.text()).toBe('600x800')
    expect(await pair.thumb.text()).toBe('120x160')
    expect(close).toHaveBeenCalledTimes(2)
  })
})
```

Create `web/tests/components/people/PhotoCapture.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PhotoCapture from '@/components/people/PhotoCapture.vue'
import { makePhotoPair } from '@/lib/imageResize'
import { mountWithApp } from '../../utils/mountWithApp'

vi.mock('@/lib/imageResize', () => ({ makePhotoPair: vi.fn() }))

const pair = {
  full: new Blob(['full'], { type: 'image/jpeg' }),
  thumb: new Blob(['thumb'], { type: 'image/jpeg' }),
}

function setMediaDevices(value: unknown): void {
  Object.defineProperty(navigator, 'mediaDevices', { value, configurable: true, writable: true })
}

async function chooseFile(wrapper: Awaited<ReturnType<typeof mountWithApp>>['wrapper'], file: File) {
  const input = wrapper.find('input[type="file"]')
  Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
  await input.trigger('change')
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  setMediaDevices(undefined)
  document.body.innerHTML = ''
})

describe('PhotoCapture', () => {
  it('turns a chosen file into a photo and a thumbnail', async () => {
    vi.mocked(makePhotoPair).mockResolvedValue(pair)
    const { wrapper } = await mountWithApp(PhotoCapture)
    const file = new File(['raw'], 'foto.png', { type: 'image/png' })
    await chooseFile(wrapper, file)
    await vi.waitFor(() => expect(wrapper.emitted('captured')).toEqual([[pair]]))
    expect(makePhotoPair).toHaveBeenCalledWith(file)
  })

  it('offers only the file option when the browser has no camera API', async () => {
    setMediaDevices(undefined)
    const { wrapper } = await mountWithApp(PhotoCapture)
    const labels = wrapper.findAll('button').map((button) => button.text())
    expect(labels).not.toContain('Usar cámara')
    expect(wrapper.find('label').text()).toBe('Elegir archivo o tomar con el teléfono')
  })

  it('explains a refused camera and keeps the file option', async () => {
    setMediaDevices({ getUserMedia: vi.fn(async () => Promise.reject(new DOMException('denied', 'NotAllowedError'))) })
    const { wrapper } = await mountWithApp(PhotoCapture)
    const camera = wrapper.findAll('button').find((button) => button.text() === 'Usar cámara')
    await camera?.trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('No se pudo usar la cámara.'))
    expect(wrapper.find('input[type="file"]').exists()).toBe(true)
  })

  it('reports an image it cannot read', async () => {
    vi.mocked(makePhotoPair).mockRejectedValue(new Error('decode'))
    const { wrapper } = await mountWithApp(PhotoCapture)
    await chooseFile(wrapper, new File(['raw'], 'roto.heic', { type: 'image/heic' }))
    await vi.waitFor(() => expect(wrapper.text()).toContain('No se pudo leer la imagen.'))
    expect(wrapper.emitted('captured')).toBeUndefined()
  })
})
```

Create `web/tests/components/people/PersonPhoto.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getSignedPhotoUrls, uploadPersonPhoto } from '@/api/photos'
import PersonPhoto from '@/components/people/PersonPhoto.vue'
import PhotoCapture from '@/components/people/PhotoCapture.vue'
import { usePendingPhotos } from '@/composables/usePendingPhotos'
import { uuid } from '../../fixtures/data'
import { mountWithApp } from '../../utils/mountWithApp'

const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('@/composables/useNotify', () => ({ useNotify: () => notify }))
vi.mock('@/lib/imageResize', () => ({ makePhotoPair: vi.fn() }))
vi.mock('@/api/photos', () => ({
  photoPathFor: (id: string) => `${id}.jpg`,
  thumbPathFor: (path: string) => path.replace(/\.jpg$/, '_thumb.jpg'),
  getSignedPhotoUrls: vi.fn(),
  uploadPersonPhoto: vi.fn(),
}))

const pair = {
  full: new Blob(['full'], { type: 'image/jpeg' }),
  thumb: new Blob(['thumb'], { type: 'image/jpeg' }),
}

function mountPhoto(props: Record<string, unknown> = {}) {
  return mountWithApp(PersonPhoto, {
    props: { personId: uuid(1), photoPath: null, name: 'Rosa Pérez', ...props },
  })
}

function buttonLabeled(wrapper: Awaited<ReturnType<typeof mountPhoto>>['wrapper'], label: string) {
  const found = wrapper.findAll('button').find((button) => button.text() === label)
  if (!found) throw new Error(`No ${label} button`)
  return found
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getSignedPhotoUrls).mockResolvedValue({ [`${uuid(1)}.jpg`]: 'https://storage.test/rosa.jpg' })
})

afterEach(() => {
  usePendingPhotos().clear(uuid(1))
  document.body.innerHTML = ''
})

describe('PersonPhoto', () => {
  it('shows the photo through a signed URL', async () => {
    const { wrapper } = await mountPhoto({ photoPath: `${uuid(1)}.jpg` })
    await vi.waitFor(() => expect(wrapper.find('img').attributes('src')).toBe('https://storage.test/rosa.jpg'))
    expect(getSignedPhotoUrls).toHaveBeenCalledWith([`${uuid(1)}.jpg`])
    expect(wrapper.find('img').attributes('alt')).toBe('Foto de Rosa Pérez')
  })

  it('uploads a new photo and tells the record to reload', async () => {
    vi.mocked(uploadPersonPhoto).mockResolvedValue(`${uuid(1)}.jpg`)
    const { wrapper } = await mountPhoto()
    expect(wrapper.text()).toContain('Sin foto')
    await buttonLabeled(wrapper, 'Agregar foto').trigger('click')
    wrapper.findComponent(PhotoCapture).vm.$emit('captured', pair)
    await vi.waitFor(() => expect(uploadPersonPhoto).toHaveBeenCalledWith(uuid(1), pair.full, pair.thumb))
    await vi.waitFor(() => expect(wrapper.emitted('updated')).toHaveLength(1))
    expect(notify.success).toHaveBeenCalledWith('photos.saved')
  })

  it('keeps a failed photo and retries it with Reintentar foto', async () => {
    vi.mocked(uploadPersonPhoto).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(`${uuid(1)}.jpg`)
    const { wrapper } = await mountPhoto()
    await buttonLabeled(wrapper, 'Agregar foto').trigger('click')
    wrapper.findComponent(PhotoCapture).vm.$emit('captured', pair)
    await vi.waitFor(() => expect(wrapper.find('[data-testid="photo-pending"]').exists()).toBe(true))
    await buttonLabeled(wrapper, 'Reintentar foto').trigger('click')
    await vi.waitFor(() => expect(uploadPersonPhoto).toHaveBeenCalledTimes(2))
    expect(vi.mocked(uploadPersonPhoto).mock.calls[1]).toEqual([uuid(1), pair.full, pair.thumb])
    await vi.waitFor(() => expect(wrapper.find('[data-testid="photo-pending"]').exists()).toBe(false))
  })

  it('offers the retry for a photo that failed during registration', async () => {
    usePendingPhotos().set(uuid(1), pair)
    const { wrapper } = await mountPhoto()
    expect(wrapper.find('[data-testid="photo-pending"]').text()).toContain('La foto no se pudo guardar.')
  })

  it('offers no changes on a merged record', async () => {
    const { wrapper } = await mountPhoto({ readonly: true })
    expect(wrapper.findAll('button')).toHaveLength(0)
  })
})
```

Create `web/tests/views/PersonNewView.photo.test.ts`:

```ts
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { registerAndCheckIn } from '@/api/people'
import { uploadPersonPhoto } from '@/api/photos'
import { usePendingPhotos } from '@/composables/usePendingPhotos'
import { makePhotoPair } from '@/lib/imageResize'
import PersonNewView from '@/views/PersonNewView.vue'
import { uuid } from '../fixtures/data'
import { mountWithApp } from '../utils/mountWithApp'

const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('@/composables/useNotify', () => ({ useNotify: () => notify }))
vi.mock('@/composables/useConfirm', () => ({ useConfirm: () => ({ confirm: vi.fn() }) }))
vi.mock('@/lib/imageResize', () => ({ makePhotoPair: vi.fn() }))
vi.mock('@/api/people', () => ({ registerAndCheckIn: vi.fn(), findPossibleDuplicates: vi.fn(async () => []) }))
vi.mock('@/api/stays', () => ({ listCurrentResidents: vi.fn(async () => []) }))
vi.mock('@/api/photos', () => ({
  photoPathFor: (id: string) => `${id}.jpg`,
  thumbPathFor: (path: string) => path.replace(/\.jpg$/, '_thumb.jpg'),
  getSignedPhotoUrls: vi.fn(async () => ({})),
  uploadPersonPhoto: vi.fn(),
}))

const pair = {
  full: new Blob(['full'], { type: 'image/jpeg' }),
  thumb: new Blob(['thumb'], { type: 'image/jpeg' }),
}
const originalCreate = URL.createObjectURL
const originalRevoke = URL.revokeObjectURL

beforeAll(() => {
  // jsdom has no object URLs; the preview only needs a string.
  URL.createObjectURL = vi.fn(() => 'blob:preview')
  URL.revokeObjectURL = vi.fn()
})

afterAll(() => {
  URL.createObjectURL = originalCreate
  URL.revokeObjectURL = originalRevoke
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(makePhotoPair).mockResolvedValue(pair)
  vi.mocked(registerAndCheckIn).mockResolvedValue({ person_id: uuid(1), stay_id: uuid(101) })
  usePendingPhotos().clear(uuid(1))
})

afterEach(() => {
  document.body.innerHTML = ''
})

async function registerWithPhoto() {
  const result = await mountWithApp(PersonNewView, { initialRoute: '/people/new' })
  const input = result.wrapper.find('#registration-photo-file')
  Object.defineProperty(input.element, 'files', {
    value: [new File(['raw'], 'foto.png', { type: 'image/png' })],
    configurable: true,
  })
  await input.trigger('change')
  await vi.waitFor(() => expect(result.wrapper.find('[data-testid="photo-ready"]').exists()).toBe(true))
  await result.wrapper.find('#person-first-name').setValue('Rosa Elena')
  await result.wrapper.find('form.registration-form').trigger('submit')
  await vi.waitFor(() => expect(result.router.currentRoute.value.name).toBe('person'))
  return result
}

describe('PersonNewView photo', () => {
  it('uploads the photo after registering, then opens the record', async () => {
    vi.mocked(uploadPersonPhoto).mockResolvedValue(`${uuid(1)}.jpg`)
    await registerWithPhoto()
    expect(uploadPersonPhoto).toHaveBeenCalledWith(uuid(1), pair.full, pair.thumb)
    expect(usePendingPhotos().get(uuid(1))).toBeNull()
  })

  it('still opens the record when the upload fails and keeps the photo for a retry', async () => {
    vi.mocked(uploadPersonPhoto).mockRejectedValue(new Error('offline'))
    const { router } = await registerWithPhoto()
    expect(router.currentRoute.value.params.id).toBe(uuid(1))
    expect(usePendingPhotos().get(uuid(1))).toEqual(pair)
  })
})
```

Create `web/tests/integration/photos.test.ts`:

```ts
import { beforeAll, describe, expect, it } from 'vitest'
import { getPerson } from '@/api/people'
import { getSignedPhotoUrls, thumbPathFor, uploadPersonPhoto } from '@/api/photos'
import { createPerson } from './factories'
import { signInAs } from './helpers'

function jpeg(content: string): Blob {
  return new Blob([content], { type: 'image/jpeg' })
}

describe('photos', () => {
  beforeAll(async () => {
    await signInAs('volunteer')
  })

  it('uploads both sizes, links the photo and serves it through signed URLs', async () => {
    const personId = await createPerson()
    const path = await uploadPersonPhoto(personId, jpeg('full'), jpeg('thumb'))
    expect(path).toBe(`${personId}.jpg`)
    expect((await getPerson(personId)).photo_path).toBe(path)

    const missing = '00000000-0000-4000-8000-00000000beef.jpg'
    const urls = await getSignedPhotoUrls([path, thumbPathFor(path), missing])
    expect(Object.keys(urls).sort()).toEqual([path, thumbPathFor(path)].sort())
    const response = await fetch(urls[thumbPathFor(path)] ?? '')
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('thumb')
  })

  it('replaces an existing photo', async () => {
    const personId = await createPerson()
    await uploadPersonPhoto(personId, jpeg('old'), jpeg('old thumb'))
    const path = await uploadPersonPhoto(personId, jpeg('new'), jpeg('new thumb'))
    const urls = await getSignedPhotoUrls([path])
    const response = await fetch(urls[path] ?? '')
    expect(await response.text()).toBe('new')
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm --prefix web run test -- tests/lib/imageResize.test.ts tests/components/people/PhotoCapture.test.ts tests/components/people/PersonPhoto.test.ts tests/views/PersonNewView.photo.test.ts`

Expected: FAIL, because the resize helper, the components and the photo step do not exist yet.

Run: `npm run db:reset`, then `npm --prefix web run test:integration -- tests/integration/photos.test.ts`

Expected: FAIL, because `uploadPersonPhoto` is not exported yet.

- [ ] **Step 3: Implement resizing, the upload and the pending store**

Create `web/src/lib/imageResize.ts`:

```ts
// Photos are resized in the browser before upload: about 800 px for the record
// and about 160 px for lists. Both are JPEG, well under the 2 MB bucket limit.

export interface PhotoPair {
  full: Blob
  thumb: Blob
}

export const FULL_SIZE = 800
export const THUMB_SIZE = 160
const JPEG_QUALITY = 0.85

export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

export async function resizeToJpeg(source: Blob, max: number, quality = JPEG_QUALITY): Promise<Blob> {
  // 'from-image' applies the phone's EXIF rotation so portraits stay upright.
  const bitmap = await createImageBitmap(source, { imageOrientation: 'from-image' })
  try {
    const size = fitWithin(bitmap.width, bitmap.height, max)
    const canvas = document.createElement('canvas')
    canvas.width = size.width
    canvas.height = size.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('canvas_unavailable')
    context.drawImage(bitmap, 0, 0, size.width, size.height)
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('jpeg_encode_failed'))),
        'image/jpeg',
        quality,
      )
    })
  } finally {
    bitmap.close()
  }
}

export async function makePhotoPair(source: Blob): Promise<PhotoPair> {
  const [full, thumb] = await Promise.all([resizeToJpeg(source, FULL_SIZE), resizeToJpeg(source, THUMB_SIZE)])
  return { full, thumb }
}
```

In `web/src/api/photos.ts`, change `import { toApiError } from './errors'` to `import { ApiError, toApiError } from './errors'` and append:

```ts
/**
 * Uploads the photo and its thumbnail (replacing any previous ones), then links
 * the photo to the person. photo_path is set last, so a path always has its thumbnail.
 */
export async function uploadPersonPhoto(personId: string, full: Blob, thumb: Blob): Promise<string> {
  const path = photoPathFor(personId)
  const bucket = supabase.storage.from(BUCKET)
  const objects: Array<[string, Blob]> = [
    [path, full],
    [thumbPathFor(path), thumb],
  ]
  for (const [objectPath, content] of objects) {
    const { error } = await bucket.upload(objectPath, content, { upsert: true, contentType: 'image/jpeg' })
    if (error) throw toApiError(error)
  }
  const { data, error } = await supabase.from('people').update({ photo_path: path }).eq('id', personId).select('id')
  if (error) throw toApiError(error)
  if (!data || data.length === 0) throw new ApiError('not_found')
  return path
}
```

Create `web/src/composables/usePendingPhotos.ts`:

```ts
import { shallowReactive } from 'vue'
import type { PhotoPair } from '@/lib/imageResize'

// Photos whose upload failed, kept only in memory (never stored) so the
// person record can offer "Reintentar foto" with the same picture.
const pending = shallowReactive(new Map<string, PhotoPair>())

export function usePendingPhotos() {
  return {
    get: (personId: string): PhotoPair | null => pending.get(personId) ?? null,
    set: (personId: string, photo: PhotoPair): void => {
      pending.set(personId, photo)
    },
    clear: (personId: string): void => {
      pending.delete(personId)
    },
  }
}
```

- [ ] **Step 4: Implement the capture and photo components**

Create `web/src/components/people/PhotoCapture.vue`:

```vue
<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { makePhotoPair, type PhotoPair } from '@/lib/imageResize'

withDefaults(defineProps<{ idPrefix?: string }>(), { idPrefix: 'photo' })
const emit = defineEmits<{ captured: [photo: PhotoPair] }>()

const { t } = useI18n()
// Desktops use the webcam; phones use the file input, which opens the camera directly.
const canUseCamera =
  typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function'
const video = ref<HTMLVideoElement | null>(null)
const stream = ref<MediaStream | null>(null)
const problem = ref<string | null>(null)
const busy = ref(false)

function stopCamera(): void {
  stream.value?.getTracks().forEach((track) => track.stop())
  stream.value = null
}

async function startCamera(): Promise<void> {
  problem.value = null
  try {
    stream.value = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
    await nextTick()
    if (video.value) {
      video.value.srcObject = stream.value
      await video.value.play()
    }
  } catch {
    stopCamera()
    problem.value = 'photos.cameraUnavailable'
  }
}

async function process(source: Blob): Promise<void> {
  busy.value = true
  problem.value = null
  try {
    emit('captured', await makePhotoPair(source))
  } catch {
    problem.value = 'photos.processFailed'
  } finally {
    busy.value = false
  }
}

async function takeSnapshot(): Promise<void> {
  const element = video.value
  if (!element || !element.videoWidth) return
  const canvas = document.createElement('canvas')
  canvas.width = element.videoWidth
  canvas.height = element.videoHeight
  canvas.getContext('2d')?.drawImage(element, 0, 0)
  const frame = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92))
  stopCamera()
  if (frame) await process(frame)
}

async function onFileChosen(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) await process(file)
}

onBeforeUnmount(stopCamera)
</script>

<template>
  <div>
    <video v-if="stream" ref="video" class="w-100 rounded mb-2 bg-dark" autoplay playsinline muted />
    <div class="d-flex flex-wrap gap-2">
      <button
        v-if="canUseCamera && !stream"
        type="button"
        class="btn btn-outline-primary"
        :disabled="busy"
        @click="startCamera"
      >
        {{ t('photos.useCamera') }}
      </button>
      <template v-if="stream">
        <button type="button" class="btn btn-primary" :disabled="busy" @click="takeSnapshot">
          {{ t('photos.takePhoto') }}
        </button>
        <button type="button" class="btn btn-outline-secondary" @click="stopCamera">
          {{ t('photos.closeCamera') }}
        </button>
      </template>
      <label class="btn btn-outline-primary mb-0" :for="`${idPrefix}-file`">{{ t('photos.chooseFile') }}</label>
      <input
        :id="`${idPrefix}-file`"
        type="file"
        accept="image/*"
        capture="environment"
        class="visually-hidden"
        :disabled="busy"
        @change="onFileChosen"
      />
    </div>
    <p v-if="busy" class="small text-body-secondary mt-2 mb-0">{{ t('photos.processing') }}</p>
    <p v-if="problem" class="small text-danger mt-2 mb-0" role="alert">{{ t(problem) }}</p>
  </div>
</template>
```

Create `web/src/components/people/PersonPhoto.vue`:

```vue
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { getSignedPhotoUrls, uploadPersonPhoto } from '@/api/photos'
import PhotoCapture from '@/components/people/PhotoCapture.vue'
import { useNotify } from '@/composables/useNotify'
import { usePendingPhotos } from '@/composables/usePendingPhotos'
import type { PhotoPair } from '@/lib/imageResize'

const props = withDefaults(
  defineProps<{ personId: string; photoPath: string | null; name: string; readonly?: boolean }>(),
  { readonly: false },
)
const emit = defineEmits<{ updated: [] }>()

const { t } = useI18n()
const notify = useNotify()
const pendingPhotos = usePendingPhotos()

const url = ref<string | null>(null)
const capturing = ref(false)
const uploading = ref(false)
const pending = computed(() => pendingPhotos.get(props.personId))

watch(
  () => props.photoPath,
  async (path) => {
    url.value = null
    if (!path) return
    try {
      url.value = (await getSignedPhotoUrls([path]))[path] ?? null
    } catch {
      url.value = null
    }
  },
  { immediate: true },
)

async function upload(photo: PhotoPair): Promise<void> {
  if (uploading.value) return
  uploading.value = true
  try {
    await uploadPersonPhoto(props.personId, photo.full, photo.thumb)
    pendingPhotos.clear(props.personId)
    capturing.value = false
    notify.success('photos.saved')
    emit('updated')
  } catch (error) {
    pendingPhotos.set(props.personId, photo)
    notify.error(error)
  } finally {
    uploading.value = false
  }
}

async function retry(): Promise<void> {
  if (pending.value) await upload(pending.value)
}
</script>

<template>
  <section class="card mb-4">
    <div class="card-body text-center">
      <img v-if="url" :src="url" :alt="t('photos.thumbAlt', { name })" class="img-fluid rounded mb-3 person-photo" />
      <div v-else class="text-body-secondary border rounded py-4 mb-3">{{ t('photos.none') }}</div>
      <div v-if="pending" class="alert alert-warning text-start" role="alert" data-testid="photo-pending">
        <p class="mb-2">{{ t('photos.uploadFailed') }}</p>
        <button v-if="!readonly" type="button" class="btn btn-sm btn-warning" :disabled="uploading" @click="retry">
          {{ t('photos.retry') }}
        </button>
      </div>
      <template v-if="!readonly">
        <PhotoCapture v-if="capturing" id-prefix="record-photo" @captured="upload" />
        <button v-else type="button" class="btn btn-sm btn-outline-primary" @click="capturing = true">
          {{ photoPath ? t('photos.change') : t('photos.add') }}
        </button>
      </template>
    </div>
  </section>
</template>

<style scoped>
.person-photo {
  max-height: 18rem;
  object-fit: cover;
}
</style>
```

- [ ] **Step 5: Add the photo step to registration and the photo to the record**

In `web/src/views/PersonNewView.vue`:
- change `import { computed, ref } from 'vue'` to `import { computed, onBeforeUnmount, ref, shallowRef } from 'vue'`;
- add these imports:

```ts
import { uploadPersonPhoto } from '@/api/photos'
import PhotoCapture from '@/components/people/PhotoCapture.vue'
import { usePendingPhotos } from '@/composables/usePendingPhotos'
import type { PhotoPair } from '@/lib/imageResize'
```

- add after `const saving = ref(false)`:

```ts
const pendingPhotos = usePendingPhotos()
const photo = shallowRef<PhotoPair | null>(null)
const preview = ref<string | null>(null)

function setPhoto(next: PhotoPair | null): void {
  if (preview.value) URL.revokeObjectURL(preview.value)
  photo.value = next
  preview.value = next ? URL.createObjectURL(next.thumb) : null
}

onBeforeUnmount(() => setPhoto(null))
```

- in `save()`, replace the line `notify.success('registration.saved')` with:

```ts
    notify.success('registration.saved')
    if (photo.value) {
      try {
        await uploadPersonPhoto(person_id, photo.value.full, photo.value.thumb)
      } catch {
        // The person is registered. Their record offers "Reintentar foto" with this picture.
        pendingPhotos.set(person_id, photo.value)
      }
    }
```

- in the template, insert this card between the stay card and the error summary paragraph:

```vue
          <section class="card mb-4">
            <div class="card-body">
              <h2 class="h5 card-title">{{ t('photos.title') }}</h2>
              <div v-if="preview" class="d-flex align-items-center gap-3">
                <img
                  :src="preview"
                  :alt="t('photos.previewAlt')"
                  width="96"
                  height="96"
                  class="rounded object-fit-cover"
                />
                <div>
                  <p class="mb-2" data-testid="photo-ready">{{ t('photos.ready') }}</p>
                  <button type="button" class="btn btn-sm btn-outline-secondary" @click="setPhoto(null)">
                    {{ t('photos.remove') }}
                  </button>
                </div>
              </div>
              <PhotoCapture v-else id-prefix="registration-photo" @captured="setPhoto" />
            </div>
          </section>
```

In `web/src/views/PersonView.vue`, add `import PersonPhoto from '@/components/people/PersonPhoto.vue'` and insert this as the first element inside `<div class="col-lg-4">`:

```vue
          <PersonPhoto
            :person-id="person.id"
            :photo-path="person.photo_path"
            :name="name"
            :readonly="merged"
            @updated="load"
          />
```

Inside the existing `photos` object in `web/src/i18n/locales/es-MX.json`, add:

```json
"title": "Foto",
"previewAlt": "Vista previa de la foto",
"useCamera": "Usar cámara",
"takePhoto": "Tomar foto",
"closeCamera": "Cerrar cámara",
"chooseFile": "Elegir archivo o tomar con el teléfono",
"processing": "Preparando la foto...",
"cameraUnavailable": "No se pudo usar la cámara. Revisa el permiso del navegador o elige un archivo.",
"processFailed": "No se pudo leer la imagen. Prueba con otra foto.",
"ready": "Foto lista. Se guardará al registrar.",
"remove": "Quitar foto",
"none": "Sin foto",
"add": "Agregar foto",
"change": "Cambiar foto",
"saved": "Foto guardada.",
"uploadFailed": "La foto no se pudo guardar. La persona sí quedó registrada.",
"retry": "Reintentar foto"
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm --prefix web run test -- tests/lib/imageResize.test.ts tests/components/people tests/views`

Expected: PASS.

Run: `npm --prefix web run test:integration -- tests/integration/photos.test.ts`

Expected: PASS.

- [ ] **Step 7: Run the whole suite, the type check and the linter**

Run: `npm run web:test`, then `npm run web:typecheck`, then `npm run web:lint`

Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add web/src/lib/imageResize.ts web/src/api/photos.ts web/src/composables/usePendingPhotos.ts web/src/components/people/PhotoCapture.vue web/src/components/people/PersonPhoto.vue web/src/views/PersonNewView.vue web/src/views/PersonView.vue web/src/i18n/locales/es-MX.json web/tests
git commit -m "feat(web): capture, resize and upload person photos with retry"
```

---

### Task 9: People search

**Files:**
- Modify: `web/src/api/people.ts`
- Replace: `web/src/views/PeopleSearchView.vue`
- Modify: `web/src/i18n/locales/es-MX.json`
- Create tests: `web/tests/views/PeopleSearchView.test.ts`, `web/tests/integration/search.test.ts`, `web/tests/integration/roles.test.ts`

**Interfaces:**
- Consumes: `PersonSearchResult` (Task 5), `useThumbnails`, `PersonThumb`, `normalizeForSearch`, `useShelterTime().formatDate`, `formatAge`, `ageOn`.
- Produces: `searchPeople(query: string, limit = 50): Promise<PersonSearchResult[]>` in `api/people.ts`; `PeopleSearchView` with form `form.people-search-form`, input `#people-search-query`, rows `[data-testid="search-result"]`.

- [ ] **Step 1: Write the failing tests**

Create `web/tests/views/PeopleSearchView.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type PersonSearchResult, searchPeople } from '@/api/people'
import { getSignedPhotoUrls } from '@/api/photos'
import PeopleSearchView from '@/views/PeopleSearchView.vue'
import { uuid } from '../fixtures/data'
import { mountWithApp } from '../utils/mountWithApp'

const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('@/composables/useNotify', () => ({ useNotify: () => notify }))
vi.mock('@/api/people', () => ({ searchPeople: vi.fn() }))
vi.mock('@/api/photos', () => ({
  photoPathFor: (id: string) => `${id}.jpg`,
  thumbPathFor: (path: string) => path.replace(/\.jpg$/, '_thumb.jpg'),
  getSignedPhotoUrls: vi.fn(async () => ({})),
  uploadPersonPhoto: vi.fn(),
}))

function result(overrides: Partial<PersonSearchResult>): PersonSearchResult {
  return {
    person_id: uuid(1),
    first_name: 'Rosa Elena',
    last_name: 'Pérez Lara',
    birth_date: '1996-04-12',
    birth_date_estimated: false,
    country_code: 'HN',
    photo_path: null,
    score: 0.9,
    last_entry_date: '2026-08-01',
    last_exit_date: '2026-08-15',
    has_open_stay: false,
    ...overrides,
  }
}

async function mountView() {
  return mountWithApp(PeopleSearchView, { initialRoute: '/people/search', session: { role: 'legal' } })
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('PeopleSearchView', () => {
  it('asks for at least two letters before searching', async () => {
    const { wrapper } = await mountView()
    await wrapper.find('#people-search-query').setValue(' é ')
    await wrapper.find('form.people-search-form').trigger('submit')
    expect(searchPeople).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Escribe al menos 2 letras para buscar.')
  })

  it('lists matches with a link to each record, staying status and last stay', async () => {
    vi.mocked(searchPeople).mockResolvedValue([
      result({ photo_path: `${uuid(1)}.jpg` }),
      result({
        person_id: uuid(2),
        first_name: 'Tomás',
        last_name: 'Gutiérrez',
        has_open_stay: true,
        last_exit_date: null,
      }),
    ])
    const { wrapper } = await mountView()
    await wrapper.find('#people-search-query').setValue('  perez ')
    await wrapper.find('form.people-search-form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.findAll('[data-testid="search-result"]')).toHaveLength(2))
    expect(searchPeople).toHaveBeenCalledWith('perez')
    const [rosa, tomas] = wrapper.findAll('[data-testid="search-result"]')
    expect(rosa?.find('a').attributes('href')).toBe(`/people/${uuid(1)}`)
    expect(rosa?.text()).toContain('Honduras')
    expect(rosa?.text()).toContain('01/08/2026 a 15/08/2026')
    expect(tomas?.text()).toContain('En el albergue')
    expect(getSignedPhotoUrls).toHaveBeenCalledWith([`${uuid(1)}_thumb.jpg`], 600)
  })

  it('says when nobody matches', async () => {
    vi.mocked(searchPeople).mockResolvedValue([])
    const { wrapper } = await mountView()
    await wrapper.find('#people-search-query').setValue('zzzz')
    await wrapper.find('form.people-search-form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.text()).toContain('No encontramos a nadie con ese nombre.'))
  })

  it('never puts the searched name in the URL', async () => {
    vi.mocked(searchPeople).mockResolvedValue([result({})])
    const { wrapper, router } = await mountView()
    await wrapper.find('#people-search-query').setValue('Rosa Elena')
    await wrapper.find('form.people-search-form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.findAll('[data-testid="search-result"]')).toHaveLength(1))
    expect(router.currentRoute.value.fullPath).toBe('/people/search')
  })
})
```

Create `web/tests/integration/search.test.ts`:

```ts
import { beforeAll, describe, expect, it } from 'vitest'
import { searchPeople } from '@/api/people'
import { createPerson, createStay } from './factories'
import { signInAs, uniqueSuffix } from './helpers'

describe('people search', () => {
  beforeAll(async () => {
    await signInAs('psychology')
  })

  it('finds people ignoring accents and reports an open stay', async () => {
    const surname = `Ñúñez${uniqueSuffix()}`
    const personId = await createPerson({ first_name: 'Itzel', last_name: surname })
    await createStay(personId)
    const found = await searchPeople(surname.replace('Ñúñez', 'nunez'))
    expect(found.find((row) => row.person_id === personId)?.has_open_stay).toBe(true)
  })

  it('returns nothing for one letter', async () => {
    await expect(searchPeople('a')).resolves.toEqual([])
  })
})
```

Create `web/tests/integration/roles.test.ts` (spec section 12: the daily functions work for every seeded role; RLS per role is covered in depth by the pgTAP tests):

```ts
import { describe, expect, it } from 'vitest'
import { endOuting, startOuting } from '@/api/outings'
import { findPossibleDuplicates, searchPeople } from '@/api/people'
import { listCurrentResidents } from '@/api/stays'
import type { AppRole } from '@/types/domain'
import { createResident } from './factories'
import { signInAs, uniqueSuffix } from './helpers'

const ROLES: AppRole[] = ['admin', 'legal', 'psychology', 'volunteer']

describe('daily operations for every role', () => {
  it.each(ROLES)('works for %s', async (role) => {
    await signInAs(role)
    const surname = `Roles ${uniqueSuffix()}`
    const { personId, stayId } = await createResident({ first_name: 'Prueba', last_name: surname })
    expect((await listCurrentResidents()).some((resident) => resident.stay_id === stayId)).toBe(true)
    expect((await searchPeople(surname)).map((row) => row.person_id)).toContain(personId)
    const duplicates = await findPossibleDuplicates({ first_name: 'Prueba', last_name: surname })
    expect(duplicates.map((row) => row.person_id)).toContain(personId)
    await expect(startOuting(stayId)).resolves.toEqual(expect.any(String))
    await expect(endOuting(stayId)).resolves.toEqual(expect.any(String))
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm --prefix web run test -- tests/views/PeopleSearchView.test.ts`

Expected: FAIL, because the view is still the Plan 2 placeholder.

Run: `npm run db:reset`, then `npm --prefix web run test:integration -- tests/integration/search.test.ts tests/integration/roles.test.ts`

Expected: FAIL, because `searchPeople` is not exported yet.

- [ ] **Step 3: Implement the search**

Append to `web/src/api/people.ts`:

```ts
/** Searches the whole history, best matches first. Merged records are never returned. */
export async function searchPeople(query: string, limit = 50): Promise<PersonSearchResult[]> {
  const { data, error } = await supabase.rpc('search_people', { p_query: query, p_limit: limit })
  if (error) throw toApiError(error)
  return (data ?? []) as PersonSearchResult[]
}
```

Replace `web/src/views/PeopleSearchView.vue` with:

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { type PersonSearchResult, searchPeople } from '@/api/people'
import PageHeader from '@/components/common/PageHeader.vue'
import PersonThumb from '@/components/people/PersonThumb.vue'
import { useNotify } from '@/composables/useNotify'
import { useShelterTime } from '@/composables/useShelterTime'
import { useThumbnails } from '@/composables/useThumbnails'
import { formatAge, fullName, normalizeForSearch } from '@/lib/people'
import { ageOn } from '@/lib/shelterTime'
import { useCatalogsStore } from '@/stores/catalogs'

const { t } = useI18n()
const notify = useNotify()
const { formatDate, today } = useShelterTime()
const catalogs = useCatalogsStore()
const thumbs = useThumbnails()

// The search text stays in this component. Names never go into the URL.
const query = ref('')
const results = ref<PersonSearchResult[] | null>(null)
const searching = ref(false)
const tooShort = ref(false)

async function search(): Promise<void> {
  tooShort.value = normalizeForSearch(query.value).length < 2
  if (tooShort.value) {
    results.value = null
    return
  }
  if (searching.value) return
  searching.value = true
  try {
    results.value = await searchPeople(query.value.trim())
    await thumbs.load(results.value.map((row) => row.photo_path))
  } catch (error) {
    notify.error(error)
  } finally {
    searching.value = false
  }
}

function ageLabel(row: PersonSearchResult): string {
  return formatAge(ageOn(row.birth_date, today()), row.birth_date_estimated)
}

function lastStay(row: PersonSearchResult): string {
  if (!row.last_entry_date) return t('search.noStays')
  return t('search.lastStay', {
    from: formatDate(row.last_entry_date),
    to: formatDate(row.last_exit_date),
  })
}
</script>

<template>
  <div>
    <PageHeader title-key="nav.search">
      <template #actions>
        <RouterLink class="btn btn-outline-primary" :to="{ name: 'person-new' }">{{ t('nav.newPerson') }}</RouterLink>
      </template>
    </PageHeader>
    <form class="people-search-form mb-4" role="search" @submit.prevent="search">
      <label for="people-search-query" class="form-label">{{ t('search.label') }}</label>
      <div class="input-group search-box">
        <input
          id="people-search-query"
          v-model="query"
          type="search"
          class="form-control"
          :placeholder="t('search.placeholder')"
          autocomplete="off"
        />
        <button type="submit" class="btn btn-primary" :disabled="searching">{{ t('search.submit') }}</button>
      </div>
      <p v-if="tooShort" class="form-text text-danger">{{ t('search.tooShort') }}</p>
    </form>

    <p v-if="results && results.length === 0" class="text-body-secondary">{{ t('search.noResults') }}</p>
    <div v-else-if="results" class="table-responsive">
      <table class="table align-middle">
        <thead>
          <tr>
            <th scope="col"><span class="visually-hidden">{{ t('search.columns.photo') }}</span></th>
            <th scope="col">{{ t('search.columns.name') }}</th>
            <th scope="col">{{ t('search.columns.age') }}</th>
            <th scope="col">{{ t('search.columns.country') }}</th>
            <th scope="col">{{ t('search.columns.lastStay') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in results" :key="row.person_id" data-testid="search-result">
            <td>
              <PersonThumb :url="thumbs.thumbUrl(row.photo_path)" :name="fullName(row.first_name, row.last_name)" />
            </td>
            <td>
              <RouterLink :to="{ name: 'person', params: { id: row.person_id } }">{{
                fullName(row.first_name, row.last_name)
              }}</RouterLink>
            </td>
            <td>{{ ageLabel(row) }}</td>
            <td>{{ catalogs.label('countries', row.country_code) }}</td>
            <td>
              <span v-if="row.has_open_stay" class="badge text-bg-success">{{ t('search.staying') }}</span>
              <span v-else>{{ lastStay(row) }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.search-box {
  max-width: 32rem;
}
</style>
```

Add this top-level key to `web/src/i18n/locales/es-MX.json`:

```json
{
  "search": {
    "label": "Nombre o apellido",
    "placeholder": "Escribe al menos 2 letras",
    "submit": "Buscar",
    "tooShort": "Escribe al menos 2 letras para buscar.",
    "noResults": "No encontramos a nadie con ese nombre.",
    "columns": {
      "photo": "Foto",
      "name": "Nombre",
      "age": "Edad",
      "country": "País",
      "lastStay": "Última estancia"
    },
    "staying": "En el albergue",
    "lastStay": "{from} a {to}",
    "noStays": "Sin estancias"
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm --prefix web run test -- tests/views/PeopleSearchView.test.ts`

Expected: PASS.

Run: `npm --prefix web run test:integration -- tests/integration/search.test.ts tests/integration/roles.test.ts`

Expected: PASS.

- [ ] **Step 5: Run the whole suite, the type check and the linter**

Run: `npm run web:test`, then `npm run web:typecheck`, then `npm run web:lint`

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add web/src/api/people.ts web/src/views/PeopleSearchView.vue web/src/i18n/locales/es-MX.json web/tests/views/PeopleSearchView.test.ts web/tests/integration/search.test.ts web/tests/integration/roles.test.ts
git commit -m "feat(web): search people across the whole history"
```

---
### Task 10: Admin users (allowlist)

**Files:**
- Create: `web/src/api/users.ts`
- Replace: `web/src/views/admin/UsersView.vue`
- Modify: `web/src/i18n/locales/es-MX.json`
- Create tests: `web/tests/views/admin/UsersView.test.ts`, `web/tests/integration/users.test.ts`

**Interfaces:**
- Consumes: `updateVersioned`, `cleanText`, `useSessionStore().appUser`, `useConfirm`, `hasErrors`, `AppUser`, `AppRole`, `fakeAppUser` (tests), `uniqueSuffix` (integration).
- Produces:
  - In `api/users.ts`: `listAppUsers(): Promise<AppUser[]>`, `inviteUser(input: { email: string; role: AppRole; display_name: string }): Promise<AppUser>`, `updateAppUser(email, expectedUpdatedAt, patch: Partial<Pick<AppUser, 'role' | 'display_name' | 'active'>>): Promise<AppUser>`.
  - Role labels `admin.users.roles.<role>`, reused by the audit log (Task 12).
  - `UsersView`: invite form `form.invite-form` (`#invite-email`, `#invite-name`, `#invite-role`), rows `[data-testid="user-row"]` with a `select.role-select`.

- [ ] **Step 1: Write the failing tests**

Create `web/tests/views/admin/UsersView.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { inviteUser, listAppUsers, updateAppUser } from '@/api/users'
import UsersView from '@/views/admin/UsersView.vue'
import { uuid } from '../../fixtures/data'
import { fakeAppUser, mountWithApp } from '../../utils/mountWithApp'

const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
const confirm = vi.hoisted(() => vi.fn())
vi.mock('@/composables/useNotify', () => ({ useNotify: () => notify }))
vi.mock('@/composables/useConfirm', () => ({ useConfirm: () => ({ confirm }) }))
vi.mock('@/api/users', () => ({ listAppUsers: vi.fn(), inviteUser: vi.fn(), updateAppUser: vi.fn() }))

// mountWithApp signs in fakeAppUser('admin'), so this row is the signed-in admin.
const me = fakeAppUser('admin')
const volunteer = fakeAppUser('volunteer', {
  email: 'turno@example.test',
  display_name: 'Cuenta de turno',
  user_id: uuid(302),
})
const invited = fakeAppUser('legal', { email: 'nueva@example.test', display_name: 'Abogada Nueva', user_id: null })

type Wrapper = Awaited<ReturnType<typeof mountWithApp>>['wrapper']

async function mountView(): Promise<Wrapper> {
  const { wrapper } = await mountWithApp(UsersView, { initialRoute: '/admin/users', session: { role: 'admin' } })
  await vi.waitFor(() => expect(wrapper.findAll('[data-testid="user-row"]')).toHaveLength(3))
  return wrapper
}

function rowOf(wrapper: Wrapper, email: string) {
  const row = wrapper.findAll('[data-testid="user-row"]').find((candidate) => candidate.text().includes(email))
  if (!row) throw new Error(`No row for ${email}`)
  return row
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(listAppUsers).mockResolvedValue([me, volunteer, invited])
  confirm.mockResolvedValue(true)
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('UsersView', () => {
  it('lists users with role, status and whether they have signed in yet', async () => {
    const wrapper = await mountView()
    expect(rowOf(wrapper, 'turno@example.test').text()).toContain('Activo')
    expect(rowOf(wrapper, 'nueva@example.test').text()).toContain('Aún no entra')
    expect((rowOf(wrapper, 'nueva@example.test').find('select.role-select').element as HTMLSelectElement).value).toBe(
      'legal',
    )
  })

  it('invites a person and reloads the list', async () => {
    vi.mocked(inviteUser).mockResolvedValue(fakeAppUser('psychology', { email: 'psico@example.test' }))
    const wrapper = await mountView()
    await wrapper.find('#invite-email').setValue('psico@example.test')
    await wrapper.find('#invite-name').setValue('Psicóloga Prueba')
    await wrapper.find('#invite-role').setValue('psychology')
    await wrapper.find('form.invite-form').trigger('submit')
    await vi.waitFor(() =>
      expect(inviteUser).toHaveBeenCalledWith({
        email: 'psico@example.test',
        display_name: 'Psicóloga Prueba',
        role: 'psychology',
      }),
    )
    expect(notify.success).toHaveBeenCalledWith('admin.users.invite.done')
    await vi.waitFor(() => expect(listAppUsers).toHaveBeenCalledTimes(2))
    expect((wrapper.find('#invite-email').element as HTMLInputElement).value).toBe('')
  })

  it('checks the email and name before inviting', async () => {
    const wrapper = await mountView()
    await wrapper.find('#invite-email').setValue('sin-arroba')
    await wrapper.find('form.invite-form').trigger('submit')
    expect(inviteUser).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Escribe un correo válido.')
    expect(wrapper.text()).toContain('Este dato es obligatorio.')
  })

  it('changes a role with the version that was loaded', async () => {
    vi.mocked(updateAppUser).mockResolvedValue({ ...volunteer, role: 'legal' })
    const wrapper = await mountView()
    await rowOf(wrapper, 'turno@example.test').find('select.role-select').setValue('legal')
    await vi.waitFor(() =>
      expect(updateAppUser).toHaveBeenCalledWith('turno@example.test', volunteer.updated_at, { role: 'legal' }),
    )
    expect(notify.success).toHaveBeenCalledWith('admin.users.updated')
  })

  it('asks before deactivating someone', async () => {
    vi.mocked(updateAppUser).mockResolvedValue({ ...volunteer, active: false })
    const wrapper = await mountView()
    const button = rowOf(wrapper, 'turno@example.test')
      .findAll('button')
      .find((candidate) => candidate.text() === 'Desactivar')
    await button?.trigger('click')
    await vi.waitFor(() =>
      expect(updateAppUser).toHaveBeenCalledWith('turno@example.test', volunteer.updated_at, { active: false }),
    )
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({ messageKey: 'admin.users.deactivateMessage', messageParams: { name: 'Cuenta de turno' } }),
    )
  })

  it('does not let admins change or deactivate their own account', async () => {
    const wrapper = await mountView()
    const own = rowOf(wrapper, me.email)
    expect(own.find('select.role-select').attributes('disabled')).toBeDefined()
    expect(own.findAll('button').every((candidate) => candidate.attributes('disabled') !== undefined)).toBe(true)
    expect(own.text()).toContain('Tu cuenta')
  })
})
```

Create `web/tests/integration/users.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { inviteUser, listAppUsers, updateAppUser } from '@/api/users'
import { signInAs, uniqueSuffix } from './helpers'

describe('users allowlist', () => {
  it('lets an admin invite, change the role and deactivate', async () => {
    await signInAs('admin')
    const email = `invitada-${uniqueSuffix()}@example.test`
    const invited = await inviteUser({
      email: `  ${email.toUpperCase()} `,
      role: 'volunteer',
      display_name: ' Invitada Prueba ',
    })
    expect(invited).toMatchObject({ email, role: 'volunteer', display_name: 'Invitada Prueba', active: true, user_id: null })

    const promoted = await updateAppUser(email, invited.updated_at, { role: 'legal' })
    expect(promoted.role).toBe('legal')
    await expect(updateAppUser(email, invited.updated_at, { active: false })).rejects.toMatchObject({
      code: 'stale_record',
    })
    const deactivated = await updateAppUser(email, promoted.updated_at, { active: false })
    expect(deactivated.active).toBe(false)
    expect((await listAppUsers()).some((user) => user.email === email)).toBe(true)
  })

  it('rejects inviting the same email twice', async () => {
    await signInAs('admin')
    const email = `doble-${uniqueSuffix()}@example.test`
    await inviteUser({ email, role: 'volunteer', display_name: 'Doble' })
    await expect(inviteUser({ email, role: 'volunteer', display_name: 'Doble' })).rejects.toMatchObject({
      code: 'validation',
    })
  })

  it('shows a volunteer only their own row and refuses invitations', async () => {
    await signInAs('volunteer')
    expect((await listAppUsers()).map((user) => user.email)).toEqual(['volunteer@shelterbridge.test'])
    await expect(
      inviteUser({ email: `x-${uniqueSuffix()}@example.test`, role: 'admin', display_name: 'X' }),
    ).rejects.toMatchObject({ code: 'not_authorized' })
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm --prefix web run test -- tests/views/admin/UsersView.test.ts`

Expected: FAIL, because `@/api/users` does not exist and the view is a placeholder.

Run: `npm run db:reset`, then `npm --prefix web run test:integration -- tests/integration/users.test.ts`

Expected: FAIL, because `@/api/users` does not exist.

- [ ] **Step 3: Implement the API and the view**

Create `web/src/api/users.ts`:

```ts
import { cleanText } from '@/lib/text'
import type { AppRole, AppUser } from '@/types/domain'
import { supabase } from './client'
import { toApiError } from './errors'
import { updateVersioned } from './rows'

/** Admins see everyone; any other role sees only their own row. */
export async function listAppUsers(): Promise<AppUser[]> {
  const { data, error } = await supabase.from('app_users').select('*').order('display_name')
  if (error) throw toApiError(error)
  return data ?? []
}

/** Adds an email to the allowlist. The person can then sign up or sign in with Google. */
export async function inviteUser(input: { email: string; role: AppRole; display_name: string }): Promise<AppUser> {
  const { data, error } = await supabase
    .from('app_users')
    .insert({
      email: input.email.trim().toLowerCase(),
      role: input.role,
      display_name: cleanText(input.display_name) ?? '',
    })
    .select('*')
    .single()
  if (error) throw toApiError(error)
  return data
}

export async function updateAppUser(
  email: string,
  expectedUpdatedAt: string,
  patch: Partial<Pick<AppUser, 'role' | 'display_name' | 'active'>>,
): Promise<AppUser> {
  return updateVersioned('app_users', { column: 'email', value: email }, expectedUpdatedAt, patch)
}
```

Replace `web/src/views/admin/UsersView.vue` with:

```vue
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { inviteUser, listAppUsers, updateAppUser } from '@/api/users'
import PageHeader from '@/components/common/PageHeader.vue'
import { type FieldErrors, hasErrors } from '@/components/forms/fieldErrors'
import { useConfirm } from '@/composables/useConfirm'
import { useNotify } from '@/composables/useNotify'
import { cleanText } from '@/lib/text'
import { useSessionStore } from '@/stores/session'
import type { AppRole, AppUser } from '@/types/domain'

const ROLES: AppRole[] = ['volunteer', 'legal', 'psychology', 'admin']
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const { t } = useI18n()
const notify = useNotify()
const { confirm } = useConfirm()
const session = useSessionStore()

const users = ref<AppUser[]>([])
const busyEmail = ref<string | null>(null)
const invite = ref<{ email: string; display_name: string; role: AppRole }>({
  email: '',
  display_name: '',
  role: 'volunteer',
})
const inviteErrors = ref<FieldErrors>({})
const inviting = ref(false)
// Admins cannot change or deactivate their own account, so nobody locks themselves out.
const myEmail = computed(() => session.appUser?.email ?? null)

async function load(): Promise<void> {
  try {
    users.value = await listAppUsers()
  } catch (error) {
    notify.error(error)
  }
}

onMounted(load)

async function submitInvite(): Promise<void> {
  if (inviting.value) return
  const errors: FieldErrors = {}
  if (!EMAIL.test(invite.value.email.trim())) errors.email = 'validation.email'
  if (!cleanText(invite.value.display_name)) errors.display_name = 'validation.required'
  inviteErrors.value = errors
  if (hasErrors(errors)) return
  inviting.value = true
  try {
    await inviteUser({ ...invite.value })
    notify.success('admin.users.invite.done')
    invite.value = { email: '', display_name: '', role: 'volunteer' }
    await load()
  } catch (error) {
    notify.error(error)
  } finally {
    inviting.value = false
  }
}

async function update(user: AppUser, patch: Partial<Pick<AppUser, 'role' | 'active'>>): Promise<void> {
  busyEmail.value = user.email
  try {
    await updateAppUser(user.email, user.updated_at, patch)
    notify.success('admin.users.updated')
  } catch (error) {
    notify.error(error)
  } finally {
    busyEmail.value = null
    await load()
  }
}

async function onRoleChange(user: AppUser, event: Event): Promise<void> {
  const role = (event.target as HTMLSelectElement).value as AppRole
  if (role !== user.role) await update(user, { role })
}

async function toggleActive(user: AppUser): Promise<void> {
  if (user.active) {
    const approved = await confirm({
      titleKey: 'admin.users.deactivateTitle',
      messageKey: 'admin.users.deactivateMessage',
      messageParams: { name: user.display_name },
      confirmKey: 'admin.users.deactivate',
      danger: true,
    })
    if (!approved) return
  }
  await update(user, { active: !user.active })
}
</script>

<template>
  <div>
    <PageHeader title-key="nav.users" />
    <p class="text-body-secondary">{{ t('admin.users.intro') }}</p>

    <section class="card mb-4">
      <div class="card-body">
        <h2 class="h5 card-title">{{ t('admin.users.invite.title') }}</h2>
        <form class="invite-form row g-3 align-items-start" novalidate @submit.prevent="submitInvite">
          <div class="col-md-4">
            <label for="invite-email" class="form-label">{{ t('admin.users.invite.email') }}</label>
            <input
              id="invite-email"
              v-model="invite.email"
              type="email"
              class="form-control"
              :class="{ 'is-invalid': inviteErrors.email }"
              autocomplete="off"
            />
            <div v-if="inviteErrors.email" class="invalid-feedback">{{ t(inviteErrors.email) }}</div>
          </div>
          <div class="col-md-4">
            <label for="invite-name" class="form-label">{{ t('admin.users.invite.displayName') }}</label>
            <input
              id="invite-name"
              v-model="invite.display_name"
              type="text"
              class="form-control"
              :class="{ 'is-invalid': inviteErrors.display_name }"
              autocomplete="off"
            />
            <div v-if="inviteErrors.display_name" class="invalid-feedback">{{ t(inviteErrors.display_name) }}</div>
          </div>
          <div class="col-md-2">
            <label for="invite-role" class="form-label">{{ t('admin.users.invite.role') }}</label>
            <select id="invite-role" v-model="invite.role" class="form-select">
              <option v-for="role in ROLES" :key="role" :value="role">{{ t(`admin.users.roles.${role}`) }}</option>
            </select>
          </div>
          <div class="col-md-2 d-flex align-items-end">
            <button type="submit" class="btn btn-primary w-100 mt-md-4" :disabled="inviting">
              {{ t('admin.users.invite.submit') }}
            </button>
          </div>
        </form>
      </div>
    </section>

    <div class="table-responsive">
      <table class="table align-middle">
        <thead>
          <tr>
            <th scope="col">{{ t('admin.users.columns.name') }}</th>
            <th scope="col">{{ t('admin.users.columns.email') }}</th>
            <th scope="col">{{ t('admin.users.columns.role') }}</th>
            <th scope="col">{{ t('admin.users.columns.status') }}</th>
            <th scope="col">{{ t('admin.users.columns.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user.email" data-testid="user-row">
            <td>
              {{ user.display_name }}
              <span v-if="user.email === myEmail" class="badge text-bg-info ms-1">{{ t('admin.users.self') }}</span>
            </td>
            <td class="text-break">{{ user.email }}</td>
            <td>
              <select
                class="form-select form-select-sm role-select"
                :value="user.role"
                :aria-label="t('admin.users.columns.role')"
                :disabled="user.email === myEmail || busyEmail === user.email"
                @change="onRoleChange(user, $event)"
              >
                <option v-for="role in ROLES" :key="role" :value="role">{{ t(`admin.users.roles.${role}`) }}</option>
              </select>
            </td>
            <td>
              <span class="badge" :class="user.active ? 'text-bg-success' : 'text-bg-secondary'">{{
                user.active ? t('admin.users.active') : t('admin.users.inactive')
              }}</span>
              <span v-if="!user.user_id" class="badge text-bg-light ms-1">{{ t('admin.users.pending') }}</span>
            </td>
            <td>
              <button
                type="button"
                class="btn btn-sm"
                :class="user.active ? 'btn-outline-danger' : 'btn-outline-success'"
                :disabled="user.email === myEmail || busyEmail === user.email"
                @click="toggleActive(user)"
              >
                {{ user.active ? t('admin.users.deactivate') : t('admin.users.activate') }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
```

Add this top-level key to `web/src/i18n/locales/es-MX.json` (later admin tasks add sibling keys inside `admin`):

```json
{
  "admin": {
    "users": {
      "intro": "Solo las personas invitadas aquí pueden entrar a ShelterBridge.",
      "invite": {
        "title": "Invitar a una persona",
        "email": "Correo electrónico",
        "displayName": "Nombre",
        "role": "Rol",
        "submit": "Invitar",
        "done": "Invitación guardada. Ya puede crear su cuenta o entrar con Google."
      },
      "columns": {
        "name": "Nombre",
        "email": "Correo",
        "role": "Rol",
        "status": "Estado",
        "actions": "Acciones"
      },
      "roles": {
        "admin": "Administración",
        "legal": "Legal",
        "psychology": "Psicología",
        "volunteer": "Voluntariado"
      },
      "active": "Activo",
      "inactive": "Inactivo",
      "pending": "Aún no entra",
      "self": "Tu cuenta",
      "activate": "Activar",
      "deactivate": "Desactivar",
      "deactivateTitle": "Desactivar usuario",
      "deactivateMessage": "{name} ya no podrá ver ni cambiar datos. ¿Continuar?",
      "updated": "Usuario actualizado."
    }
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm --prefix web run test -- tests/views/admin/UsersView.test.ts`

Expected: PASS.

Run: `npm --prefix web run test:integration -- tests/integration/users.test.ts`

Expected: PASS.

- [ ] **Step 5: Run the whole suite, the type check and the linter**

Run: `npm run web:test`, then `npm run web:typecheck`, then `npm run web:lint`

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add web/src/api/users.ts web/src/views/admin/UsersView.vue web/src/i18n/locales/es-MX.json web/tests/views/admin/UsersView.test.ts web/tests/integration/users.test.ts
git commit -m "feat(web): manage the user allowlist, roles and activation"
```

---

### Task 11: Admin catalogs editor

**Files:**
- Modify: `web/src/api/catalogs.ts`
- Create: `web/src/components/admin/catalogItemModel.ts`, `web/src/components/admin/CatalogItemDialog.vue`
- Replace: `web/src/views/admin/CatalogsView.vue`
- Modify: `web/src/i18n/locales/es-MX.json`
- Create tests: `web/tests/components/admin/catalogItemModel.test.ts`, `web/tests/views/admin/CatalogsView.test.ts`, `web/tests/integration/catalogs.test.ts`

**Interfaces:**
- Consumes: `listCatalog` (P2), `useCatalogsStore().items` and `reload(name)` (P2), `updateVersioned`, `cleanText`, `hasErrors`, `CatalogItem`, `CatalogName`.
- Produces:
  - In `api/catalogs.ts`: `createCatalogItem(name, item: Omit<CatalogItem, 'updated_at'>): Promise<CatalogItem>` and `updateCatalogItem(name, code, expectedUpdatedAt, patch): Promise<CatalogItem>` (contract signatures).
  - `catalogItemModel.ts`: `CatalogItemForm`, `CatalogItemPayload`, `CODE_PATTERNS`, `emptyCatalogItem()`, `catalogItemToForm(item)`, `validateCatalogItem(catalog, form, isNew)`, `formToPayload(form, previous?)`.
  - `CatalogItemDialog` (props `open`, `catalog`, `item: CatalogItem | null` (null adds a new value), `saving`; emits `save(payload: CatalogItemPayload)`, `cancel`). It stays mounted. Fields `#catalog-code`, `#catalog-label-es`, `#catalog-label-en`, `#catalog-order`, `#catalog-active`; form `form.catalog-item-form`.
  - `CatalogsView` rows `[data-testid="catalog-row"]`.

- [ ] **Step 1: Write the failing tests**

Create `web/tests/components/admin/catalogItemModel.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  catalogItemToForm,
  emptyCatalogItem,
  formToPayload,
  validateCatalogItem,
} from '@/components/admin/catalogItemModel'
import { STAMP } from '../../fixtures/data'

describe('validateCatalogItem', () => {
  it('requires two capital letters for a country code', () => {
    const form = { ...emptyCatalogItem(), code: 'mx', label_es: 'México' }
    expect(validateCatalogItem('countries', form, true)).toEqual({ code: 'admin.catalogs.validation.codeInvalid' })
    expect(validateCatalogItem('countries', { ...form, code: 'MX' }, true)).toEqual({})
  })

  it('requires a lowercase slug for other catalogs', () => {
    const form = { ...emptyCatalogItem(), code: 'Solicitante Asilo', label_es: 'Solicitante de asilo' }
    expect(validateCatalogItem('case_types', form, true)).toEqual({ code: 'admin.catalogs.validation.codeInvalid' })
    expect(validateCatalogItem('case_types', { ...form, code: 'solicitante_asilo' }, true)).toEqual({})
  })

  it('does not check the code when editing, because it cannot change', () => {
    expect(validateCatalogItem('genders', { ...emptyCatalogItem(), code: 'X', label_es: 'Mujer' }, false)).toEqual({})
  })

  it('requires a Spanish label and a whole number order', () => {
    expect(
      validateCatalogItem('genders', { ...emptyCatalogItem(), code: 'otra', label_es: ' ', sort_order: '1.5' }, true),
    ).toEqual({
      label_es: 'validation.required',
      sort_order: 'admin.catalogs.validation.orderInvalid',
    })
  })
})

describe('formToPayload', () => {
  it('trims labels, drops an empty English label and keeps other languages', () => {
    const labels = { es: 'Mujer', en: 'Woman', fr: 'Femme' }
    const item = { code: 'female', labels, sort_order: 1, active: true, updated_at: STAMP }
    const form = { ...catalogItemToForm(item), label_es: ' Mujer ', label_en: ' ' }
    expect(formToPayload(form, labels)).toEqual({
      code: 'female',
      labels: { es: 'Mujer', fr: 'Femme' },
      sort_order: 1,
      active: true,
    })
  })
})
```

Create `web/tests/views/admin/CatalogsView.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCatalogItem, listCatalog, updateCatalogItem } from '@/api/catalogs'
import { ApiError } from '@/api/errors'
import type { CatalogName } from '@/types/domain'
import CatalogsView from '@/views/admin/CatalogsView.vue'
import { STAMP } from '../../fixtures/data'
import { mountWithApp, testCatalogs } from '../../utils/mountWithApp'
import { body } from '../../utils/syncfusion'

const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('@/composables/useNotify', () => ({ useNotify: () => notify }))
vi.mock('@/api/catalogs', () => ({
  listCatalog: vi.fn(),
  createCatalogItem: vi.fn(),
  updateCatalogItem: vi.fn(),
}))

type Wrapper = Awaited<ReturnType<typeof mountWithApp>>['wrapper']

async function mountView(): Promise<Wrapper> {
  const { wrapper } = await mountWithApp(CatalogsView, { initialRoute: '/admin/catalogs', session: { role: 'admin' } })
  return wrapper
}

function buttonLabeled<T extends { text(): string }>(buttons: T[], label: string): T {
  const found = buttons.find((candidate) => candidate.text() === label)
  if (!found) throw new Error(`No ${label} button`)
  return found
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(listCatalog).mockImplementation(async (name: CatalogName) => testCatalogs[name])
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('CatalogsView', () => {
  it('lists the chosen catalog in its display order', async () => {
    const w = await mountView()
    const rows = w.findAll('[data-testid="catalog-row"]')
    expect(rows.map((row) => row.find('td').text())).toEqual(['migrant_in_transit', 'asylum_seeker'])
    await buttonLabeled(w.findAll('button'), 'Países').trigger('click')
    expect(w.findAll('[data-testid="catalog-row"]').map((row) => row.find('td').text())).toEqual(['MX', 'HN', 'GT'])
  })

  it('adds a value and refreshes the pickers', async () => {
    vi.mocked(createCatalogItem).mockResolvedValue({
      code: 'returnee',
      labels: { es: 'Persona retornada' },
      sort_order: 3,
      active: true,
      updated_at: STAMP,
    })
    const w = await mountView()
    await buttonLabeled(w.findAll('button'), 'Agregar').trigger('click')
    await vi.waitFor(() => expect(body().find('#catalog-code').exists()).toBe(true))
    await body().find('#catalog-code').setValue('returnee')
    await body().find('#catalog-label-es').setValue('Persona retornada')
    await body().find('#catalog-order').setValue('3')
    await body().find('form.catalog-item-form').trigger('submit')
    await vi.waitFor(() =>
      expect(createCatalogItem).toHaveBeenCalledWith('case_types', {
        code: 'returnee',
        labels: { es: 'Persona retornada' },
        sort_order: 3,
        active: true,
      }),
    )
    expect(listCatalog).toHaveBeenCalledWith('case_types')
    expect(notify.success).toHaveBeenCalledWith('admin.catalogs.saved')
  })

  it('rejects a malformed code before calling the server', async () => {
    const w = await mountView()
    await buttonLabeled(w.findAll('button'), 'Agregar').trigger('click')
    await vi.waitFor(() => expect(body().find('#catalog-code').exists()).toBe(true))
    await body().find('#catalog-code').setValue('Caso Nuevo')
    await body().find('#catalog-label-es').setValue('Caso nuevo')
    await body().find('form.catalog-item-form').trigger('submit')
    expect(body().text()).toContain('El código no tiene el formato correcto.')
    expect(createCatalogItem).not.toHaveBeenCalled()
  })

  it('closes the dialog and shows the current list when someone else changed the value', async () => {
    vi.mocked(updateCatalogItem).mockRejectedValue(new ApiError('stale_record'))
    const w = await mountView()
    const row = w.findAll('[data-testid="catalog-row"]')[1]
    if (!row) throw new Error('missing row')
    await buttonLabeled(row.findAll('button'), 'Editar').trigger('click')
    await vi.waitFor(() => expect(body().find('form.catalog-item-form').exists()).toBe(true))
    await body().find('form.catalog-item-form').trigger('submit')
    await vi.waitFor(() => expect(notify.error).toHaveBeenCalledWith(expect.objectContaining({ code: 'stale_record' })))
    await vi.waitFor(() => expect(body().find('form.catalog-item-form').exists()).toBe(false))
    expect(listCatalog).toHaveBeenCalledWith('case_types')
  })

  it('edits labels, order and status but never the code', async () => {
    vi.mocked(updateCatalogItem).mockResolvedValue({
      code: 'asylum_seeker',
      labels: { es: 'Persona solicitante de asilo' },
      sort_order: 2,
      active: false,
      updated_at: STAMP,
    })
    const asylum = testCatalogs.case_types.find((item) => item.code === 'asylum_seeker')
    const w = await mountView()
    const row = w.findAll('[data-testid="catalog-row"]')[1]
    if (!row) throw new Error('missing row')
    await buttonLabeled(row.findAll('button'), 'Editar').trigger('click')
    await vi.waitFor(() => expect(body().find('#catalog-code').exists()).toBe(true))
    expect(body().find('#catalog-code').attributes('readonly')).toBeDefined()
    await body().find('#catalog-label-es').setValue('Persona solicitante de asilo')
    await body().find('#catalog-active').setValue(false)
    await body().find('form.catalog-item-form').trigger('submit')
    await vi.waitFor(() =>
      expect(updateCatalogItem).toHaveBeenCalledWith('case_types', 'asylum_seeker', asylum?.updated_at, {
        labels: { es: 'Persona solicitante de asilo' },
        sort_order: 2,
        active: false,
      }),
    )
  })
})
```

Create `web/tests/integration/catalogs.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createCatalogItem, listCatalog, updateCatalogItem } from '@/api/catalogs'
import { signInAs, uniqueSuffix } from './helpers'

describe('catalog editing', () => {
  it('lets an admin add and edit a value', async () => {
    await signInAs('admin')
    const code = `prueba_${uniqueSuffix()}`
    const created = await createCatalogItem('case_types', {
      code,
      labels: { es: 'Caso de prueba' },
      sort_order: 99,
      active: true,
    })
    expect(created).toMatchObject({ code, labels: { es: 'Caso de prueba' }, active: true })

    const updated = await updateCatalogItem('case_types', code, created.updated_at, {
      labels: { es: 'Caso de prueba editado', en: 'Test case' },
      active: false,
    })
    expect(updated).toMatchObject({ labels: { es: 'Caso de prueba editado', en: 'Test case' }, active: false })
    await expect(updateCatalogItem('case_types', code, created.updated_at, { sort_order: 1 })).rejects.toMatchObject({
      code: 'stale_record',
    })
    expect((await listCatalog('case_types')).some((item) => item.code === code && !item.active)).toBe(true)
  })

  it('rejects a label without Spanish', async () => {
    await signInAs('admin')
    await expect(
      createCatalogItem('genders', { code: `g_${uniqueSuffix()}`, labels: { en: 'Only English' }, sort_order: 0, active: false }),
    ).rejects.toMatchObject({ code: 'validation' })
  })

  it('refuses catalog changes from a volunteer', async () => {
    await signInAs('volunteer')
    await expect(
      createCatalogItem('genders', { code: `g_${uniqueSuffix()}`, labels: { es: 'Intento' }, sort_order: 0, active: false }),
    ).rejects.toMatchObject({ code: 'not_authorized' })
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm --prefix web run test -- tests/components/admin/catalogItemModel.test.ts tests/views/admin/CatalogsView.test.ts`

Expected: FAIL, because the model, the dialog and the real view do not exist yet.

Run: `npm run db:reset`, then `npm --prefix web run test:integration -- tests/integration/catalogs.test.ts`

Expected: FAIL, because `createCatalogItem` is not exported yet.

- [ ] **Step 3: Implement the API functions and the model**

Append to `web/src/api/catalogs.ts`, adding any of these imports the file does not already have (`import type { CatalogItem, CatalogName } from '@/types/domain'`, `import { supabase } from './client'`, `import { toApiError } from './errors'`, `import { updateVersioned } from './rows'`):

```ts
// The three catalog tables share one shape, so 'countries' stands in for all of them in the types.
type CatalogTable = 'countries'

const CATALOG_COLUMNS = 'code, labels, sort_order, active, updated_at'

export async function createCatalogItem(
  name: CatalogName,
  item: Omit<CatalogItem, 'updated_at'>,
): Promise<CatalogItem> {
  const { data, error } = await supabase
    .from(name as CatalogTable)
    .insert(item)
    .select(CATALOG_COLUMNS)
    .single()
  if (error) throw toApiError(error)
  return data as CatalogItem
}

/** Codes never change; only labels, order and status can be edited. */
export async function updateCatalogItem(
  name: CatalogName,
  code: string,
  expectedUpdatedAt: string,
  patch: Partial<Pick<CatalogItem, 'labels' | 'sort_order' | 'active'>>,
): Promise<CatalogItem> {
  const row = await updateVersioned(name as CatalogTable, { column: 'code', value: code }, expectedUpdatedAt, patch)
  return {
    code: row.code,
    labels: row.labels as Record<string, string>,
    sort_order: row.sort_order,
    active: row.active,
    updated_at: row.updated_at,
  }
}
```

Create `web/src/components/admin/catalogItemModel.ts`:

```ts
import type { FieldErrors } from '@/components/forms/fieldErrors'
import { cleanText } from '@/lib/text'
import type { CatalogItem, CatalogName } from '@/types/domain'

export interface CatalogItemForm {
  code: string
  label_es: string
  label_en: string
  sort_order: string
  active: boolean
}

export type CatalogItemPayload = Omit<CatalogItem, 'updated_at'>

/** Mirrors the database checks on catalog codes. */
export const CODE_PATTERNS: Record<CatalogName, RegExp> = {
  countries: /^[A-Z]{2}$/,
  case_types: /^[a-z][a-z0-9_]*$/,
  genders: /^[a-z][a-z0-9_]*$/,
}

export function emptyCatalogItem(): CatalogItemForm {
  return { code: '', label_es: '', label_en: '', sort_order: '0', active: true }
}

export function catalogItemToForm(item: CatalogItem): CatalogItemForm {
  return {
    code: item.code,
    label_es: item.labels.es ?? '',
    label_en: item.labels.en ?? '',
    sort_order: String(item.sort_order),
    active: item.active,
  }
}

export function validateCatalogItem(catalog: CatalogName, form: CatalogItemForm, isNew: boolean): FieldErrors {
  const errors: FieldErrors = {}
  if (isNew && !CODE_PATTERNS[catalog].test(form.code.trim())) errors.code = 'admin.catalogs.validation.codeInvalid'
  if (!cleanText(form.label_es)) errors.label_es = 'validation.required'
  if (!/^-?\d+$/.test(form.sort_order.trim())) errors.sort_order = 'admin.catalogs.validation.orderInvalid'
  return errors
}

/** Keeps labels in other languages, sets Spanish and English, and drops an empty English label. */
export function formToPayload(form: CatalogItemForm, previous: Record<string, string> = {}): CatalogItemPayload {
  const labels: Record<string, string> = { ...previous, es: cleanText(form.label_es) ?? '' }
  const english = cleanText(form.label_en)
  if (english) labels.en = english
  else delete labels.en
  return { code: form.code.trim(), labels, sort_order: Number(form.sort_order.trim()), active: form.active }
}
```

- [ ] **Step 4: Implement the dialog and the view**

Create `web/src/components/admin/CatalogItemDialog.vue`:

```vue
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { type CloseEventArgs, DialogComponent as EjsDialog } from '@syncfusion/ej2-vue-popups'
import {
  type CatalogItemForm,
  type CatalogItemPayload,
  catalogItemToForm,
  emptyCatalogItem,
  formToPayload,
  validateCatalogItem,
} from '@/components/admin/catalogItemModel'
import { type FieldErrors, hasErrors } from '@/components/forms/fieldErrors'
import type { CatalogItem, CatalogName } from '@/types/domain'

const props = defineProps<{ open: boolean; catalog: CatalogName; item: CatalogItem | null; saving: boolean }>()
const emit = defineEmits<{ save: [payload: CatalogItemPayload]; cancel: [] }>()

const { t } = useI18n()
const form = ref<CatalogItemForm>(emptyCatalogItem())
const errors = ref<FieldErrors>({})
const isNew = computed(() => props.item === null)

// The dialog stays mounted; each opening loads the chosen value, or a blank one.
watch(
  () => [props.open, props.item] as const,
  ([open, item]) => {
    if (!open) return
    form.value = item ? catalogItemToForm(item) : emptyCatalogItem()
    errors.value = {}
  },
  { immediate: true },
)

const title = computed(() =>
  isNew.value
    ? t('admin.catalogs.dialog.newTitle', { catalog: t(`admin.catalogs.names.${props.catalog}`) })
    : t('admin.catalogs.dialog.editTitle'),
)
const codeHelp = computed(() =>
  props.catalog === 'countries' ? t('admin.catalogs.dialog.codeHelpCountries') : t('admin.catalogs.dialog.codeHelpSlug'),
)

function submit(): void {
  errors.value = validateCatalogItem(props.catalog, form.value, isNew.value)
  if (hasErrors(errors.value)) return
  emit('save', formToPayload(form.value, props.item?.labels ?? {}))
}

function onClose(args: CloseEventArgs): void {
  if (args.isInteracted) emit('cancel')
}
</script>

<template>
  <ejs-dialog
    :visible="open"
    :is-modal="true"
    :show-close-icon="true"
    :close-on-escape="true"
    :animation-settings="{ effect: 'None' }"
    :header="title"
    width="min(32rem, 95vw)"
    @close="onClose"
  >
    <form v-if="open" class="catalog-item-form" novalidate @submit.prevent="submit">
      <div class="mb-3">
        <label for="catalog-code" class="form-label">{{ t('admin.catalogs.dialog.code') }}</label>
        <input
          id="catalog-code"
          v-model="form.code"
          type="text"
          class="form-control"
          :class="{ 'is-invalid': errors.code }"
          :readonly="!isNew"
          autocomplete="off"
        />
        <div class="form-text">{{ codeHelp }}</div>
        <div v-if="errors.code" class="invalid-feedback d-block">{{ t(errors.code) }}</div>
      </div>
      <div class="mb-3">
        <label for="catalog-label-es" class="form-label">{{ t('admin.catalogs.dialog.labelEs') }}</label>
        <input
          id="catalog-label-es"
          v-model="form.label_es"
          type="text"
          class="form-control"
          :class="{ 'is-invalid': errors.label_es }"
          autocomplete="off"
        />
        <div v-if="errors.label_es" class="invalid-feedback">{{ t(errors.label_es) }}</div>
      </div>
      <div class="mb-3">
        <label for="catalog-label-en" class="form-label">{{ t('admin.catalogs.dialog.labelEn') }}</label>
        <input id="catalog-label-en" v-model="form.label_en" type="text" class="form-control" autocomplete="off" />
      </div>
      <div class="mb-3">
        <label for="catalog-order" class="form-label">{{ t('admin.catalogs.dialog.order') }}</label>
        <input
          id="catalog-order"
          v-model="form.sort_order"
          type="text"
          inputmode="numeric"
          class="form-control"
          :class="{ 'is-invalid': errors.sort_order }"
        />
        <div v-if="errors.sort_order" class="invalid-feedback">{{ t(errors.sort_order) }}</div>
      </div>
      <div class="form-check mb-3">
        <input id="catalog-active" v-model="form.active" class="form-check-input" type="checkbox" />
        <label for="catalog-active" class="form-check-label">{{ t('admin.catalogs.dialog.active') }}</label>
      </div>
      <div class="d-flex justify-content-end gap-2">
        <button type="button" class="btn btn-outline-secondary" @click="emit('cancel')">
          {{ t('common.cancel') }}
        </button>
        <button type="submit" class="btn btn-primary" :disabled="saving">{{ t('common.save') }}</button>
      </div>
    </form>
  </ejs-dialog>
</template>
```

Replace `web/src/views/admin/CatalogsView.vue` with:

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { createCatalogItem, updateCatalogItem } from '@/api/catalogs'
import { isApiError } from '@/api/errors'
import CatalogItemDialog from '@/components/admin/CatalogItemDialog.vue'
import type { CatalogItemPayload } from '@/components/admin/catalogItemModel'
import PageHeader from '@/components/common/PageHeader.vue'
import { useNotify } from '@/composables/useNotify'
import { useCatalogsStore } from '@/stores/catalogs'
import type { CatalogItem, CatalogName } from '@/types/domain'

const NAMES: CatalogName[] = ['case_types', 'genders', 'countries']

const { t } = useI18n()
const notify = useNotify()
const catalogs = useCatalogsStore()

const current = ref<CatalogName>('case_types')
const dialogOpen = ref(false)
const editing = ref<CatalogItem | null>(null)
const saving = ref(false)

const items = computed(() =>
  [...catalogs.items[current.value]].sort(
    (a, b) => a.sort_order - b.sort_order || (a.labels.es ?? '').localeCompare(b.labels.es ?? '', 'es'),
  ),
)

function openNew(): void {
  editing.value = null
  dialogOpen.value = true
}

function openEdit(item: CatalogItem): void {
  editing.value = item
  dialogOpen.value = true
}

async function save(payload: CatalogItemPayload): Promise<void> {
  if (saving.value) return
  saving.value = true
  try {
    if (editing.value) {
      await updateCatalogItem(current.value, editing.value.code, editing.value.updated_at, {
        labels: payload.labels,
        sort_order: payload.sort_order,
        active: payload.active,
      })
    } else {
      await createCatalogItem(current.value, payload)
    }
    dialogOpen.value = false
    notify.success('admin.catalogs.saved')
  } catch (error) {
    notify.error(error)
    // Someone else changed this value: close so the reloaded list shows the current version.
    if (isApiError(error, 'stale_record')) dialogOpen.value = false
  } finally {
    saving.value = false
    // Pickers everywhere read the store, so they see the change immediately.
    await catalogs.reload(current.value)
  }
}
</script>

<template>
  <div>
    <PageHeader title-key="nav.catalogs">
      <template #actions>
        <button type="button" class="btn btn-primary" @click="openNew">{{ t('admin.catalogs.add') }}</button>
      </template>
    </PageHeader>
    <ul class="nav nav-tabs mb-3" role="tablist">
      <li v-for="name in NAMES" :key="name" class="nav-item" role="presentation">
        <button
          type="button"
          class="nav-link"
          :class="{ active: name === current }"
          role="tab"
          :aria-selected="name === current"
          @click="current = name"
        >
          {{ t(`admin.catalogs.names.${name}`) }}
        </button>
      </li>
    </ul>
    <div class="table-responsive">
      <table class="table table-sm align-middle">
        <thead>
          <tr>
            <th scope="col">{{ t('admin.catalogs.columns.code') }}</th>
            <th scope="col">{{ t('admin.catalogs.columns.labelEs') }}</th>
            <th scope="col">{{ t('admin.catalogs.columns.labelEn') }}</th>
            <th scope="col">{{ t('admin.catalogs.columns.order') }}</th>
            <th scope="col">{{ t('admin.catalogs.columns.status') }}</th>
            <th scope="col">{{ t('admin.catalogs.columns.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="item.code" data-testid="catalog-row">
            <td><code>{{ item.code }}</code></td>
            <td>{{ item.labels.es }}</td>
            <td>{{ item.labels.en }}</td>
            <td>{{ item.sort_order }}</td>
            <td>
              <span class="badge" :class="item.active ? 'text-bg-success' : 'text-bg-secondary'">{{
                item.active ? t('admin.catalogs.active') : t('admin.catalogs.inactive')
              }}</span>
            </td>
            <td>
              <button type="button" class="btn btn-sm btn-link" @click="openEdit(item)">
                {{ t('admin.catalogs.edit') }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <CatalogItemDialog
      :open="dialogOpen"
      :catalog="current"
      :item="editing"
      :saving="saving"
      @save="save"
      @cancel="dialogOpen = false"
    />
  </div>
</template>
```

Inside the existing `admin` object in `web/src/i18n/locales/es-MX.json`, add:

```json
"catalogs": {
  "add": "Agregar",
  "edit": "Editar",
  "names": {
    "case_types": "Tipos de caso",
    "genders": "Géneros",
    "countries": "Países"
  },
  "columns": {
    "code": "Código",
    "labelEs": "Nombre en español",
    "labelEn": "Nombre en inglés",
    "order": "Orden",
    "status": "Estado",
    "actions": "Acciones"
  },
  "active": "Activo",
  "inactive": "Inactivo",
  "saved": "Catálogo actualizado.",
  "dialog": {
    "newTitle": "Agregar a {catalog}",
    "editTitle": "Editar valor",
    "code": "Código",
    "codeHelpCountries": "Dos letras mayúsculas del código ISO, por ejemplo MX. No se puede cambiar después.",
    "codeHelpSlug": "Minúsculas, números y guion bajo, por ejemplo solicitante_asilo. No se puede cambiar después.",
    "labelEs": "Nombre en español",
    "labelEn": "Nombre en inglés (opcional)",
    "order": "Orden en las listas",
    "active": "Activo (se muestra al elegir)"
  },
  "validation": {
    "codeInvalid": "El código no tiene el formato correcto.",
    "orderInvalid": "El orden debe ser un número entero."
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm --prefix web run test -- tests/components/admin tests/views/admin/CatalogsView.test.ts`

Expected: PASS.

Run: `npm --prefix web run test:integration -- tests/integration/catalogs.test.ts`

Expected: PASS.

- [ ] **Step 6: Run the whole suite, the type check and the linter**

Run: `npm run web:test`, then `npm run web:typecheck`, then `npm run web:lint`

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add web/src/api/catalogs.ts web/src/components/admin web/src/views/admin/CatalogsView.vue web/src/i18n/locales/es-MX.json web/tests/components/admin web/tests/views/admin/CatalogsView.test.ts web/tests/integration/catalogs.test.ts
git commit -m "feat(web): edit catalogs with immutable codes"
```

---
### Task 12: Admin settings and audit log

**Files:**
- Modify: `web/src/api/settings.ts`
- Create: `web/src/api/audit.ts`, `web/src/components/admin/auditChanges.ts`
- Replace: `web/src/views/admin/SettingsView.vue`, `web/src/views/admin/AuditView.vue`
- Modify: `web/src/i18n/locales/es-MX.json`
- Create tests: `web/tests/components/admin/auditChanges.test.ts`, `web/tests/views/admin/SettingsView.test.ts`, `web/tests/views/admin/AuditView.test.ts`, `web/tests/integration/settings-audit.test.ts`

**Interfaces:**
- Consumes: `getSettings` and `ShelterSettings` (P2), `useSettingsStore()` (`timezone`, `timezoneUpdatedAt`, `load()`), `updateVersioned`, `listAppUsers` (Task 10), `DateField` (Task 3), `addDays` and `startOfDayInstant` (Task 7), `useShelterTime().formatDateTime`, `Json` (`@/types/database`), `AuditEntry`.
- Produces:
  - `updateTimezone(timezone, expectedUpdatedAt): Promise<void>` in `api/settings.ts`.
  - `AuditFilters` (contract shape) and `listAuditLog(filters): Promise<{ rows: AuditEntry[]; total: number }>` in `api/audit.ts`. `from` is an inclusive instant; `to` is an exclusive instant; `limit` defaults to 50 and `offset` to 0.
  - `changedFields(entry): string[]` in `components/admin/auditChanges.ts`.
  - `SettingsView` (form `form.settings-form`, select `#settings-timezone`); `AuditView` (form `form.audit-filters` with `#audit-table`, `#audit-record`, `#audit-user`, `#audit-from`, `#audit-to`; rows `[data-testid="audit-row"]`; page label `[data-testid="audit-page"]`).

- [ ] **Step 1: Write the failing tests**

Create `web/tests/components/admin/auditChanges.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { changedFields } from '@/components/admin/auditChanges'

describe('changedFields', () => {
  it('lists the fields an update changed, ignoring bookkeeping columns', () => {
    expect(
      changedFields({
        action: 'update',
        old_data: { bed: 'A1', notes: null, updated_at: 'x', updated_by: 'a' },
        new_data: { bed: 'B2', notes: null, updated_at: 'y', updated_by: 'b' },
      }),
    ).toEqual(['bed'])
  })

  it('lists the filled fields of an insert or a delete', () => {
    expect(changedFields({ action: 'insert', old_data: null, new_data: { first_name: 'Ana', region: null } })).toEqual([
      'first_name',
    ])
    expect(changedFields({ action: 'delete', old_data: { bed: 'C1' }, new_data: null })).toEqual(['bed'])
  })

  it('shows the ids involved in a merge', () => {
    expect(
      changedFields({ action: 'merge', old_data: null, new_data: { survivor_id: 'a', duplicate_id: 'b' } }),
    ).toEqual(['survivor_id', 'duplicate_id'])
  })
})
```

Create `web/tests/views/admin/SettingsView.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/errors'
import { getSettings, updateTimezone } from '@/api/settings'
import { useSettingsStore } from '@/stores/settings'
import SettingsView from '@/views/admin/SettingsView.vue'
import { mountWithApp } from '../../utils/mountWithApp'

const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('@/composables/useNotify', () => ({ useNotify: () => notify }))
vi.mock('@/api/settings', () => ({ getSettings: vi.fn(), updateTimezone: vi.fn() }))

async function mountView() {
  const { wrapper } = await mountWithApp(SettingsView, { initialRoute: '/admin/settings', session: { role: 'admin' } })
  return wrapper
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getSettings).mockResolvedValue({
    timezone: 'America/Tijuana',
    timezone_updated_at: '2026-10-07T15:00:00+00:00',
  })
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('SettingsView', () => {
  it('shows the current timezone', async () => {
    const wrapper = await mountView()
    expect((wrapper.find('#settings-timezone').element as HTMLSelectElement).value).toBe('America/Mexico_City')
  })

  it('saves a new timezone with the version that was loaded and reloads the settings', async () => {
    vi.mocked(updateTimezone).mockResolvedValue()
    const wrapper = await mountView()
    const loadedVersion = useSettingsStore().timezoneUpdatedAt
    await wrapper.find('#settings-timezone').setValue('America/Tijuana')
    await wrapper.find('form.settings-form').trigger('submit')
    await vi.waitFor(() => expect(updateTimezone).toHaveBeenCalledWith('America/Tijuana', loadedVersion))
    await vi.waitFor(() => expect(getSettings).toHaveBeenCalled())
    expect(notify.success).toHaveBeenCalledWith('admin.settings.saved')
  })

  it('reloads the settings when another admin changed them first', async () => {
    vi.mocked(updateTimezone).mockRejectedValue(new ApiError('stale_record'))
    const wrapper = await mountView()
    await wrapper.find('#settings-timezone').setValue('America/Cancun')
    await wrapper.find('form.settings-form').trigger('submit')
    await vi.waitFor(() =>
      expect(notify.error).toHaveBeenCalledWith(expect.objectContaining({ code: 'stale_record' })),
    )
    await vi.waitFor(() =>
      expect((wrapper.find('#settings-timezone').element as HTMLSelectElement).value).toBe('America/Tijuana'),
    )
  })
})
```

Create `web/tests/views/admin/AuditView.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { listAuditLog } from '@/api/audit'
import { listAppUsers } from '@/api/users'
import AuditView from '@/views/admin/AuditView.vue'
import { makeAuditEntry, uuid } from '../../fixtures/data'
import { fakeAppUser, mountWithApp } from '../../utils/mountWithApp'
import { typeInto } from '../../utils/syncfusion'

const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('@/composables/useNotify', () => ({ useNotify: () => notify }))
vi.mock('@/api/audit', () => ({ listAuditLog: vi.fn() }))
vi.mock('@/api/users', () => ({ listAppUsers: vi.fn() }))

async function mountView() {
  const result = await mountWithApp(AuditView, { initialRoute: '/admin/audit', session: { role: 'admin' } })
  await vi.waitFor(() => expect(result.wrapper.findAll('[data-testid="audit-row"]').length).toBeGreaterThan(0))
  return result.wrapper
}

beforeEach(() => {
  vi.clearAllMocks()
  // makeAuditEntry() is attributed to user uuid(301).
  vi.mocked(listAppUsers).mockResolvedValue([fakeAppUser('volunteer', { user_id: uuid(301), display_name: 'Ana Turno' })])
  vi.mocked(listAuditLog).mockResolvedValue({ rows: [makeAuditEntry()], total: 120 })
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('AuditView', () => {
  it('loads the newest changes with names, roles and what changed', async () => {
    const wrapper = await mountView()
    expect(listAuditLog).toHaveBeenCalledWith({ limit: 50, offset: 0 })
    const row = wrapper.find('[data-testid="audit-row"]')
    expect(row.text()).toContain('06/10/2026 10:00')
    expect(row.text()).toContain('Ana Turno')
    expect(row.text()).toContain('Voluntariado')
    expect(row.text()).toContain('Ana, Luis')
    expect(row.text()).toContain('Personas')
    expect(row.text()).toContain('Cambio')
    expect(row.text()).toContain('last_name')
    expect(wrapper.find('[data-testid="audit-page"]').text()).toBe('Página 1 de 3')
  })

  it('filters by table, record and shelter days', async () => {
    const wrapper = await mountView()
    await wrapper.find('#audit-table').setValue('stays')
    await wrapper.find('#audit-record').setValue(` ${uuid(101)} `)
    await typeInto(wrapper.find('#audit-from'), '01/10/2026')
    await typeInto(wrapper.find('#audit-to'), '07/10/2026')
    await wrapper.find('form.audit-filters').trigger('submit')
    await vi.waitFor(() =>
      expect(listAuditLog).toHaveBeenLastCalledWith({
        table_name: 'stays',
        record_id: uuid(101),
        from: '2026-10-01T06:00:00.000Z',
        to: '2026-10-08T06:00:00.000Z',
        limit: 50,
        offset: 0,
      }),
    )
  })

  it('pages through the results with the same filters', async () => {
    const wrapper = await mountView()
    const next = wrapper.findAll('button').find((button) => button.text() === 'Siguiente')
    await next?.trigger('click')
    await vi.waitFor(() => expect(listAuditLog).toHaveBeenLastCalledWith({ limit: 50, offset: 50 }))
    await vi.waitFor(() => expect(wrapper.find('[data-testid="audit-page"]').text()).toBe('Página 2 de 3'))
  })
})
```

Create `web/tests/integration/settings-audit.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { listAuditLog } from '@/api/audit'
import { getPerson, updatePerson } from '@/api/people'
import { getSettings, updateTimezone } from '@/api/settings'
import { createPerson } from './factories'
import { signInAs } from './helpers'

describe('settings', () => {
  it('saves the timezone with optimistic concurrency', async () => {
    await signInAs('admin')
    const current = await getSettings()
    // Writing the same timezone keeps "today" unchanged for the other test files.
    await expect(updateTimezone(current.timezone, '2000-01-01T00:00:00+00:00')).rejects.toMatchObject({
      code: 'stale_record',
    })
    await expect(updateTimezone(current.timezone, current.timezone_updated_at)).resolves.toBeUndefined()
  })
})

describe('audit log', () => {
  it('lists the changes of one record for an admin, newest first', async () => {
    await signInAs('volunteer')
    const personId = await createPerson()
    const loaded = await getPerson(personId)
    await updatePerson(personId, loaded.updated_at, { region: 'Cortés' })

    await signInAs('admin')
    const { rows, total } = await listAuditLog({ table_name: 'people', record_id: personId })
    expect(total).toBe(2)
    expect(rows.map((row) => row.action)).toEqual(['update', 'insert'])
    expect(rows[0]?.actor_role).toBe('volunteer')
  })

  it('pages and filters by time', async () => {
    await signInAs('admin')
    const page = await listAuditLog({ table_name: 'people', limit: 1, offset: 0 })
    expect(page.rows).toHaveLength(1)
    expect(page.total).toBeGreaterThanOrEqual(1)
    const future = await listAuditLog({ from: '2099-01-01T00:00:00.000Z' })
    expect(future).toEqual({ rows: [], total: 0 })
  })

  it('shows nothing to a volunteer', async () => {
    await signInAs('volunteer')
    await expect(listAuditLog({})).resolves.toEqual({ rows: [], total: 0 })
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm --prefix web run test -- tests/components/admin/auditChanges.test.ts tests/views/admin/SettingsView.test.ts tests/views/admin/AuditView.test.ts`

Expected: FAIL, because `auditChanges`, `@/api/audit` and the real views do not exist yet.

Run: `npm run db:reset`, then `npm --prefix web run test:integration -- tests/integration/settings-audit.test.ts`

Expected: FAIL, because `updateTimezone` and `@/api/audit` do not exist yet.

- [ ] **Step 3: Implement the API functions and the change summary**

Append to `web/src/api/settings.ts`, adding `import { updateVersioned } from './rows'` if the file does not have it:

```ts
/** Saves only if nobody changed the timezone since `expectedUpdatedAt`. */
export async function updateTimezone(timezone: string, expectedUpdatedAt: string): Promise<void> {
  await updateVersioned('settings', { column: 'key', value: 'timezone' }, expectedUpdatedAt, { value: timezone })
}
```

Create `web/src/api/audit.ts`:

```ts
import type { AuditEntry } from '@/types/domain'
import { supabase } from './client'
import { toApiError } from './errors'

export interface AuditFilters {
  table_name?: string
  record_id?: string
  actor_user_id?: string
  /** Inclusive lower bound, an ISO instant. */
  from?: string
  /** Exclusive upper bound, an ISO instant. */
  to?: string
  limit?: number
  offset?: number
}

/** Admin only: other roles get no rows. Newest first. */
export async function listAuditLog(filters: AuditFilters): Promise<{ rows: AuditEntry[]; total: number }> {
  const limit = filters.limit ?? 50
  const offset = filters.offset ?? 0
  let query = supabase.from('audit_log').select('*', { count: 'exact' })
  if (filters.table_name) query = query.eq('table_name', filters.table_name)
  if (filters.record_id) query = query.eq('record_id', filters.record_id)
  if (filters.actor_user_id) query = query.eq('actor_user_id', filters.actor_user_id)
  if (filters.from) query = query.gte('at', filters.from)
  if (filters.to) query = query.lt('at', filters.to)
  const { data, error, count } = await query
    .order('at', { ascending: false })
    .order('id', { ascending: false })
    .range(offset, offset + limit - 1)
  if (error) throw toApiError(error)
  return { rows: data ?? [], total: count ?? 0 }
}
```

Create `web/src/components/admin/auditChanges.ts`:

```ts
import type { Json } from '@/types/database'
import type { AuditEntry } from '@/types/domain'

const IGNORED = new Set(['created_at', 'created_by', 'updated_at', 'updated_by', 'search_name'])

function asObject(value: Json | null): Record<string, Json | undefined> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

/** The fields an audit entry is about, for a one-line summary. */
export function changedFields(entry: Pick<AuditEntry, 'action' | 'old_data' | 'new_data'>): string[] {
  const before = asObject(entry.old_data)
  const after = asObject(entry.new_data)
  const filled = (data: Record<string, Json | undefined>) =>
    Object.keys(data).filter((key) => !IGNORED.has(key) && data[key] !== null && data[key] !== undefined)
  switch (entry.action) {
    case 'update':
      return Object.keys(after).filter(
        (key) => !IGNORED.has(key) && JSON.stringify(before[key]) !== JSON.stringify(after[key]),
      )
    case 'insert':
      return filled(after)
    case 'delete':
      return filled(before)
    default:
      return Object.keys(after)
  }
}
```

- [ ] **Step 4: Implement the two views**

Replace `web/src/views/admin/SettingsView.vue` with:

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { isApiError } from '@/api/errors'
import { updateTimezone } from '@/api/settings'
import PageHeader from '@/components/common/PageHeader.vue'
import { useNotify } from '@/composables/useNotify'
import { useSettingsStore } from '@/stores/settings'

const { t } = useI18n()
const notify = useNotify()
const settings = useSettingsStore()

const timezone = ref(settings.timezone)
const saving = ref(false)

const zones = computed(() => {
  const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
  const list = intl.supportedValuesOf?.('timeZone') ?? []
  return list.includes(settings.timezone) ? list : [settings.timezone, ...list]
})

async function save(): Promise<void> {
  const expected = settings.timezoneUpdatedAt
  if (saving.value || !expected) return
  saving.value = true
  try {
    await updateTimezone(timezone.value, expected)
    await settings.load()
    timezone.value = settings.timezone
    notify.success('admin.settings.saved')
  } catch (error) {
    notify.error(error)
    if (isApiError(error, 'stale_record')) {
      await settings.load()
      timezone.value = settings.timezone
    }
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <PageHeader title-key="nav.settings" />
    <form class="settings-form card" @submit.prevent="save">
      <div class="card-body settings-body">
        <label for="settings-timezone" class="form-label">{{ t('admin.settings.timezone') }}</label>
        <select id="settings-timezone" v-model="timezone" class="form-select">
          <option v-for="zone in zones" :key="zone" :value="zone">{{ zone }}</option>
        </select>
        <div class="form-text">{{ t('admin.settings.timezoneHelp') }}</div>
        <button type="submit" class="btn btn-primary mt-3" :disabled="saving">{{ t('common.save') }}</button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.settings-body {
  max-width: 32rem;
}
</style>
```

Replace `web/src/views/admin/AuditView.vue` with:

```vue
<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { type AuditFilters, listAuditLog } from '@/api/audit'
import { listAppUsers } from '@/api/users'
import { changedFields } from '@/components/admin/auditChanges'
import PageHeader from '@/components/common/PageHeader.vue'
import DateField from '@/components/forms/DateField.vue'
import { useNotify } from '@/composables/useNotify'
import { useShelterTime } from '@/composables/useShelterTime'
import { addDays, startOfDayInstant } from '@/lib/dates'
import { useSettingsStore } from '@/stores/settings'
import type { AppUser, AuditEntry } from '@/types/domain'

const PAGE_SIZE = 50
const TABLES = ['people', 'stays', 'outings', 'countries', 'case_types', 'genders', 'settings', 'app_users']

const { t } = useI18n()
const notify = useNotify()
const { formatDateTime } = useShelterTime()
const settings = useSettingsStore()

const filters = ref({
  table_name: '',
  record_id: '',
  actor_user_id: '',
  from: null as string | null,
  to: null as string | null,
})
const applied = ref<AuditFilters>({})
const page = ref(0)
// shallowRef: audit rows hold deep JSON that Vue does not need to track.
const rows = shallowRef<AuditEntry[]>([])
const total = ref(0)
const loading = ref(false)
const users = ref<AppUser[]>([])

const pages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))
const userNames = computed(
  () => new Map(users.value.filter((user) => user.user_id).map((user) => [user.user_id as string, user.display_name])),
)

function buildFilters(): AuditFilters {
  const current = filters.value
  const result: AuditFilters = {}
  if (current.table_name) result.table_name = current.table_name
  if (current.record_id.trim()) result.record_id = current.record_id.trim()
  if (current.actor_user_id) result.actor_user_id = current.actor_user_id
  // Dates are shelter days: from local midnight up to the next local midnight.
  if (current.from) result.from = startOfDayInstant(current.from, settings.timezone)
  if (current.to) result.to = startOfDayInstant(addDays(current.to, 1), settings.timezone)
  return result
}

async function fetchPage(): Promise<void> {
  loading.value = true
  try {
    const result = await listAuditLog({ ...applied.value, limit: PAGE_SIZE, offset: page.value * PAGE_SIZE })
    rows.value = result.rows
    total.value = result.total
  } catch (error) {
    notify.error(error)
  } finally {
    loading.value = false
  }
}

async function apply(): Promise<void> {
  applied.value = buildFilters()
  page.value = 0
  await fetchPage()
}

async function goTo(target: number): Promise<void> {
  page.value = target
  await fetchPage()
}

function userLabel(entry: AuditEntry): string {
  return (entry.actor_user_id && userNames.value.get(entry.actor_user_id)) || t('admin.audit.unknownUser')
}

onMounted(async () => {
  try {
    users.value = await listAppUsers()
  } catch {
    // Names are a convenience; the log still shows roles and operators.
    users.value = []
  }
  await apply()
})
</script>

<template>
  <div>
    <PageHeader title-key="nav.audit" />
    <form class="audit-filters row g-3 align-items-end mb-4" @submit.prevent="apply">
      <div class="col-md-2">
        <label for="audit-table" class="form-label">{{ t('admin.audit.filters.table') }}</label>
        <select id="audit-table" v-model="filters.table_name" class="form-select">
          <option value="">{{ t('admin.audit.filters.allTables') }}</option>
          <option v-for="table in TABLES" :key="table" :value="table">{{ t(`admin.audit.tables.${table}`) }}</option>
        </select>
      </div>
      <div class="col-md-3">
        <label for="audit-record" class="form-label">{{ t('admin.audit.filters.record') }}</label>
        <input id="audit-record" v-model="filters.record_id" type="text" class="form-control" autocomplete="off" />
      </div>
      <div class="col-md-2">
        <label for="audit-user" class="form-label">{{ t('admin.audit.filters.user') }}</label>
        <select id="audit-user" v-model="filters.actor_user_id" class="form-select">
          <option value="">{{ t('admin.audit.filters.allUsers') }}</option>
          <option v-for="user in users.filter((candidate) => candidate.user_id)" :key="user.email" :value="user.user_id">
            {{ user.display_name }}
          </option>
        </select>
      </div>
      <div class="col-md-2">
        <label for="audit-from" class="form-label">{{ t('admin.audit.filters.from') }}</label>
        <DateField id="audit-from" v-model="filters.from" />
      </div>
      <div class="col-md-2">
        <label for="audit-to" class="form-label">{{ t('admin.audit.filters.to') }}</label>
        <DateField id="audit-to" v-model="filters.to" :min="filters.from" />
      </div>
      <div class="col-md-1">
        <button type="submit" class="btn btn-primary w-100" :disabled="loading">{{ t('admin.audit.filters.apply') }}</button>
      </div>
    </form>

    <p v-if="rows.length === 0 && !loading" class="text-body-secondary">{{ t('admin.audit.empty') }}</p>
    <div v-else class="table-responsive">
      <table class="table table-sm align-middle">
        <thead>
          <tr>
            <th scope="col">{{ t('admin.audit.columns.at') }}</th>
            <th scope="col">{{ t('admin.audit.columns.user') }}</th>
            <th scope="col">{{ t('admin.audit.columns.operator') }}</th>
            <th scope="col">{{ t('admin.audit.columns.table') }}</th>
            <th scope="col">{{ t('admin.audit.columns.action') }}</th>
            <th scope="col">{{ t('admin.audit.columns.changes') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="entry in rows" :key="entry.id" data-testid="audit-row">
            <td class="text-nowrap">{{ formatDateTime(entry.at) }}</td>
            <td>
              {{ userLabel(entry) }}
              <div v-if="entry.actor_role" class="small text-body-secondary">
                {{ t(`admin.users.roles.${entry.actor_role}`) }}
              </div>
            </td>
            <td>{{ entry.operator_name }}</td>
            <td>
              {{ t(`admin.audit.tables.${entry.table_name}`) }}
              <div class="small text-body-secondary text-break"><code>{{ entry.record_id }}</code></div>
            </td>
            <td>{{ t(`admin.audit.actions.${entry.action}`) }}</td>
            <td>
              <span class="small">{{ changedFields(entry).join(', ') }}</span>
              <details class="small">
                <summary>{{ t('admin.audit.showChanges') }}</summary>
                <pre class="mb-0 text-break">{{ JSON.stringify({ antes: entry.old_data, despues: entry.new_data }, null, 2) }}</pre>
              </details>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <nav class="d-flex align-items-center gap-3" :aria-label="t('admin.audit.pager')">
      <button type="button" class="btn btn-outline-secondary btn-sm" :disabled="page === 0 || loading" @click="goTo(page - 1)">
        {{ t('admin.audit.previous') }}
      </button>
      <span data-testid="audit-page">{{ t('admin.audit.page', { page: page + 1, pages }) }}</span>
      <button
        type="button"
        class="btn btn-outline-secondary btn-sm"
        :disabled="page + 1 >= pages || loading"
        @click="goTo(page + 1)"
      >
        {{ t('admin.audit.next') }}
      </button>
    </nav>
  </div>
</template>
```

Inside the existing `admin` object in `web/src/i18n/locales/es-MX.json`, add:

```json
"settings": {
  "timezone": "Zona horaria del albergue",
  "timezoneHelp": "Define qué día es hoy para los ingresos, los egresos y la regla de una salida por día.",
  "saved": "Configuración guardada."
},
"audit": {
  "filters": {
    "table": "Tabla",
    "allTables": "Todas",
    "record": "Identificador del registro",
    "user": "Usuario",
    "allUsers": "Todos",
    "from": "Desde",
    "to": "Hasta",
    "apply": "Filtrar"
  },
  "tables": {
    "people": "Personas",
    "stays": "Estancias",
    "outings": "Salidas",
    "countries": "Países",
    "case_types": "Tipos de caso",
    "genders": "Géneros",
    "settings": "Configuración",
    "app_users": "Usuarios"
  },
  "actions": {
    "insert": "Alta",
    "update": "Cambio",
    "delete": "Baja",
    "merge": "Unión"
  },
  "columns": {
    "at": "Fecha y hora",
    "user": "Usuario",
    "operator": "En turno",
    "table": "Registro",
    "action": "Acción",
    "changes": "Campos"
  },
  "showChanges": "Ver detalle",
  "empty": "No hay cambios con estos filtros.",
  "pager": "Páginas del registro de cambios",
  "page": "Página {page} de {pages}",
  "previous": "Anterior",
  "next": "Siguiente",
  "unknownUser": "Usuario desconocido"
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm --prefix web run test -- tests/components/admin tests/views/admin`

Expected: PASS.

Run: `npm --prefix web run test:integration -- tests/integration/settings-audit.test.ts`

Expected: PASS.

- [ ] **Step 6: Run the whole suite, the type check and the linter**

Run: `npm run web:test`, then `npm run web:typecheck`, then `npm run web:lint`

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add web/src/api/settings.ts web/src/api/audit.ts web/src/components/admin/auditChanges.ts web/src/views/admin/SettingsView.vue web/src/views/admin/AuditView.vue web/src/i18n/locales/es-MX.json web/tests/components/admin/auditChanges.test.ts web/tests/views/admin/SettingsView.test.ts web/tests/views/admin/AuditView.test.ts web/tests/integration/settings-audit.test.ts
git commit -m "feat(web): edit the shelter timezone and browse the audit log"
```

---

### Task 13: Admin merge of duplicate records

**Files:**
- Modify: `web/src/api/people.ts`
- Create: `web/src/components/admin/mergeOverlaps.ts`, `web/src/components/admin/MergePersonPicker.vue`, `web/src/components/admin/MergeSideCard.vue`
- Replace: `web/src/views/admin/MergeView.vue`
- Modify: `web/src/i18n/locales/es-MX.json`
- Create tests: `web/tests/components/admin/mergeOverlaps.test.ts`, `web/tests/views/admin/MergeView.test.ts`, `web/tests/integration/merge.test.ts`

**Interfaces:**
- Consumes: `searchPeople` (Task 9), `getPerson` (Task 6), `listStaysForPerson` (Task 6), `addDays` (Task 7), `useShelterTime().formatDate`, `fullName`, `normalizeForSearch`, `useCatalogsStore().label`, `useConfirm`, `isApiError`.
- Produces:
  - `mergePeople(survivorId, duplicateId): Promise<void>` in `api/people.ts`.
  - `StayOverlap { kept: Stay; other: Stay }` and `findOverlaps(kept: Stay[], other: Stay[]): StayOverlap[]` in `mergeOverlaps.ts`, mirroring the database's stay range (a same-day stay occupies its day).
  - `MergePersonPicker` (prop `position: 'first' | 'second'`; emits `select(personId)`): form `form.merge-<position>-search-form`, input `#merge-<position>-search`, results `[data-testid="merge-<position>-result-<personId>"]`.
  - `MergeSideCard` (props `position`, `person`, `stays`, `selected`; emits `keep`, `change`): radio `#merge-keep-<position>`, card `[data-testid="merge-<position>-card"]`.
  - `MergeView` overlap rows `[data-testid="merge-overlap"]`.

- [ ] **Step 1: Write the failing tests**

Create `web/tests/components/admin/mergeOverlaps.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { findOverlaps } from '@/components/admin/mergeOverlaps'
import { makeStay, uuid } from '../../fixtures/data'

function stay(n: number, entry: string, exit: string | null) {
  return makeStay({ id: uuid(n), entry_date: entry, exit_date: exit })
}

describe('findOverlaps', () => {
  it('finds stays whose days overlap', () => {
    const kept = [stay(1, '2026-09-01', '2026-09-10')]
    const other = [stay(2, '2026-09-05', '2026-09-20'), stay(3, '2026-08-01', '2026-08-05')]
    expect(findOverlaps(kept, other).map((overlap) => overlap.other.id)).toEqual([uuid(2)])
  })

  it('lets a stay start on the day the previous one ended', () => {
    expect(findOverlaps([stay(1, '2026-09-01', '2026-09-10')], [stay(2, '2026-09-10', null)])).toEqual([])
  })

  it('counts a same-day stay as occupying its day', () => {
    expect(findOverlaps([stay(1, '2026-09-10', '2026-09-10')], [stay(2, '2026-09-10', null)])).toHaveLength(1)
    expect(findOverlaps([stay(1, '2026-09-10', '2026-09-10')], [stay(2, '2026-09-11', null)])).toEqual([])
  })

  it('treats an open stay as having no end', () => {
    expect(findOverlaps([stay(1, '2026-09-01', null)], [stay(2, '2026-12-01', '2026-12-05')])).toHaveLength(1)
  })
})
```

Create `web/tests/views/admin/MergeView.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/errors'
import { getPerson, mergePeople, searchPeople } from '@/api/people'
import { listStaysForPerson } from '@/api/stays'
import MergeView from '@/views/admin/MergeView.vue'
import { makePerson, makeStay, uuid } from '../../fixtures/data'
import { mountWithApp } from '../../utils/mountWithApp'

const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
const confirm = vi.hoisted(() => vi.fn())
vi.mock('@/composables/useNotify', () => ({ useNotify: () => notify }))
vi.mock('@/composables/useConfirm', () => ({ useConfirm: () => ({ confirm }) }))
vi.mock('@/api/people', () => ({ searchPeople: vi.fn(), getPerson: vi.fn(), mergePeople: vi.fn() }))
vi.mock('@/api/stays', () => ({ listStaysForPerson: vi.fn() }))

const people = {
  [uuid(1)]: makePerson({ id: uuid(1), first_name: 'José Luis', last_name: 'Hernández', birth_date: '1979-03-11' }),
  [uuid(2)]: makePerson({ id: uuid(2), first_name: 'Jose Luis', last_name: 'Hernandez', birth_date: '1979-11-03' }),
}
const stays = {
  [uuid(1)]: [makeStay({ id: uuid(101), person_id: uuid(1), entry_date: '2026-09-01', exit_date: '2026-09-10' })],
  [uuid(2)]: [makeStay({ id: uuid(102), person_id: uuid(2), entry_date: '2026-09-05', exit_date: null })],
}

type Wrapper = Awaited<ReturnType<typeof mountWithApp>>['wrapper']

async function pick(wrapper: Wrapper, position: 'first' | 'second', personId: string): Promise<void> {
  await wrapper.find(`#merge-${position}-search`).setValue('jose luis')
  await wrapper.find(`form.merge-${position}-search-form`).trigger('submit')
  const result = `[data-testid="merge-${position}-result-${personId}"]`
  await vi.waitFor(() => expect(wrapper.find(result).exists()).toBe(true))
  await wrapper.find(result).trigger('click')
  await vi.waitFor(() => expect(wrapper.find(`[data-testid="merge-${position}-card"]`).exists()).toBe(true))
}

async function mountView() {
  return mountWithApp(MergeView, { initialRoute: '/admin/merge', session: { role: 'admin' } })
}

afterEach(() => {
  document.body.innerHTML = ''
})

function mergeButton(wrapper: Wrapper) {
  const found = wrapper.findAll('button').find((button) => button.text() === 'Unir registros')
  if (!found) throw new Error('No merge button')
  return found
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(searchPeople).mockResolvedValue(
    Object.values(people).map((person) => ({
      person_id: person.id,
      first_name: person.first_name,
      last_name: person.last_name,
      birth_date: person.birth_date,
      birth_date_estimated: false,
      country_code: person.country_code,
      photo_path: null,
      score: 0.9,
      last_entry_date: null,
      last_exit_date: null,
      has_open_stay: false,
    })),
  )
  vi.mocked(getPerson).mockImplementation(async (id: string) => people[id] ?? makePerson({ id }))
  vi.mocked(listStaysForPerson).mockImplementation(async (id: string) => stays[id] ?? [])
  confirm.mockResolvedValue(true)
})

describe('MergeView', () => {
  it('merges the other record into the one chosen to keep, then opens it', async () => {
    vi.mocked(mergePeople).mockResolvedValue()
    const { wrapper, router } = await mountView()
    await pick(wrapper, 'first', uuid(1))
    await pick(wrapper, 'second', uuid(2))
    expect(mergeButton(wrapper).attributes('disabled')).toBeDefined()
    await wrapper.find('#merge-keep-second').setValue(true)
    await mergeButton(wrapper).trigger('click')
    await vi.waitFor(() => expect(mergePeople).toHaveBeenCalledWith(uuid(2), uuid(1)))
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        messageKey: 'admin.merge.confirmMessage',
        messageParams: { survivor: 'Jose Luis Hernandez', duplicate: 'José Luis Hernández' },
        danger: true,
      }),
    )
    await vi.waitFor(() => expect(router.currentRoute.value.params.id).toBe(uuid(2)))
    expect(notify.success).toHaveBeenCalledWith('admin.merge.done')
  })

  it('explains which stays overlap when the merge is refused', async () => {
    vi.mocked(mergePeople).mockRejectedValue(new ApiError('overlapping_stays'))
    const { wrapper } = await mountView()
    await pick(wrapper, 'first', uuid(1))
    await pick(wrapper, 'second', uuid(2))
    await wrapper.find('#merge-keep-first').setValue(true)
    await mergeButton(wrapper).trigger('click')
    await vi.waitFor(() => expect(wrapper.findAll('[data-testid="merge-overlap"]')).toHaveLength(1))
    const text = wrapper.find('[data-testid="merge-overlap"]').text()
    expect(text).toContain('01/09/2026 a 10/09/2026')
    expect(text).toContain('desde 05/09/2026')
  })

  it('refuses to merge a record with itself', async () => {
    const { wrapper } = await mountView()
    await pick(wrapper, 'first', uuid(1))
    await pick(wrapper, 'second', uuid(1))
    expect(wrapper.text()).toContain('Elegiste el mismo registro dos veces.')
    expect(mergeButton(wrapper).attributes('disabled')).toBeDefined()
  })
})
```

Create `web/tests/integration/merge.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { getPerson, mergePeople } from '@/api/people'
import { listStaysForPerson } from '@/api/stays'
import { createPerson, createStay, daysAgo } from './factories'
import { signInAs, uniqueSuffix } from './helpers'

describe('merge', () => {
  it('lets an admin merge two records of the same person', async () => {
    await signInAs('admin')
    const suffix = uniqueSuffix()
    const survivor = await createPerson({ first_name: 'Jose', last_name: `Fusion ${suffix}` })
    const duplicate = await createPerson({ first_name: 'José', last_name: `Fusión ${suffix}` })
    await createStay(duplicate, { entry_date: daysAgo(30), exit_date: daysAgo(20) })
    await mergePeople(survivor, duplicate)
    expect((await getPerson(duplicate)).merged_into_id).toBe(survivor)
    expect(await listStaysForPerson(survivor)).toHaveLength(1)
  })

  it('refuses overlapping stays and the same record twice', async () => {
    await signInAs('admin')
    const first = await createPerson()
    const second = await createPerson()
    await createStay(first, { entry_date: daysAgo(10) })
    await createStay(second, { entry_date: daysAgo(5), exit_date: daysAgo(2) })
    await expect(mergePeople(first, second)).rejects.toMatchObject({ code: 'overlapping_stays' })
    await expect(mergePeople(first, first)).rejects.toMatchObject({ code: 'merge_same_person' })
  })

  it('refuses a merge from a volunteer', async () => {
    await signInAs('volunteer')
    const first = await createPerson()
    const second = await createPerson()
    await expect(mergePeople(first, second)).rejects.toMatchObject({ code: 'not_authorized' })
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm --prefix web run test -- tests/components/admin/mergeOverlaps.test.ts tests/views/admin/MergeView.test.ts`

Expected: FAIL, because `mergeOverlaps` and the real view do not exist yet.

Run: `npm run db:reset`, then `npm --prefix web run test:integration -- tests/integration/merge.test.ts`

Expected: FAIL, because `mergePeople` is not exported yet.

- [ ] **Step 3: Implement the API call and the overlap check**

Append to `web/src/api/people.ts`:

```ts
/** Admin only. Moves the duplicate's stays to the survivor; the survivor's details are kept. */
export async function mergePeople(survivorId: string, duplicateId: string): Promise<void> {
  const { error } = await supabase.rpc('merge_people', { p_survivor_id: survivorId, p_duplicate_id: duplicateId })
  if (error) throw toApiError(error)
}
```

Create `web/src/components/admin/mergeOverlaps.ts`:

```ts
import { addDays } from '@/lib/dates'
import type { Stay } from '@/types/domain'

export interface StayOverlap {
  kept: Stay
  other: Stay
}

const NO_END = '9999-12-31'

/**
 * The days a stay occupies, like app.stay_range in the database: [entry, exit),
 * except that a stay ending the day it started occupies that day, and an open stay has no end.
 */
function rangeOf(stay: Stay): { start: string; end: string } {
  if (stay.exit_date === null) return { start: stay.entry_date, end: NO_END }
  const end = stay.exit_date === stay.entry_date ? addDays(stay.entry_date, 1) : stay.exit_date
  return { start: stay.entry_date, end }
}

/** Pairs of stays that would overlap if both records belonged to one person. */
export function findOverlaps(kept: Stay[], other: Stay[]): StayOverlap[] {
  return kept.flatMap((a) => {
    const rangeA = rangeOf(a)
    return other
      .filter((b) => {
        const rangeB = rangeOf(b)
        return rangeA.start < rangeB.end && rangeB.start < rangeA.end
      })
      .map((b) => ({ kept: a, other: b }))
  })
}
```

- [ ] **Step 4: Implement the picker, the side card and the view**

Create `web/src/components/admin/MergePersonPicker.vue`:

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { type PersonSearchResult, searchPeople } from '@/api/people'
import { useNotify } from '@/composables/useNotify'
import { useShelterTime } from '@/composables/useShelterTime'
import { fullName, normalizeForSearch } from '@/lib/people'

defineProps<{ position: 'first' | 'second' }>()
const emit = defineEmits<{ select: [personId: string] }>()

const { t } = useI18n()
const notify = useNotify()
const { formatDate } = useShelterTime()
const query = ref('')
const results = ref<PersonSearchResult[] | null>(null)
const searching = ref(false)

async function search(): Promise<void> {
  if (normalizeForSearch(query.value).length < 2 || searching.value) return
  searching.value = true
  try {
    results.value = await searchPeople(query.value.trim(), 20)
  } catch (error) {
    notify.error(error)
  } finally {
    searching.value = false
  }
}
</script>

<template>
  <div class="card">
    <div class="card-body">
      <form :class="`merge-${position}-search-form`" role="search" @submit.prevent="search">
        <label :for="`merge-${position}-search`" class="form-label">{{ t('admin.merge.search') }}</label>
        <div class="input-group">
          <input
            :id="`merge-${position}-search`"
            v-model="query"
            type="search"
            class="form-control"
            autocomplete="off"
          />
          <button type="submit" class="btn btn-outline-primary" :disabled="searching">
            {{ t('admin.merge.searchSubmit') }}
          </button>
        </div>
      </form>
      <p v-if="results && results.length === 0" class="text-body-secondary mt-3 mb-0">{{ t('admin.merge.noResults') }}</p>
      <div v-else-if="results" class="list-group mt-3">
        <button
          v-for="result in results"
          :key="result.person_id"
          type="button"
          class="list-group-item list-group-item-action"
          :data-testid="`merge-${position}-result-${result.person_id}`"
          @click="emit('select', result.person_id)"
        >
          <span class="fw-semibold">{{ fullName(result.first_name, result.last_name) }}</span>
          <span v-if="result.birth_date" class="small text-body-secondary ms-2">{{
            formatDate(result.birth_date)
          }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
```

Create `web/src/components/admin/MergeSideCard.vue`:

```vue
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useShelterTime } from '@/composables/useShelterTime'
import { fullName } from '@/lib/people'
import { useCatalogsStore } from '@/stores/catalogs'
import type { Person, Stay } from '@/types/domain'

defineProps<{ position: 'first' | 'second'; person: Person; stays: Stay[]; selected: boolean }>()
const emit = defineEmits<{ keep: []; change: [] }>()

const { t } = useI18n()
const { formatDate } = useShelterTime()
const catalogs = useCatalogsStore()
</script>

<template>
  <div class="card" :class="{ 'border-primary': selected }" :data-testid="`merge-${position}-card`">
    <div class="card-body">
      <h3 class="h5">{{ fullName(person.first_name, person.last_name) }}</h3>
      <dl class="row small mb-3">
        <dt class="col-5">{{ t('person.details.birthDate') }}</dt>
        <dd class="col-7">{{ formatDate(person.birth_date) || t('person.details.unknown') }}</dd>
        <dt class="col-5">{{ t('person.details.gender') }}</dt>
        <dd class="col-7">{{ catalogs.label('genders', person.gender_code) || t('person.details.unknown') }}</dd>
        <dt class="col-5">{{ t('person.details.country') }}</dt>
        <dd class="col-7">{{ catalogs.label('countries', person.country_code) || t('person.details.unknown') }}</dd>
        <dt class="col-5">{{ t('person.details.region') }}</dt>
        <dd class="col-7">{{ person.region || t('person.details.unknown') }}</dd>
      </dl>
      <h4 class="h6">{{ t('admin.merge.stays') }}</h4>
      <p v-if="stays.length === 0" class="small text-body-secondary">{{ t('admin.merge.noStays') }}</p>
      <ul v-else class="small">
        <li v-for="stay in stays" :key="stay.id">
          {{
            stay.exit_date
              ? t('admin.merge.range', { from: formatDate(stay.entry_date), to: formatDate(stay.exit_date) })
              : t('admin.merge.openRange', { from: formatDate(stay.entry_date) })
          }}
        </li>
      </ul>
      <div class="d-flex justify-content-between align-items-center">
        <div class="form-check mb-0">
          <input
            :id="`merge-keep-${position}`"
            class="form-check-input"
            type="radio"
            name="merge-survivor"
            :checked="selected"
            @change="emit('keep')"
          />
          <label :for="`merge-keep-${position}`" class="form-check-label">{{ t('admin.merge.keep') }}</label>
        </div>
        <button type="button" class="btn btn-sm btn-link" @click="emit('change')">{{ t('admin.merge.change') }}</button>
      </div>
    </div>
  </div>
</template>
```

Replace `web/src/views/admin/MergeView.vue` with:

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { isApiError } from '@/api/errors'
import { getPerson, mergePeople } from '@/api/people'
import { listStaysForPerson } from '@/api/stays'
import MergePersonPicker from '@/components/admin/MergePersonPicker.vue'
import MergeSideCard from '@/components/admin/MergeSideCard.vue'
import { findOverlaps, type StayOverlap } from '@/components/admin/mergeOverlaps'
import PageHeader from '@/components/common/PageHeader.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useNotify } from '@/composables/useNotify'
import { useShelterTime } from '@/composables/useShelterTime'
import { fullName } from '@/lib/people'
import type { Person, Stay } from '@/types/domain'

type Position = 'first' | 'second'
interface MergeSide {
  person: Person
  stays: Stay[]
}

const POSITIONS: Position[] = ['first', 'second']

const { t } = useI18n()
const router = useRouter()
const notify = useNotify()
const { confirm } = useConfirm()
const { formatDate } = useShelterTime()

const sides = ref<Record<Position, MergeSide | null>>({ first: null, second: null })
const survivor = ref<Position | null>(null)
const overlaps = ref<StayOverlap[]>([])
const merging = ref(false)

const columns = computed(() => POSITIONS.map((position) => ({ position, side: sides.value[position] })))
const samePerson = computed(
  () => !!sides.value.first && !!sides.value.second && sides.value.first.person.id === sides.value.second.person.id,
)
const canMerge = computed(
  () => !!sides.value.first && !!sides.value.second && survivor.value !== null && !samePerson.value && !merging.value,
)

function reset(): void {
  survivor.value = null
  overlaps.value = []
}

async function pick(position: Position, personId: string): Promise<void> {
  try {
    const [person, stays] = await Promise.all([getPerson(personId), listStaysForPerson(personId)])
    sides.value = { ...sides.value, [position]: { person, stays } }
    reset()
  } catch (error) {
    notify.error(error)
  }
}

function clear(position: Position): void {
  sides.value = { ...sides.value, [position]: null }
  reset()
}

function rangeLabel(stay: Stay): string {
  return stay.exit_date
    ? t('admin.merge.range', { from: formatDate(stay.entry_date), to: formatDate(stay.exit_date) })
    : t('admin.merge.openRange', { from: formatDate(stay.entry_date) })
}

async function merge(): Promise<void> {
  const keep = survivor.value
  if (!keep || !canMerge.value) return
  const kept = sides.value[keep]
  const other = sides.value[keep === 'first' ? 'second' : 'first']
  if (!kept || !other) return
  const approved = await confirm({
    titleKey: 'admin.merge.confirmTitle',
    messageKey: 'admin.merge.confirmMessage',
    messageParams: {
      survivor: fullName(kept.person.first_name, kept.person.last_name),
      duplicate: fullName(other.person.first_name, other.person.last_name),
    },
    confirmKey: 'admin.merge.confirm',
    danger: true,
  })
  if (!approved) return
  merging.value = true
  try {
    await mergePeople(kept.person.id, other.person.id)
    notify.success('admin.merge.done')
    await router.push({ name: 'person', params: { id: kept.person.id } })
  } catch (error) {
    notify.error(error)
    if (isApiError(error, 'overlapping_stays')) overlaps.value = findOverlaps(kept.stays, other.stays)
  } finally {
    merging.value = false
  }
}
</script>

<template>
  <div>
    <PageHeader title-key="nav.merge" />
    <p class="text-body-secondary">{{ t('admin.merge.intro') }}</p>
    <div class="row g-4">
      <div v-for="column in columns" :key="column.position" class="col-lg-6">
        <h2 class="h5">{{ t(`admin.merge.${column.position}`) }}</h2>
        <MergeSideCard
          v-if="column.side"
          :position="column.position"
          :person="column.side.person"
          :stays="column.side.stays"
          :selected="survivor === column.position"
          @keep="survivor = column.position"
          @change="clear(column.position)"
        />
        <MergePersonPicker v-else :position="column.position" @select="pick(column.position, $event)" />
      </div>
    </div>

    <p v-if="samePerson" class="text-danger mt-3" role="alert">{{ t('admin.merge.samePerson') }}</p>

    <div v-if="overlaps.length > 0" class="alert alert-warning mt-3" role="alert">
      <h3 class="h6">{{ t('admin.merge.overlapTitle') }}</h3>
      <p>{{ t('admin.merge.overlapIntro') }}</p>
      <ul class="mb-0">
        <li v-for="overlap in overlaps" :key="`${overlap.kept.id}-${overlap.other.id}`" data-testid="merge-overlap">
          {{ t('admin.merge.overlapRow', { first: rangeLabel(overlap.kept), second: rangeLabel(overlap.other) }) }}
          <RouterLink class="ms-2" :to="{ name: 'person', params: { id: overlap.other.person_id } }">{{
            t('admin.merge.openRecord')
          }}</RouterLink>
        </li>
      </ul>
    </div>

    <button type="button" class="btn btn-danger mt-4" :disabled="!canMerge" @click="merge">
      {{ t('admin.merge.submit') }}
    </button>
  </div>
</template>
```

Inside the existing `admin` object in `web/src/i18n/locales/es-MX.json`, add:

```json
"merge": {
  "intro": "Elige dos registros de la misma persona. Se conservan los datos del registro que elijas y las estancias de ambos.",
  "first": "Primer registro",
  "second": "Segundo registro",
  "search": "Buscar por nombre",
  "searchSubmit": "Buscar",
  "noResults": "Sin resultados.",
  "change": "Cambiar",
  "keep": "Conservar este registro",
  "stays": "Estancias",
  "noStays": "Sin estancias",
  "range": "{from} a {to}",
  "openRange": "desde {from}, abierta",
  "submit": "Unir registros",
  "confirmTitle": "Unir registros",
  "confirmMessage": "Se conservará el registro de {survivor} y el de {duplicate} quedará unido a él. Esta acción no se puede deshacer desde la aplicación.",
  "confirm": "Unir",
  "done": "Registros unidos.",
  "samePerson": "Elegiste el mismo registro dos veces.",
  "overlapTitle": "Las estancias se enciman",
  "overlapIntro": "Corrige o elimina una de estas estancias antes de unir los registros:",
  "overlapRow": "{first} y {second}",
  "openRecord": "Abrir ficha"
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm --prefix web run test -- tests/components/admin tests/views/admin/MergeView.test.ts`

Expected: PASS.

Run: `npm --prefix web run test:integration -- tests/integration/merge.test.ts`

Expected: PASS.

- [ ] **Step 6: Run the whole suite, the type check and the linter**

Run: `npm run web:test`, then `npm run web:typecheck`, then `npm run web:lint`

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add web/src/api/people.ts web/src/components/admin web/src/views/admin/MergeView.vue web/src/i18n/locales/es-MX.json web/tests/components/admin/mergeOverlaps.test.ts web/tests/views/admin/MergeView.test.ts web/tests/integration/merge.test.ts
git commit -m "feat(web): merge duplicate records and explain overlapping stays"
```

---
### Task 14: End-to-end flows

**Files:**
- Create: `web/e2e/steps.ts`, `web/e2e/registration.spec.ts`, `web/e2e/returning-person.spec.ts`, `web/e2e/daily-operations.spec.ts`

**Interfaces:**
- Consumes: `signIn(page, role, operatorName?)`, `uniqueName(prefix)` and `dismissLicenseBanner(page)` from `e2e/fixtures.ts` (P2), the Playwright config and `webServer` from Plan 2, and the Spanish labels and test ids from Tasks 1 to 8.
- Produces: `TINY_PNG`, `shelterDate(daysAgo)`, `typeDate(page, label, value)`, `registerPerson(page, firstName, lastName, options?)` and `residentRow(page, name)` in `e2e/steps.ts`; the three flows from spec section 12.

These tests drive the real app against the local stack, so they are written to pass on the first run once Tasks 1 to 8 are done. Each one creates its own uniquely named fictitious person. The returning-person flow backdates the first stay because a stay that starts and ends on the same day occupies that day, so the same person cannot start a new stay on it.

- [ ] **Step 1: Write the shared steps**

Create `web/e2e/steps.ts`:

```ts
import { expect, type Locator, type Page } from '@playwright/test'
import { dismissLicenseBanner } from './fixtures'

/** A 1x1 PNG: enough for the browser to decode, resize and upload. */
export const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
)

const SHELTER_TZ = 'America/Mexico_City'

/** The shelter-local date `daysAgo` days back, as dd/MM/yyyy for typing into a date field. */
export function shelterDate(daysAgo: number): string {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: SHELTER_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  const date = new Date(`${today}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() - daysAgo)
  const iso = date.toISOString().slice(0, 10)
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
}

/** Types a date into a Syncfusion date field and leaves it, as a person would. */
export async function typeDate(page: Page, label: string, value: string): Promise<void> {
  const field = page.getByLabel(label, { exact: true })
  await field.fill(value)
  await field.press('Tab')
}

export interface RegisterOptions {
  photo?: boolean
  entryDaysAgo?: number
}

/** Registers a fictitious person through the form and returns the new record id. */
export async function registerPerson(
  page: Page,
  firstName: string,
  lastName: string,
  options: RegisterOptions = {},
): Promise<string> {
  await page.goto('/people/new')
  await dismissLicenseBanner(page)
  await page.getByLabel('Nombre(s)', { exact: true }).fill(firstName)
  await page.getByLabel('Apellidos', { exact: true }).fill(lastName)
  await page.getByLabel('Cama', { exact: true }).fill('Z9')
  if (options.entryDaysAgo) await typeDate(page, 'Fecha de ingreso', shelterDate(options.entryDaysAgo))
  if (options.photo) {
    await page.getByLabel('Elegir archivo o tomar con el teléfono').setInputFiles({
      name: 'foto.png',
      mimeType: 'image/png',
      buffer: TINY_PNG,
    })
    await expect(page.getByText('Foto lista. Se guardará al registrar.')).toBeVisible()
  }
  await page.getByRole('button', { name: 'Registrar e ingresar' }).click()
  await page.waitForURL(/\/people\/[0-9a-f-]{36}$/)
  return new URL(page.url()).pathname.split('/').pop() ?? ''
}

/** Opens the residents list filtered to one person and returns their grid row. */
export async function residentRow(page: Page, name: string): Promise<Locator> {
  await page.goto('/residents')
  await dismissLicenseBanner(page)
  await page.getByLabel('Buscar por nombre o cama').fill(name)
  return page.getByRole('row').filter({ hasText: name })
}
```

- [ ] **Step 2: Write flow 1, a new person with a photo**

Create `web/e2e/registration.spec.ts`:

```ts
import { expect, test } from '@playwright/test'
import { signIn, uniqueName } from './fixtures'
import { registerPerson, residentRow } from './steps'

test('a new person is registered with a photo and appears among the residents', async ({ page }) => {
  await signIn(page, 'volunteer', 'Turno de prueba')
  const firstName = uniqueName('Ana')
  await registerPerson(page, firstName, 'Prueba', { photo: true })

  await expect(page.getByTestId('stay-status')).toContainText('En el albergue desde')
  await expect(page.getByRole('img', { name: `Foto de ${firstName} Prueba` })).toBeVisible()

  const row = await residentRow(page, firstName)
  await expect(row).toHaveCount(1)
  await expect(row.getByTestId('presence')).toHaveAttribute('data-presence', 'inside')
  await expect(row.getByRole('img', { name: `Foto de ${firstName} Prueba` })).toBeVisible()
})
```

- [ ] **Step 3: Write flow 2, a returning person caught by the duplicate panel**

Create `web/e2e/returning-person.spec.ts`:

```ts
import { expect, test } from '@playwright/test'
import { dismissLicenseBanner, signIn, uniqueName } from './fixtures'
import { registerPerson, residentRow, shelterDate, typeDate } from './steps'

test('a returning person is found by the duplicate panel and gets a new stay', async ({ page }) => {
  await signIn(page, 'volunteer', 'Turno de prueba')
  const firstName = uniqueName('Luis')
  await registerPerson(page, firstName, 'Regresa', { entryDaysAgo: 10 })

  // The first stay ended days ago, so a new stay today does not overlap it.
  const row = await residentRow(page, firstName)
  await row.getByRole('button', { name: 'Egreso', exact: true }).click()
  await typeDate(page, 'Fecha de egreso', shelterDate(5))
  await page.getByRole('button', { name: 'Registrar egreso' }).click()
  await expect(row).toHaveCount(0)

  // They come back, typed in different case.
  await page.goto('/people/new')
  await dismissLicenseBanner(page)
  await page.getByLabel('Nombre(s)', { exact: true }).fill(firstName.toLowerCase())
  await page.getByLabel('Apellidos', { exact: true }).fill('REGRESA')
  const candidate = page.getByTestId('duplicate-candidate').filter({ hasText: firstName })
  await expect(candidate).toBeVisible()
  await candidate.getByRole('button', { name: 'Es esta persona' }).click()

  await page.waitForURL(/\/people\/[0-9a-f-]{36}\?checkIn=1$/)
  await page.getByLabel('Cama', { exact: true }).fill('B7')
  await page.getByRole('button', { name: 'Abrir estancia' }).click()
  await expect(page.getByTestId('stay-status')).toContainText('En el albergue desde')
  await expect(page.getByTestId('stay-row')).toHaveCount(2)
})
```

- [ ] **Step 4: Write flow 3, outing, return, exception and check-out**

Create `web/e2e/daily-operations.spec.ts`:

```ts
import { expect, test } from '@playwright/test'
import { signIn, uniqueName } from './fixtures'
import { registerPerson, residentRow } from './steps'

test('outing, return, exception and check-out from the residents list', async ({ page }) => {
  await signIn(page, 'volunteer', 'Turno de prueba')
  const firstName = uniqueName('Eva')
  await registerPerson(page, firstName, 'Salidas')
  const row = await residentRow(page, firstName)
  const presence = row.getByTestId('presence')

  await row.getByRole('button', { name: 'Salida', exact: true }).click()
  await page.getByLabel('Comentario (opcional)').fill('Cita en el consulado')
  await page.getByRole('button', { name: 'Registrar salida' }).click()
  await expect(presence).toHaveAttribute('data-presence', 'outside')

  await row.getByRole('button', { name: 'Regreso', exact: true }).click()
  await expect(presence).toHaveAttribute('data-presence', 'inside')

  await row.getByRole('button', { name: 'Salida', exact: true }).click()
  await page.getByRole('button', { name: 'Registrar salida' }).click()
  await expect(page.getByText('Ya salió hoy, ¿registrar como excepción?')).toBeVisible()
  await page.getByRole('button', { name: 'Registrar excepción' }).click()
  await expect(presence).toHaveAttribute('data-presence', 'outside')

  await row.getByRole('button', { name: 'Egreso', exact: true }).click()
  await expect(page.getByText('se registrará como salió y no regresó')).toBeVisible()
  await page.getByRole('button', { name: 'Registrar egreso' }).click()
  await expect(row).toHaveCount(0)
})
```

- [ ] **Step 5: Run the flows**

Run: `npm run db:reset`, then `npm run web:e2e`

Expected: 7 passed (the 3 flows plus Plan 2's 4 sign-in tests). If a step fails, open the report with `npx --prefix web playwright show-report` and fix the code under test, not the flow, unless a label in the flow differs from the Spanish text this plan defines.

- [ ] **Step 6: Commit**

```bash
git add web/e2e/steps.ts web/e2e/registration.spec.ts web/e2e/returning-person.spec.ts web/e2e/daily-operations.spec.ts
git commit -m "test(web): add end-to-end flows for registration, returning people and daily operations"
```

---

### Task 15: Documentation

**Files:**
- Modify: `CLAUDE.md` (the `## Status` and `## Commands` sections)
- Modify: `README.md` (the `## Status` and `## Development` sections)

**Interfaces:**
- Consumes: everything above, and the docs Plan 2 wrote (its Commands list and Development section already cover every script this plan uses).
- Produces: up-to-date developer docs.

- [ ] **Step 1: Update `CLAUDE.md`**

Replace the first paragraph of `## Status` (the one Plan 2 wrote, ending "The feature screens (Plan 3) come next.") with:

```markdown
Sub-project 1 (Registry and Stays) is implemented and tested: the database (Plan 1), the web foundation (Plan 2) and the web features (Plan 3). Sub-project 2 (Reports) is next.
```

Keep the spec and plans bullets and the source-of-truth paragraph below it.

In `## Commands`, add this line to the code block, right after the `npm run web:typecheck` line:

```bash
npm --prefix web run test -- tests/views/ResidentsView.test.ts   # one unit test file
```

Then add this paragraph after the paragraph that starts "Component tests mount with":

```markdown
Web conventions the tests rely on: Syncfusion pickers and dropdowns are bound with `:value` and a change handler (not `v-model`); Syncfusion Dialogs stay mounted and bind `visible`, with `v-if` only on the content inside; Grid cells read only precomputed row fields; test ids use `data-testid`; dates are typed into Syncfusion inputs with `typeInto()` from `web/tests/utils/syncfusion.ts`.
```

- [ ] **Step 2: Update `README.md`**

Replace the paragraph under `## Status` with:

```markdown
The first part, registry and stays, is built and tested: registration with duplicate warnings and photos, stays, outings, the list of who is in the shelter, the person record, search, and the admin screens. Reports come next. The design is in [docs/superpowers/specs/2026-10-07-shelterbridge-registry-and-stays-design.md](docs/superpowers/specs/2026-10-07-shelterbridge-registry-and-stays-design.md).
```

In `## Development`, right after the paragraph that ends "The volunteer account first asks who is on shift.", add:

```markdown
After that, the home screen lists the made-up residents from the seed data. From there you can register a person (with a photo from the webcam or a file), record outings, returns and check-outs, and open each person's record. Sign in as `admin@shelterbridge.test` to see the admin screens for users, catalogs, settings, the change log and merging duplicates.
```

- [ ] **Step 3: Check for dashes**

Run this in Git Bash. It matches the UTF-8 bytes of the em dash and en dash:

`LC_ALL=C grep -rnP '\xE2\x80[\x93\x94]' --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude=package-lock.json .`

Expected: no output. Rewrite any hit.

- [ ] **Step 4: Run everything once more**

Run: `npm run web:test`, `npm run web:typecheck`, `npm run web:lint`, then `npm run db:reset` and `npm run web:test:integration`, then `npm run db:reset` and `npm run web:e2e`

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "docs: describe the finished registry and stays app"
```

---

## Contract notes

The plan keeps to the web contract and to Plan 2's "Interfaces for Plan 3". These are the points an executor or a reviewer should know.

1. **Syncfusion v-model.** With `@syncfusion/ej2-vue-*` 35.1.39 under jsdom, `v-model` on DatePicker, DateTimePicker and DropDownList shows the first value but ignores later programmatic changes, while `:value` with a change handler follows them. This plan's pickers use `:value` and `@change`, as Plan 2's `CatalogSelect` does.
2. **Dialogs.** Every dialog in this plan follows Plan 2's rule (stay mounted, bind `visible`). Under jsdom, `v-if` on the Dialog itself threw on the second opening, while a mounted Dialog with `v-if` on its inner form opened and closed cleanly several times, so each dialog resets its form from its prop on every opening.
3. **Driving Syncfusion inputs in tests.** Plan 2 suggests setting `vm.ej2Instances` and calling `dataBind()`. This plan's `typeInto()` instead types into the input and fires `input`, `change` and `blur`, which goes through the same parsing a person triggers; it was verified with DatePicker and DateTimePicker 35.1.39 (typed dates, cleared fields, out-of-range values).
4. **`overlapping_stays` message.** Plan 2 owns `errors.overlapping_stays`. Because a same-day stay now occupies its day (Plan 1 decision), the person record adds its own hint next to the check-in form pointing to "Reabrir estancia". Plan 2's generic message could also mention it.
5. **Deletes.** RLS turns a non-admin delete into zero affected rows rather than an error, so `deleteStay` and `deleteOuting` throw `not_found` when nothing was deleted.
6. **Retry on failure.** The spec (section 10) was updated for v1: after a failure every form keeps its input and the person retries with the same button; toasts have no retry action.
7. **Additions beyond the contract.** New exports and files: `cleanStay` in `api/stays.ts`; `lib/dates.ts` (date picker and wall-clock conversions), `lib/people.ts`; composables `useThumbnails`, `useResidents`, `useDuplicateCheck`, `usePendingPhotos`; test helpers `tests/fixtures/data.ts`, `tests/utils/syncfusion.ts`, `tests/integration/factories.ts` and `e2e/steps.ts`. `listAuditLog` treats `from` as inclusive and `to` as exclusive.
