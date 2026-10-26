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

## 4. Enable the Admin portal workflows

Migration `supabase/migrations/20261026044850_admin_portal_workflows.sql` was applied to project `rmgycwhlzhyenugacbke` on 26 October 2026. Apply it to another project only after reviewing its migration history. It adds Admin-only RPCs for Driving Permission, Session hours, Pilot thresholds, announcements, personal-data requests, vehicle service state, and Audit Log. It also adds a signed-in user's own data-request form and published announcements on the Overview page.

The migration does not connect to a real vehicle or telemetry source. The Service panel records the web Admin's service-state decisions; it must not be treated as live hardware status. Session-start days/hours have no invented default, and the saved window is not yet enforced by a real Session Start backend. Cancellation/No-show values are nullable and remain unset until Pilot values are approved. Dashboard warnings will remain unavailable until real event counts are provided by the Session workflow. The application itself never applies migrations.

Announcements support role audiences, scheduled start, optional expiry, and an important notice popup shown once per signed-in user when no Session is Active. The effective publish timestamp is recorded. Test these flows with a real Admin and users of each role after migration deployment. The page shows all Admin sections even when the portal RPC is unavailable; write controls remain disabled in that state.

All portal tables have RLS enabled and direct browser table grants revoked. Use the authenticated RPCs only. The Admin must be approved. Granting Driving Permission requires an explicit confirmation that the team verified induction; it remains separate from account approval. Reopening requires both service blocks to be cleared and a final Admin confirmation with a reason. Closing a privacy request records a decision and does not itself delete or change the user's data; follow the project's retention and legal review process.
