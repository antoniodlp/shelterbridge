# ShelterBridge Sub-project 1: Registry and Stays Design

- **Date:** 2026-10-07
- **Status:** Draft for review
- **Scope:** Sub-project 1 of the ShelterBridge roadmap (see §2)

---

## 1. Context and intent

ShelterBridge is a shelter-management application whose main purpose is to manage the people staying at a shelter and their needs. It is built first for the real operations of **FM4 Paso Libre**, a migrant shelter in Guadalajara, Mexico, and will be adopted by them. It should remain configurable enough to serve other types of shelters later. FM4 currently relies heavily on Google Sheets.

### What was stated

- Stack: **Supabase** backend, **Vue** SPA frontend, **Syncfusion** UI components, **Bootstrap** CSS.
- Code in English; UI internationalized, Spanish first.
- Priorities: (A) intake/registry, (B) daily operations, (D) reporting, (C) needs & follow-up.
- Reception runs on 1 or 2 fixed desktop computers with reliable internet. Phones must be supported, but desktop is the main use. Offline mode is desirable later, not in v1.
- Users: 2 volunteers per shift, 3 legal, 2 psychology, 4 to 5 admin.
- Volunteers share one account per shift (for now). Any user may sign in with email/password or Google.
- People return to the shelter, sometimes under different spellings or names. The model is **one person, many stays**, and avoiding duplicates is important.
- Historical data from Google Sheets will be imported eventually (not in v1).
- Beds are free-text labels (A1, B3…) with no validation.
- During a stay, a person may leave the shelter temporarily (normally once per day, with exceptions), and each exit and return is recorded.

### Assumptions

- Users are shelter staff and volunteers, never the sheltered people themselves.
- The data is highly sensitive (identity, nationality, minors, and later legal and psychological information). Mexican data-protection law (LFPDPPP) applies.
- "Other shelters" means configurability, not multi-tenant SaaS.

### Success criteria for sub-project 1

1. Reception can register a new person (with photo) and open their stay from a single form, saved in a single transaction.
2. Before a new person is created, likely duplicates are surfaced: accent and case differences, swapped first/last names, and swapped day/month in the birth date.
3. At any moment, any user can see who is staying, who is inside or outside the shelter, the headcount, and any unaccompanied minors.
4. Every change is attributable to a user and role. For the shared volunteer account, the self-declared name of the operator on shift is also recorded.
5. Nothing is visible without an allowlisted, active account, and deactivating a user takes effect immediately.
6. The entire UI is in Spanish (es-MX), including Syncfusion's built-in component text and date/number formats.

---

## 2. Roadmap

| # | Sub-project | Notes |
|---|---|---|
| **1** | **Registry & Stays** (this document) | Auth, roles, people, duplicate detection and merge, stays, outings, current residents, audit, es-MX UI |
| 2 | Reports | Counts by period, nationality, gender, case type, age, and so on |
| 3 | Google Sheets import | Historical people and stays into this model (`source = 'import'`) |
| 4 | Needs & follow-up | Includes confidential legal and psychology notes in separate tables with area-specific RLS |

Each sub-project gets its own spec → plan → implementation cycle.

---

## 3. Scope

### In scope

- Sign-in with Google or email/password, invitation-only via an allowlist.
- Four roles (`admin`, `legal`, `psychology`, `volunteer`) enforced with RLS.
- "Who's on shift" operator name for the shared volunteer account.
- People registry with photo, carer link for minors, and duplicate detection at registration.
- Stays: check-in, check-out, bed (text), case type, phone status, notes.
- Outings: leave and return times, a once-per-day rule with confirmed exceptions, and a comment.
- Current residents list with derived presence (inside/outside), headcount, and an unaccompanied-minor badge.
- Admin: users (allowlist), catalogs (countries, case types, genders), settings, audit log viewer, and merging duplicates.
- Audit log of all changes.
- es-MX localization.

### Out of scope (see §16 Backlog)

