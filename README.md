# R.K Fitness

Responsive Hebrew web app for Roni Kalisker, a personal fitness trainer.

The project currently focuses on a stable MVP with separate Admin and Trainee
experiences. The active application uses React, Vite, and Supabase.

## Current stack

- React 19
- Vite
- Supabase Authentication and database
- Oxlint
- Hebrew UI with RTL layout

## Active application

- Entry point: `src/main.jsx`
- App shell: `src/AppFullMigration.jsx`
- Authentication gate: `src/components/AuthGate.jsx`
- Supabase client: `src/lib/supabase.js`
- Data access: `src/services/`

`src/main.jsx` renders `AppFullMigration` inside `AuthGate`.

## Local setup

Requirements:

- Node.js version supported by the installed Vite version
- npm
- Access to the project Supabase environment

Install dependencies:

```bash
npm install
```

Create `.env.local` from `.env.example` and add the local Supabase values:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Do not commit `.env.local` or place secrets in source files.

Start the development server:

```bash
npm run dev
```

## Quality checks

Run these checks before reviewing a change:

```bash
npm run check
git diff --check
git status --short
```

## MVP areas

Admin navigation:

- Dashboard
- Leads
- Trainees
- Reviews
- Schedule
- Revenue
- Settings

Trainee navigation:

- Home
- Workout
- Progress

The current migration priority is to move core data flows from local storage to
Supabase while preserving the existing UI behavior.

## Data-flow rules

- Keep Supabase queries inside service modules.
- Verify database table and column names before adding a query.
- Update UI state only after a successful database operation.
- Include loading, empty, error, retry, and busy states in persisted flows.
- Do not expose Supabase keys, sessions, private data, or internal errors.
- Do not remove legacy local-storage compatibility until the dependent screen
  has been migrated.

## Manual CRUD check

For a Supabase-backed screen:

1. Sign in with the correct role.
2. Verify loading and empty states.
3. Create a generic test record.
4. Refresh and confirm it persists.
5. Update the record and refresh again.
6. Test status changes when supported.
7. Delete the test record and refresh.
8. Sign out and sign in again.
9. Confirm no secret, token, or internal error is shown.

## Working branch

Current migration branch:

```text
feature/full-migration
```

Treat the current branch in GitHub as the source of truth. Keep changes focused,
review the diff, and do not commit or push without approval.
