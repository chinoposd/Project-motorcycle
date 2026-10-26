# Supabase Auth setup

The app keeps its demo accounts available and uses Supabase Auth for real registration and sign-in when configured. Registration creates the Auth user with the submitted name, phone number, and requested applicant role. The database trigger in the migration creates the matching profile with `account_status = 'Pending'`; an administrator must approve the account before normal use.

## Configure the frontend

1. Copy `.env.example` to `.env.local`.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from the Supabase project's API settings.
3. Use a publishable key only. Never put a `service_role` or secret key in a browser environment file.
4. In Supabase Authentication URL Configuration, set the Site URL and allow-list the app origins (for local development, `http://localhost:5173`). Registration redirects email confirmations to the origin currently running the app.
5. Restart the Vite development server after changing `.env.local` so Vite loads the new values.

`.env.local` is ignored by Git. The checked-in `.env.example` contains placeholders only.

## Prepare the database

Apply `supabase/migrations/20261024062207_create_profiles.sql` to the intended Supabase project using the Supabase CLI or SQL Editor. The migration creates `public.profiles`, enables RLS, allows signed-in users to read only their own profile, and does not grant browser clients insert/update/delete privileges.

To enable real Admin review of pending accounts, also apply `supabase/migrations/20261024130000_admin_account_review.sql` and provision a trusted first Admin as described in [Supabase Admin account review setup](supabase-admin-setup.md). The Admin review RPCs are not available until that migration is installed.

The app reads `profiles` through Supabase's Data API. Confirm that the `public` schema is exposed in the project's Data API settings; schema exposure is separate from table grants and RLS policies. See [Supabase's API security guide](https://supabase.com/docs/guides/api/securing-your-api) and [RLS guide](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Current limits

- Registration and login use Supabase Auth when the frontend environment is configured. When email confirmation is enabled in Supabase, users must confirm their email before signing in.
- Demo login shortcuts remain available for local demonstration. They do not create Supabase accounts.
- If registration reports a missing profile, confirm that the migration trigger exists and that the `public` schema is exposed to the Data API.
- Profile edits, profile photos, account closure, and vehicle controls are not written to Supabase or a real vehicle service.
- The account approval screen distinguishes account approval from Driving Permission; setting one does not grant the other.