Reports, the Sheets import, needs and follow-up, confidential area notes, offline mode, individual volunteer accounts, inactivity auto-logout, belongings custody beyond phone status, bed management, admin-defined custom fields, ARCO-rights tooling, Realtime sync, the English locale, external error monitoring, and read auditing.

---

## 4. Architecture

### 4.1 Overview

```
Browser (Vue 3 SPA)
  views/components
     ↓
  composables + Pinia stores
     ↓
  api/  ── the only module that imports supabase-js
     ↓ HTTPS
Supabase
  Auth (Google OAuth, email/password, Before User Created hook)
  PostgREST → Postgres (tables, views, RLS, RPC functions, audit triggers)
  Storage (private bucket person-photos)
```

### 4.2 Frontend (`web/`)

- **Vue 3 + Vite + TypeScript.** Database types are generated with `supabase gen types typescript` into `web/src/types/database.ts`.
- **Vue Router** for routing and **Pinia** for shared state: session, current role, operator name, catalogs.
- **Syncfusion EJ2 Vue** for the heavy components: Grid, DatePicker, DropDownList, Uploader, Dialog and Toast. It uses the Syncfusion Bootstrap 5 theme so it is visually consistent with **Bootstrap 5**, which handles layout, the responsive grid and utilities.
- The layout is desktop-first and responsive. On narrow screens the Grid uses Syncfusion's adaptive UI mode.
- **vue-i18n** handles application strings (see §11).
- **ESLint** with `no-restricted-imports` forbids importing `@supabase/supabase-js` outside `web/src/api/`.

### 4.3 Backend (`supabase/`)

- **Postgres** holds tables, constraints, views, RLS policies, RPC functions and audit triggers. **All authorization lives in the database.**
- Extensions: `pg_trgm`, `unaccent`, `btree_gist`.
- **Schemas:**
  - `public` holds tables, views and RPCs exposed through PostgREST.
  - `app` holds internal helpers (`current_app_role()`, `today()`, `immutable_unaccent()`, audit trigger function). It is not exposed through the API.
- **Storage:** a private bucket, `person-photos`.
- **No Edge Functions in v1.**

### 4.4 Authentication

- **Providers:** Google OAuth and email/password, both available to every user. Supabase automatically links identities that share a verified email, so one person is one auth user. Email confirmation is enabled.
- **Invitation-only:**
  - Admins maintain `app_users` (email + role) from the app.
  - A **Before User Created** auth hook rejects any sign-up, Google or password, whose email is not in `app_users` with `active = true`.
- **Linking:** an `after insert` trigger on `auth.users` sets `app_users.user_id` for the matching email.
- **Role resolution:** RLS reads the role from `app_users` on each statement through `app.current_app_role()`; it is not stored in the JWT.
  - This makes deactivation immediate.
  - The UI loads the signed-in user's own `app_users` row after sign-in to know its role.
- **No role, no data:** a user without an active `app_users` row sees nothing (RLS) and the UI shows an "access pending" screen.
- **Shared volunteer account:** a single allowlisted email with the `volunteer` role.
- **Bootstrapping:** the first admin is inserted into `app_users` once, using the SQL editor.

### 4.5 The `api/` layer

```
web/src/api/
  client.ts     the single Supabase client (custom fetch adds x-operator-name)
  errors.ts     ApiError + toApiError()
  auth.ts       signInWithGoogle, signInWithPassword, signUp, resetPassword, signOut, onSessionChange
  people.ts     search, get, update, findPossibleDuplicates, registerAndCheckIn, merge
  stays.ts      listCurrent, checkIn, checkOut, update, remove, historyFor
  outings.ts    start, end, update, remove, listForStay
  catalogs.ts   list(name), upsert (admin)
  photos.ts     upload(personId, blob), signedUrls(paths)
  users.ts      list, invite, changeRole, setActive (admin)
  settings.ts   get, update (admin)
  audit.ts      list(filters) (admin)
```

**Contract:** every function returns typed data or throws an `ApiError`.

