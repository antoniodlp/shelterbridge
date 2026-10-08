# ShelterBridge

ShelterBridge is a web app for running a shelter. It registers the people who arrive, tracks their stays, and shows who is in the shelter at any moment.

It is being built for FM4 Paso Libre, a migrant shelter in Guadalajara, Mexico. The first version follows their daily operations, and its interface is in Spanish. The design leaves room for other kinds of shelters later.

## Status

The first part, registry and stays, is built and tested: registration with duplicate warnings and photos, stays, outings, the list of who is in the shelter, the person record, search, and the admin screens. Reports come next. The design is in [docs/superpowers/specs/2026-10-07-shelterbridge-registry-and-stays-design.md](docs/superpowers/specs/2026-10-07-shelterbridge-registry-and-stays-design.md).

## What the first version will do

**Access**
- Invite-only sign-in with Google, or with email and password.
- Four roles: admin, legal, psychology and volunteer.

**People and stays**
- Register people with a photo.
- Warn about possible duplicates, including accents, swapped first and last names, and day and month swapped in the birth date.
- Keep one record per person with many stays. Each stay records check-in, bed, case type, phone status, notes and check-out.
- Link minors to their carer.

**Daily operations**
- Record outings during a stay, with leave and return times. The rule is one outing per day, and exceptions are allowed.
- List the current residents: who is inside or out, the headcount, and any unaccompanied minors.

**Administration**
- Admin screens for users, catalogs, settings, the audit log, and merging duplicate records.
- A record of every change, including who made it.

## Roadmap

| # | Part | Contents |
|---|------|----------|
| 1 | Registry and Stays | People, stays, outings, current residents, roles, audit |
| 2 | Reports | Counts by period, nationality, gender, case type and age |
| 3 | Google Sheets import | Bring in the historical records FM4 keeps today |
| 4 | Needs and follow-up | Legal, psychology and other services, with confidential notes per area |

Planned for later: an offline mode, individual volunteer accounts, bed management, and an English interface.

## Tech stack

- **Backend:** [Supabase](https://supabase.com) for Postgres, authentication and file storage.
- **Frontend:** a [Vue 3](https://vuejs.org) single page app with Vite and TypeScript.
- **UI:** [Syncfusion](https://www.syncfusion.com/vue-components) components with [Bootstrap 5](https://getbootstrap.com). Text is set in [Clarity City](https://github.com/googlefonts/clarity-city), bundled with the app under the SIL Open Font License.
- **Translation:** vue-i18n for app text, with Spanish (es-MX) as the main language.

## Repository layout (planned)

```
supabase/   database migrations, seed data, database tests
web/        Vue app
docs/       design specs and implementation plans
```

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

After that, the home screen lists the made-up residents from the seed data. From there you can register a person (with a photo from the webcam or a file), record outings, returns and check-outs, and open each person's record. Sign in as `admin@shelterbridge.test` to see the admin screens for users, catalogs, settings, the change log and merging duplicates.

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

## Privacy

This app holds personal data about people in vulnerable situations. Never put real personal data in the repository, seed files, test fixtures, screenshots or issues. Always use made-up data.
