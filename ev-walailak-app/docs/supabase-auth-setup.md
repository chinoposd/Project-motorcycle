# Supabase Auth setup

The app keeps its demo accounts and demo registration available. Supabase Auth support restores an existing Supabase session and checks the account profile and approval status; the current login screen intentionally remains demo-only and does not yet offer interactive Supabase sign-in or registration.

## Configure the frontend

1. Copy `.env.example` to `.env.local`.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from the Supabase project's API settings.
3. Use a publishable key only. Never put a `service_role` or secret key in a browser environment file.

`.env.local` is ignored by Git. The checked-in `.env.example` contains placeholders only.

## Prepare the database

Apply `supabase/migrations/20261024062207_create_profiles.sql` to the intended Supabase project using the Supabase CLI or SQL Editor. The migration creates `public.profiles`, enables RLS, allows signed-in users to read only their own profile, and does not grant browser clients insert/update/delete privileges.

The app reads `profiles` through Supabase's Data API. Confirm that the `public` schema is exposed in the project's Data API settings; schema exposure is separate from table grants and RLS policies. See [Supabase's API security guide](https://supabase.com/docs/guides/api/securing-your-api) and [RLS guide](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Current limits

- Supabase sign-in and sign-up functions exist, but the visible login/register screens still use demo accounts only.
- Profile edits, profile photos, account closure, and vehicle controls are not written to Supabase or a real vehicle service.
- The account approval screen distinguishes account approval from Driving Permission; setting one does not grant the other.