```ts
type ApiErrorCode =
  | 'not_authorized' | 'not_found' | 'validation' | 'stale_record'
  | 'already_checked_in' | 'stay_not_open' | 'outing_already_open' | 'no_open_outing'
  | 'outing_exception_needs_confirmation' | 'outing_outside_stay'
  | 'overlapping_stays' | 'merge_same_person'
  | 'network' | 'unknown'

class ApiError extends Error {
  code: ApiErrorCode
  i18nKey: string        // `errors.${code}`
  details?: unknown
}
```

**`toApiError()` mapping:**

| Source | Maps to |
|---|---|
| `P0001` raised by our functions | `message` is the code |
| `42501` | `not_authorized` |
| `23P01` (exclusion) | `overlapping_stays` |
| `23505`, `23514`, `23502`, `23503`, `22007`, `22008`, `22P02` (unique, check, not null, foreign key, bad date or uuid text) | `validation` |
| fetch failure | `network` |
| anything else | `unknown` |

**Optimistic concurrency:** `update` functions take the `updated_at` value that was loaded, filter on it, and request the updated row back. Zero rows means `stale_record`.

**Grids:** Syncfusion Grids receive data from `api/` functions, never from a `DataManager` pointed at Supabase.

**Non-goals for v1:**
- no field-name mapping (the generated `snake_case` types are used as-is);
- no client cache beyond the Pinia stores listed in §4.2;
- no Realtime.

**Offline seam:** a future offline mode reimplements `api/` behind the same signatures, using an IndexedDB cache and a write queue. Views do not change.

### 4.6 Environments and hosting

- **Local:** Supabase CLI (Docker), `supabase/seed.sql` with catalogs and **fictitious** people only.
- **Staging and production:** two separate Supabase Cloud projects.
  - Migrations are applied with `supabase db push`.
  - Auth hooks and the Google provider are configured per project.
- **SPA:** any static host (Netlify, Vercel or Cloudflare Pages), with one build per environment.

---

## 5. Data model

All tables have RLS enabled. All timestamps are `timestamptz`. "Today" and day boundaries are computed by `app.today()` and in the shelter timezone from `settings`.

### 5.1 Catalogs

Every catalog has the same shape, so a single generic admin editor covers all of them:

```sql
create table <catalog> (
  code        text primary key,            -- stable identifier, immutable once created
  labels      jsonb not null,              -- {"es": "...", "en": "..."}; CHECK (labels ? 'es')
  sort_order  int  not null default 0,
  active      bool not null default true   -- inactive: hidden from pickers, still shown on existing records
);
```

| Catalog | Code | Seeded with |
|---|---|---|
| `countries` | ISO 3166-1 alpha-2 | full list, common origin countries sorted first |
| `case_types` | short English slug, e.g. `asylum_seeker` | values supplied by FM4 (§15) |
| `genders` | short English slug, e.g. `female` | starter list supplied or confirmed by FM4 (§15) |

### 5.2 `people`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | `default gen_random_uuid()` |
| `first_name` | text not null | |
| `last_name` | text | nullable, because some people have a single name |
| `birth_date` | date | nullable (unknown) |
| `birth_date_estimated` | bool not null default false | shown as "~25" |
| `gender_code` | text → `genders` | nullable |
| `country_code` | text → `countries` | nullable |
| `region` | text | department/state, free text |
| `carer_id` | uuid → `people` | for minors; `CHECK (carer_id <> id)` |
| `photo_path` | text | `person-photos/{id}.jpg` |
| `search_name` | text, generated stored | `app.immutable_unaccent(lower(first_name \|\| ' ' \|\| coalesce(last_name, '')))`, GIN trigram index |
| `merged_into_id` | uuid → `people` | set when merged into another record |
| `source` | text not null default `'app'` | `CHECK IN ('app', 'import')` |
| `created_at`, `created_by`, `updated_at`, `updated_by` | | set by trigger; `*_by` comes from `auth.uid()` |

Age is **never stored**. It is calculated as `date_part('year', age(app.today(), birth_date))`.

