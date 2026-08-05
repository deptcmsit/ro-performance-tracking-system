# RO Performance Tracking System

Modern Recovery Officer attendance and monitoring portal built with Next.js 15, TypeScript, Tailwind CSS, Supabase Auth, Supabase Realtime, and role-based dashboards.

## Features

- Admin dashboard with live daily summaries, charts, and quick navigation.
- Recovery Officer management: create, edit, delete, activate/deactivate, and reset passwords.
- Route CRUD and allocation assignment.
- Recovery Officer morning workflow: working/absent, check in, route selection, allocations, check out.
- Sub Admin full-screen Live TV Mode for projector monitoring with realtime updates.
- Daily attendance reports with date filter, search, CSV export, Excel export, and print.
- Supabase SQL schema with RLS policies, realtime publication setup, seed routes, 30 dummy ROs, demo admin users, allocations, and attendance history.

## Environment

Copy `.env.local.example` to `.env.local` and fill values from Supabase Project Settings > API.

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

`SUPABASE_SERVICE_ROLE_KEY` is required only on the server for Admin CRUD and password resets. Never expose it publicly.

## Supabase Setup

Open the Supabase SQL Editor and run:

```sql
-- paste the full contents of supabase/schema.sql
```

The script creates:

- `users`
- `routes`
- `allocations`
- `attendance`
- RLS policies
- Realtime publication entries
- Admin, Sub Admin, and 30 Recovery Officer demo accounts
- 10 routes, sample allocations, and previous attendance history

## Demo Accounts

| Role | Login | Password |
| --- | --- | --- |
| Admin | `admin@ro-tracking.com` | `PazzyAdmin123` |
| Sub Admin | `subadmin@ro-tracking.com` | `PazzySubAdmin123` |
| Recovery Officer | `ro001` to `ro030` | `PazzyRO123` |

Recovery Officers can log in with username format like `ro001`; the app converts it to `ro001@ro-tracking.com`.

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Build

```bash
npm run build
```

## Deployment

Deploy to Vercel and add the same environment variables in the Vercel project settings. Make sure the Supabase SQL script has already been applied before using the deployed portal.
