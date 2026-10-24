# Supabase Admin account review setup

The Admin account review page uses database RPCs to list and decide Pending accounts. Apply the migration and provision at least one trusted Admin account before using that page against the live Supabase project.

## 1. Apply the migration

Confirm the project selected in the Supabase Dashboard is the intended project. Open **SQL Editor**, create a new query, paste the complete contents of `supabase/migrations/20261024130000_admin_account_review.sql`, review it, and run it. This migration creates the append-only review audit table and two Admin-only RPCs. It does not change existing accounts or send email.

Alternatively, if the Supabase CLI is already linked to the intended project, run `npx supabase db push` from `ev-walailak-app` and review the pending migration list before confirming.

## 2. Provision the first Admin

The first Admin must be assigned by the project owner. First create a normal account for the trusted person through the app and confirm that its Auth user and `public.profiles` row exist. Verify the email and account identity in the dashboard before changing its profile.

In **SQL Editor**, replace the email placeholder below with the exact trusted account email, then run the query and confirm it returns exactly one profile:

```sql
select
  p.id,
  u.email,
  p.full_name,
  p.role,
  p.account_status
from public.profiles as p
join auth.users as u on u.id = p.id
where lower(u.email) = lower('REPLACE_WITH_TRUSTED_ADMIN_EMAIL');
```

After verifying the returned account, use its exact UUID in this update:

```sql
update public.profiles
set role = 'Admin',
    account_status = 'Approved',
    updated_at = now()
where id = 'REPLACE_WITH_VERIFIED_AUTH_USER_UUID';
```

Confirm the update affected exactly one row and the account is still `driving_permission = false` unless a separate, authorized vehicle-permission review has been completed. Keep the initial Admin identity restricted to a trusted project owner. Never grant Admin through registration or browser code.

## 3. Sign in and review accounts

Sign in with that provisioned account using Supabase Auth. The account must have both `role = 'Admin'` and `account_status = 'Approved'`. The Admin page will then show Pending applicants from Supabase. Verify each person's university affiliation outside the app, select the verified applicant role, check the affiliation confirmation, and approve or reject one account at a time. A rejection requires a reason. Approval does not grant Driving Permission.

If the RPC is missing, apply the migration and restart/refresh the app. If access is denied, verify the signed-in account's profile role and status. If a request fails, inspect the Supabase project and migration history; do not add a service-role key to the frontend.

## Scope of this migration

Only Pending-account listing, individual review, and its audit write are connected. Service hours, service open/close, announcements, personal-data requests, and audit-log browsing remain unavailable from the app in this first slice. The audit table has no direct browser-client grants; the RPCs are the only client-callable path for the review workflow.