### 5.3 `stays`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `person_id` | uuid not null → `people` | `on delete restrict` |
| `entry_date` | date not null default `app.today()` | |
| `exit_date` | date | `CHECK (exit_date >= entry_date)`; null means the stay is open |
| `case_type_code` | text → `case_types` | |
| `bed` | text | free text in v1 |
| `phone_status` | text not null default `'none'` | `CHECK IN ('none', 'with_person', 'in_custody')`. A fixed list, because the app reacts to `in_custody` at check-out |
| `notes` | text | |
| `source` | text not null default `'app'` | `CHECK IN ('app', 'import')` |
| `created_at/by`, `updated_at/by` | | trigger |

**Constraints:**
- `UNIQUE (person_id) WHERE exit_date IS NULL` allows at most one open stay per person.
- `EXCLUDE USING gist (person_id WITH =, app.stay_range(entry_date, exit_date) WITH &&)` prevents overlapping stays. `app.stay_range` is `[entry_date, exit_date)`, so the exit day is excluded and a person checked out today can be checked in again today (for example after a check-out entered by mistake). An open stay has no end date. A stay that starts and ends on the same day occupies that one day, so it cannot hide inside another stay.

### 5.4 `outings`

These are temporary exits during a stay. A stay ends at **check-out** (`stays.exit_date`, shown as "egreso" in the UI). An outing is a "salida".

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `stay_id` | uuid not null → `stays` | `on delete cascade` (deleting a stay deletes its outings) |
| `left_at` | timestamptz not null default `now()` | |
| `returned_at` | timestamptz | `CHECK (returned_at > left_at)`; null means the person is out |
| `is_exception` | bool not null default false | set by `start_outing` when the stay already had an outing that day |
| `comment` | text | |
| `created_at/by`, `updated_at/by` | | trigger |

**Constraints:**
- `UNIQUE (stay_id) WHERE returned_at IS NULL` allows at most one open outing per stay.
- A trigger enforces that `left_at` (as a date in the shelter timezone) falls within `[entry_date, coalesce(exit_date, ∞)]`. Otherwise it raises `outing_outside_stay`.
- The same rule is checked from the other side when `stays` is updated: `entry_date` and `exit_date` may not move so that an existing outing falls outside the stay. Otherwise it raises `outing_outside_stay`.

An outing that is still open when the stay is checked out stays open permanently. It is read as "left and did not return".

### 5.5 `settings`

`key text PK, value jsonb not null`. The v1 key is `timezone`, set to `"America/Mexico_City"`.

### 5.6 `app_users`

| Column | Type | Notes |
|---|---|---|
| `email` | text PK | trimmed and lowercased by a trigger, so comparisons are case-insensitive |
| `user_id` | uuid unique → `auth.users` | filled at first sign-in |
| `role` | `app_role` enum | `'admin' \| 'legal' \| 'psychology' \| 'volunteer'` |
| `display_name` | text not null | |
| `active` | bool not null default true | |
| `created_at/by`, `updated_at/by` | | |

### 5.7 `audit_log`

| Column | Type | Notes |
|---|---|---|
| `id` | bigint identity PK | |
| `at` | timestamptz not null default `now()` | |
| `actor_user_id` | uuid | `auth.uid()` |
| `actor_role` | `app_role` | |
| `operator_name` | text | self-declared operator on shift (attribution only, not authentication) |
| `table_name` | text not null | |
| `record_id` | text not null | |
| `action` | text not null | `'insert' \| 'update' \| 'delete' \| 'merge'` |
| `old_data` | jsonb | row before the change |
| `new_data` | jsonb | row after the change |

### 5.8 View `current_residents`

Defined `with (security_invoker = true)` so that RLS applies. It has one row per open stay of a non-merged person.

