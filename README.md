# ShelterBridge

ShelterBridge is a web app for running a shelter. It registers the people who arrive, tracks their stays, and shows who is in the shelter at any moment.

It is being built for FM4 Paso Libre, a migrant shelter in Guadalajara, Mexico. The first version follows their daily operations, and its interface is in Spanish. The design leaves room for other kinds of shelters later.

## Status

The project is in early design, and there is no usable app yet. The design for the first part is in [docs/superpowers/specs/2026-10-07-shelterbridge-registry-and-stays-design.md](docs/superpowers/specs/2026-10-07-shelterbridge-registry-and-stays-design.md).

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
- **UI:** [Syncfusion](https://www.syncfusion.com/vue-components) components with [Bootstrap 5](https://getbootstrap.com).
- **Translation:** vue-i18n for app text, with Spanish (es-MX) as the main language.

## Repository layout (planned)

```
supabase/   database migrations, seed data, database tests
web/        Vue app
docs/       design specs and implementation plans
```

## Development

Setup instructions will be added once the project is scaffolded. Local development will use the Supabase CLI (which runs on Docker) and Node.js.

## Privacy

This app holds personal data about people in vulnerable situations. Never put real personal data in the repository, seed files, test fixtures, screenshots or issues. Always use made-up data.
