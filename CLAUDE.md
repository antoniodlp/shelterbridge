# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

ShelterBridge is a shelter management app. The first user is FM4 Paso Libre, a migrant shelter in Guadalajara, Mexico. They will use it with real data. The app should remain configurable for other kinds of shelters later. The name is ShelterBridge, never "shelterapp".

The main purpose is to manage the people staying at the shelter and their needs. FM4 currently does this in Google Sheets.

## Status

The project is in the design phase, with no application code yet.

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

There are none yet. Add them here once the project is scaffolded.

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
- The role comes from the `app_users` table through `app.current_role()`, not from JWT claims. This keeps deactivation immediate.
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