| Column | Derivation |
|---|---|
| `stay_id`, `person_id`, names, `photo_path`, `gender_code`, `country_code`, `region`, `bed`, `entry_date`, `case_type_code`, `phone_status`, `carer_id` | direct |
| `age`, `birth_date_estimated` | from `birth_date` |
| `days_in_shelter` | `app.today() - entry_date` |
| `presence` | `'outside'` if the stay has an open outing, else `'inside'` |
| `out_since`, `open_outing_id` | from the open outing |
| `outings_today` | count of the stay's outings whose `left_at` falls on `app.today()` |
| `is_minor` | `age < 18`; null if `birth_date` is null |
| `is_unaccompanied_minor` | `is_minor` and (`carer_id` is null, or the carer has no open stay) |

---

## 6. Server operations (RPC)

All RPCs are `security invoker`, so RLS applies. They raise business errors with `errcode 'P0001'` and the error code as `message`.

| Function | Who | Behavior | Errors |
|---|---|---|---|
| `find_possible_duplicates(first_name, last_name, birth_date, country_code)` | any role | Returns up to 5 non-merged candidates with score, photo path, birth date (and whether it is estimated), country and last stay. The web app computes the age from the birth date and the shelter's today. See §6.1 | none |
| `search_people(q, limit = 50)` | any role | Trigram plus prefix search over `search_name`. Non-merged only. Returns the last stay summary | none |
| `register_person_and_check_in(person jsonb, stay jsonb)` | any role | Inserts the person and an open stay in one transaction. Returns ids | `validation` |
| `check_in(person_id, stay jsonb)` | any role | Opens a new stay for an existing person | `not_found`, `already_checked_in`, `overlapping_stays` |
| `check_out(stay_id, exit_date = app.today())` | any role | Closes the stay. An open outing is left open ("did not return"). `exit_date` must be on or after the date of the stay's last outing | `not_found`, `stay_not_open`, `validation` |
| `start_outing(stay_id, comment, confirm_exception = false)` | any role | If the stay already has an outing today and `confirm_exception` is false, raises `outing_exception_needs_confirmation`. Otherwise inserts the outing with the right `is_exception` | `not_found`, `stay_not_open`, `outing_already_open`, `outing_exception_needs_confirmation` |
| `end_outing(stay_id)` | any role | Sets `returned_at = now()` on the open outing | `not_found`, `stay_not_open`, `no_open_outing` |
| `merge_people(survivor_id, duplicate_id)` | admin (checked explicitly in the function) | Moves the duplicate's stays to the survivor, repoints `carer_id` references, and sets `duplicate.merged_into_id`. The survivor's fields are kept. Writes an audit row with `action = 'merge'` | `not_authorized`, `merge_same_person`, `not_found`, `overlapping_stays` |

Simple edits (person fields, stay fields, outing corrections) and admin deletes of stays and outings use PostgREST directly, through `api/` with optimistic concurrency.

### 6.1 Duplicate scoring (initial values, to be tuned with real data)

The input name is normalized the same way as `search_name`. A second form is built with first and last names swapped.

Score:
- `name_sim = max(similarity(search_name, q), similarity(search_name, q_swapped))`;
- plus **0.30** if the birth date matches exactly;
- plus **0.20** if day and month are swapped;
- plus **0.10** if only the same birth year;
- plus **0.10** if the same `country_code`.

A candidate is returned if `name_sim ≥ 0.30`, or if `name_sim ≥ 0.20` and the birth date matches exactly or with day and month swapped. Candidates are ordered by score, limit 5, and records with `merged_into_id` set are excluded.

---

## 7. Access control

### 7.1 Permission matrix (v1)

| Capability | volunteer | legal | psychology | admin |
|---|:-:|:-:|:-:|:-:|
| Read people, stays, outings, `current_residents`, catalogs, settings | ✓ | ✓ | ✓ | ✓ |
| Register, check in, check out, start/end outings, edit people/stays/outings | ✓ | ✓ | ✓ | ✓ |
| Approve an outing exception | ✓ | ✓ | ✓ | ✓ |
| Delete a stay or outing | | | | ✓ |
| Merge people | | | | ✓ |
| Write catalogs and settings | | | | ✓ |
| Manage `app_users` | | | | ✓ (everyone reads their own row) |
| Read `audit_log` | | | | ✓ |
| Delete people | nobody | | | |

