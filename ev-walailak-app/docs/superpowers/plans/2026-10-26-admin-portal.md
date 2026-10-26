# Admin portal implementation plan

**Goal:** Implement the eight Admin workflows in `2026-10-26-admin-portal-design.md` on branch `Adminx2`.

**Architecture:** Add a Supabase migration with RLS-protected tables and Admin-only RPCs; add typed client helpers; extend AdminPage into a dashboard with working panels; add user-facing privacy request submission and active announcement display. Do not apply the migration to hosted Supabase.

## Global constraints
- Follow the reconciled handoff, especially C-094, C-058, C-123/Q67–Q69, C-125, and C-136.
- Never expose a service-role/secret key or grant broad direct table writes.
- Never invent Pilot numeric thresholds; nullable values mean unset.
- Vehicle state in this web-only slice is administrative state, not live hardware telemetry.

## Tasks
1. **Database workflow model** — create migration for permission/induction audit, singleton Admin settings, threshold config, announcements, privacy requests, vehicle service control, and append-only Admin audit records. Add Admin-checked RPCs for list/update actions and user privacy request submission/listing.
2. **Typed Supabase client** — add RPC/table result types and a `adminPortal.ts` service with safe parsing and error states.
3. **Admin dashboard and Driving Permission** — add dashboard counts, approved users without permission, and an explicit induction confirmation before grant/revoke; preserve distinction from account approval.
4. **Session hours and Pilot thresholds** — persist hours; expose nullable cancellation/no-show counts and cooldowns; display effective-from time and no fabricated defaults.
5. **Privacy requests and announcements** — allow users to submit requests; Admin can review with status/notes; Admin can publish/retire announcements and Overview displays active ones.
6. **Audit and vehicle service** — browse Admin log; allow Admin manual out-of-service and final reopen only after blockers cleared, with reason and audit.
7. **Styles, docs, and verification** — responsive Admin panels and honest empty/unavailable states; document migration setup; inspect the diff and run the app build (not test suite).

## Review focus
- Unapproved/non-Admin callers cannot read or mutate Admin records.
- Permission grant cannot bypass `Approved` or induction confirmation.
- Null Pilot settings never become implicit numeric defaults.
- Updating settings never retroactively changes earlier evaluations.
- A vehicle cannot reopen while either blocker remains.
- Privacy request actions never imply deletion was executed.
- Hidden/unpublished announcements are not shown to users.
- Admin audit records are append-only and writes are atomic with the corresponding mutation.
