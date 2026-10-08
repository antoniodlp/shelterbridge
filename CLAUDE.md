# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

ShelterBridge is a shelter management app. The first user is FM4 Paso Libre, a migrant shelter in Guadalajara, Mexico. They will use it with real data. The app should remain configurable for other kinds of shelters later. The name is ShelterBridge, never "shelterapp".

The main purpose is to manage the people staying at the shelter and their needs. FM4 currently does this in Google Sheets.

## Status

Sub-project 1 (Registry and Stays) is implemented and tested: the database (Plan 1), the web foundation (Plan 2) and the web features (Plan 3). Sub-project 2 (Reports) is next.

- Spec for sub-project 1: [docs/superpowers/specs/2026-10-07-shelterbridge-registry-and-stays-design.md](docs/superpowers/specs/2026-10-07-shelterbridge-registry-and-stays-design.md)
- Implementation plans go in `docs/superpowers/plans/`.

The spec is the source of truth for the data model, roles, RPC functions, screens and tests. Read it before changing anything, and update it when a decision changes.

## Roadmap

1. Registry and Stays (current): auth, roles, people, duplicate detection and merge, stays, outings, current residents, audit, Spanish UI.
2. Reports.
3. Google Sheets import of historical data.
4. Needs and follow-up, including confidential legal and psychology notes.

## Stack

- **Backend:** Supabase (Postgres, Auth, Storage). No Edge Functions in v1.
- **Frontend:** Vue 3 SPA with Vite and TypeScript, plus Vue Router and Pinia.
- **UI:** Syncfusion EJ2 Vue with the Bootstrap 5 theme, alongside Bootstrap 5 for layout.
- **i18n:** vue-i18n for app strings; Syncfusion L10n and CLDR data for component text and formats.
- **Tests:** pgTAP for the database, Vitest and Vue Test Utils for the frontend, Playwright for end-to-end.

## Planned layout

```
supabase/   config.toml, migrations/, seed.sql, tests/ (pgTAP)
web/        src/{api, components, composables, i18n, router, stores, views, types}
            tests/, e2e/
docs/       superpowers/specs/, superpowers/plans/
```

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
npm --prefix web run test -- tests/views/ResidentsView.test.ts   # one unit test file
```

`web/.env.local` (git-ignored) holds `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (the `ANON_KEY` from `npx supabase status -o env`) and the optional `VITE_SYNCFUSION_LICENSE_KEY`. Playwright needs Chromium once: `(cd web && npx playwright install chromium)`.

Component tests mount with `web/tests/utils/mountWithApp.ts` and mock `@/api/*`. A missing i18n key fails the unit tests. Syncfusion theme CSS is imported per component in `web/src/main.ts` from `@syncfusion/ej2-bootstrap5.3-theme`.

Web conventions the tests rely on: Syncfusion pickers and dropdowns are bound with `:value` and a change handler (not `v-model`); Syncfusion Dialogs stay mounted and bind `visible`, with `v-if` only on the content inside; Grid cells read only precomputed row fields; test ids use `data-testid`; dates are typed into Syncfusion inputs with `typeInto()` from `web/tests/utils/syncfusion.ts`.

Local dev users (password `shelterbridge-dev`): `admin@`, `legal@`, `psychology@` and `volunteer@shelterbridge.test`. Auth emails go to Mailpit at http://127.0.0.1:54324. Google sign-in is optional locally; see README.md.

## Rules

### Language

- Code, database identifiers, comments, commit messages and docs are in English.
- Every user-facing string goes through i18n. `es-MX` is the source locale. Do not hardcode UI text.
- Catalog labels are stored as `labels jsonb` (for example `{"es": "...", "en": "..."}`). Show `labels[locale]`, falling back to `labels.es`.

### Architecture

- Only `web/src/api/` may import `@supabase/supabase-js`. Views, composables and stores call the functions in `api/`.
- Functions in `api/` return typed data or throw an `ApiError`. Its `code` maps to the i18n key `errors.<code>`.
- Authorization lives in Postgres:
  - every table has RLS enabled;
  - frontend route guards are for UX only.
- The role comes from the `app_users` table through `app.current_app_role()`, not from JWT claims. This keeps deactivation immediate.
- Operations with several steps are Postgres RPC functions:
  - they are `security invoker`, so RLS still applies;
  - they raise `P0001` with a stable error code as the message.
- Sensitive data (legal, psychology, health, documents) goes in separate tables with their own RLS. Never rely on hiding columns.
- Do not store derived values. Age, presence (inside or outside), and the unaccompanied-minor flag are computed in the `current_residents` view.
- "Today" and day boundaries use the shelter timezone from `settings` through `app.today()`. Never use UTC or the browser timezone for this.
- Edits use optimistic concurrency on `updated_at`. Zero updated rows means `stale_record`.

### Naming

- A **stay** ends at check-out (`stays.exit_date`, shown as "egreso" in the UI).
- An **outing** (`outings`, shown as "salida") is a temporary exit during a stay.
- Do not call both of them "exit".

### Data model

- Keep v1 minimal. Prefer a text field or a direct foreign key over a new catalog or join table, unless the spec calls for it. Offer extra structure as an option instead of adding it.
- All catalog tables share one shape: `code` primary key, `labels jsonb` with a required `es` key, `sort_order`, and `active`.
- **Adding a field takes four steps:**
  1. a new SQL migration in `supabase/migrations/`;
  2. regenerate `web/src/types/database.ts`;
  3. update the forms;
  4. add the strings to `es-MX.json`.

### Privacy

- The data is about real people in vulnerable situations, and Mexican data protection law (LFPDPPP) applies.
- Never commit, seed, log or test with real personal data. Seeds and fixtures use made-up people.
- Keep personal data out of URLs (use UUIDs), console output and error messages.
- Photos live in a private bucket. They are served only through short-lived signed URLs, and their paths contain only UUIDs.

### Writing style

- No em dashes or en dashes anywhere: code, comments, docs, commit messages or UI strings. Use commas, periods, colons or parentheses instead.
- Write plainly and directly. Skip filler and buzzwords.

### Workflow

- Follow brainstorm, then spec, then plan, then implementation.
- Use test-driven development. Database behavior (RLS per role, constraints, RPC errors) gets pgTAP tests.