Merging is admin-only at the data level too: only an admin may set `people.merged_into_id` or move a stay to another person (`stays.person_id`); a trigger rejects those writes from other roles. Case type and stay notes are visible to volunteers in v1. **Rule for sub-project 4:** sensitive data always lives in separate tables with their own RLS. It is never handled by hiding columns, because all users share the `authenticated` database role.

### 7.2 RLS mechanics

- `app.current_app_role()` is `stable` and `security definer`. It returns the `role` of the `app_users` row where `user_id = auth.uid()` and `active`, or null.
- Policies call it as `(select app.current_app_role())`, so it is evaluated once per statement.
- "Any role" policies check that `(select app.current_app_role()) is not null`. Admin-only policies check that it equals `'admin'`.
- `anon` has no grants on any table. With RLS enabled and no matching policy, access is denied.
- `security definer` is used only by `app.current_app_role()`, `app.shelter_timezone()`, the audit functions (`app.audit()` and `app.write_audit()`), the user-linking triggers, and the auth hooks. `created_by`/`updated_by` stamping is a plain trigger that sets the values from `auth.uid()`.
  - The auth hooks grant execute to `supabase_auth_admin` only.

### 7.3 Storage

- The `person-photos` bucket is private. Its policies allow any active role to read and write, and admin to delete. Writes are only accepted for object names made of a UUID, optionally followed by `_thumb`, and `.jpg`.
- **Objects:** `{person_id}.jpg` (about 800px) and `{person_id}_thumb.jpg` (about 160px). Both are produced in the browser and uploaded with `upsert`.
- Images are served only through signed URLs that last 10 minutes. Thumbnails are requested in batches with `createSignedUrls`.
- Paths contain only UUIDs, never names.

---

## 8. Audit

- **Generic trigger.** `app.audit()` runs `after insert or update or delete` on `people`, `stays`, `outings`, `countries`, `case_types`, `genders`, `settings` and `app_users`. It writes `old_data` and `new_data` as jsonb, plus `actor_user_id`, `actor_role` and `operator_name`.
- **Operator name:**
  - After the shared volunteer account signs in, the `/shift` screen asks who is on shift (free text, for example "Ana, Luis"). The answer is stored in `sessionStorage` and Pinia.
  - The Supabase client's custom `fetch` sends it as `x-operator-name`, base64-encoded UTF-8.
  - The trigger reads `current_setting('request.headers', true)::json ->> 'x-operator-name'` and decodes it with `convert_from(decode(…, 'base64'), 'UTF8')`.
  - It is recorded for any role when present.
- `merge_people` writes its own audit row with `action = 'merge'` and both ids.
- Clients cannot insert, update or delete `audit_log`. Only admins can select from it.
- Reads are not audited in v1.

---

## 9. Screens and flows

### 9.1 Routes

| Route | Screen | Roles |
|---|---|---|
| `/login` | Google sign-in, email/password sign-in, sign-up (first password), forgot password | public |
| `/reset-password` | Set a new password from the email link | public |
| `/pending` | "Your access is pending" (signed in but no active role) | signed in |
| `/shift` | "Who's on shift?", shown only for the `volunteer` role, after sign-in | volunteer |
| `/residents` | **Home.** Current residents grid plus headcount | any |
| `/people/search` | Search the whole history | any |
| `/people/new` | Registration with duplicate panel | any |
| `/people/:id` | Person record: data, photo, carer, stays, outings of the current stay | any |
| `/admin/users` | Allowlist: invite, change role, activate/deactivate | admin |
| `/admin/catalogs` | Generic editor for countries, case types and genders | admin |
| `/admin/settings` | Timezone | admin |
| `/admin/audit` | Filterable audit log | admin |
| `/admin/merge` | Pick two records, compare side by side, choose the survivor | admin |

Route guards use the role from the Pinia session store. RLS is the real enforcement.

### 9.2 Registration with duplicate detection

1. While first name, last name, birth date or country change, the UI waits 400 ms after the last keystroke and then calls `findPossibleDuplicates`.
2. A side panel lists up to 5 candidates, each with thumbnail, name, age, country and last stay.
   - **"Es esta persona"** ("it's this person") opens the existing person and starts the check-in flow there.
   - **"Es una persona nueva"** ("it's a new person") continues registration.
3. The form collects person fields and the first stay's fields (entry date defaulting to today, bed, case type, phone status, notes).
   - If the computed age is under 18, a **carer** picker appears that searches current residents.
4. On save, `registerAndCheckIn` runs as one transaction.
5. **Photo:** from the webcam (`getUserMedia`) on desktop, or a file or camera input (`<input type="file" accept="image/*" capture>`) on phones. The UI then:
   - resizes in the browser to the full image and the thumbnail;
   - uploads both;
   - updates `photo_path`.
   If the upload fails, the person still exists, and the record shows a "Reintentar foto" (retry photo) action.

### 9.3 Returning person

From search or from the duplicate panel, open `/people/:id` and choose **"Nueva estancia"** (new stay). That shows the stay fields and calls `checkIn`.

### 9.4 Daily operations (`/residents`)

- **Headcount bar:** total residents, inside, outside, minors, and unaccompanied minors.
- **Grid columns:** thumbnail, name, age (with `~` when estimated), gender, country, bed, entry date, days in shelter, presence badge, out since, and an unaccompanied-minor badge. Filtering, sorting and quick search are client-side.
- **Row actions:**
  - **Salida / Regreso** (outing / return) toggles according to presence.
    - Starting an outing when `outings_today ≥ 1` shows a confirmation ("Ya salió hoy, ¿registrar como excepción?"), then calls `start_outing` with `confirm_exception = true`.
    - The comment is optional.
  - **Egreso** (check-out) opens a dialog with the exit date (default today) and warnings:
    - `phone_status = 'in_custody'` shows "devolver el teléfono" (return the phone);
    - `presence = 'outside'` shows "se registrará como salió y no regresó" (it will be recorded as left and did not return).
  - **Ver ficha** (view record) opens `/people/:id`.

### 9.5 Merge (admin)

1. Pick two people, which are shown side by side with their stays.
2. Choose the survivor and confirm.
3. `merge_people` runs. On `overlapping_stays`, the UI explains which stays overlap so the admin can correct or delete one first.
4. Afterwards the survivor can be edited as usual.

---

## 10. Error handling

- **The database is authoritative.** Client-side validation mirrors it for fast feedback: required fields, dates not in the future, a plausible birth date, and exit date on or after entry date.
- **Forms never lose input on failure.** Each failure shows a translated toast built from `ApiError.i18nKey`, with a retry option.
- **Connectivity:** when `navigator.onLine` is false or a request fails with `network`, the UI shows a "Sin conexión" (no connection) banner. There is no offline queue in v1.
- **Concurrent edits:** `stale_record` produces a message that someone else changed the record, with an option to reload it.
- **Privacy:** personal data never appears in URLs (UUIDs only), console logs, or error messages. There is no third-party error monitoring in v1.

---

## 11. Internationalization

- **Application strings:** vue-i18n, in `web/src/i18n/locales/es-MX.json`. That file is the source of truth, with keys namespaced by screen (for example `residents.columns.bed`). `en` comes later.
- **Syncfusion:**
  - `L10n.load()` with the Spanish translations from `@syncfusion/ej2-locale`;
  - `loadCldr()` with es-MX CLDR data for dates and numbers;
  - `setCulture('es-MX')`.
- **One entry point:** `setLocale(locale)` switches vue-i18n, Syncfusion L10n and culture, and `<html lang>` together.
- **Dates and times:** dates are shown as `dd/MM/yyyy` and times as `HH:mm`. Both are always rendered in the shelter timezone from `settings`, not the browser's.
- **Catalog labels:** `labels[locale] ?? labels.es`.
- **Errors:** each code is shown through `errors.<code>`.
- **Missing keys:** vue-i18n `missingWarn` is configured to fail the test suite.
- **English everywhere else:** code, database identifiers, comments, commit messages and these docs.

---

## 12. Testing

| Layer | Tool | Covers |
|---|---|---|
| Database | pgTAP via `supabase test db` | See the list below |
| `api/` | Vitest against local Supabase | Each function as each seeded role; the error → `ApiError` mapping; `stale_record` detection |
| Components | Vitest + Vue Test Utils, with `api/` mocked | Duplicate panel, Salida/Regreso toggle and exception confirmation, check-out warnings, minor/carer picker, unaccompanied badge |
| End-to-end | Playwright against local Supabase | ① new person + check-in ② returning person caught by the duplicate panel → new stay ③ outing → return → check-out |

The database tests cover:
- **RLS for every role**, plus `anon` and a signed-in user without a role, across every table, the view, and storage;
- **constraints:** one open stay, no overlapping stays, one open outing, outing within the stay;
- **every RPC**, including its error codes;
- **outing exceptions** around midnight in the shelter timezone;
- **duplicate scoring:** accents, swapped names, swapped day/month, single names;
- **the Before User Created hook:** allowlisted and not allowlisted, active and inactive;
- **the audit trigger**, including `operator_name` decoding;
- **merge**, including overlapping stays.

The seed data is fictitious only. Real personal data never enters the repository, fixtures or tests.

---

## 13. Repository structure

```
shelterbridge/
  supabase/
    config.toml
    migrations/            versioned SQL (schema, RLS, functions, triggers, hooks)
    seed.sql               catalogs + fictitious people/stays/outings + test users
    tests/                 pgTAP
  web/
    src/
      api/                 the only importer of supabase-js
      components/
      composables/
      i18n/                setLocale(), locales/es-MX.json, Syncfusion locale wiring
      router/
      stores/
      views/
      types/database.ts    generated
    tests/                 Vitest
    e2e/                   Playwright
  docs/
    superpowers/specs/
```

---

## 14. Pre-launch checklist (not blockers for development)

1. **Supabase plan:** Pro for production. The free plan pauses inactive projects and has no backups.
2. **Region:** there is no Mexico region, so the data will be stored in a US region. FM4's *aviso de privacidad* (privacy notice) must disclose the international transfer.
3. **Syncfusion license:** confirm eligibility for the Community License (revenue, developer and employee limits) or obtain a paid license. Register the license key in each build.
4. **Google OAuth:** a Google Cloud OAuth client and consent screen for each environment, with redirect URLs configured in Supabase.
5. **Custom SMTP:** Supabase's built-in email is rate-limited and intended for testing. Configure a custom SMTP provider for confirmation and reset emails in production.
6. **First admin:** insert it into `app_users` using the SQL editor.

---

## 15. Inputs needed from FM4 (seed data, not design blockers)

- The list of **case types**.
- The list of **genders** FM4 wants to record.
- The **common origin countries** to sort first in the country picker.
- The email address for the **shared volunteer account**.

---

## 16. Backlog (explicitly deferred)

- Sub-projects 2 (reports), 3 (Sheets import) and 4 (needs & follow-up, with confidential legal and psychology notes in separate RLS-protected tables).
- Offline mode, implemented behind the `api/` seam.
- Individual volunteer accounts.
- Automatic sign-out after inactivity, configurable and defaulting to 30 minutes.
- Belongings custody beyond phone status.
- Bed and room management (catalog, occupancy, validation).
- Admin-defined custom fields (typed core + `jsonb` + field definitions) for other shelters.
- LFPDPPP ARCO-rights tooling, such as cancellation or deletion on request.
- Realtime sync between reception computers.
- English locale.
- External error monitoring with personal-data scrubbing.
- Auditing reads of sensitive data, which arrives with sub-project 4.
