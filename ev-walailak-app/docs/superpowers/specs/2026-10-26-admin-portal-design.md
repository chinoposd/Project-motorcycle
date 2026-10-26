# Admin portal workflows design

## Intent
Implement the eight requested Admin areas in the existing EV Walailak React/Vite app, following the reconciled project handoff. Persist web-managed records through Supabase; keep demo mode visibly local/read-only. Do not control hardware or mutate a live Supabase project.

## Goals
- Separate account approval from Driving Permission and require an induction confirmation before granting permission.
- Persist Student/Employee Session hours; Manager is exempt.
- Allow configuring cancellation/no-show limits and cooldowns without invented Pilot values; changes apply only to later evaluations.
- Let signed-in users submit personal-data requests and Admins review them under the stated retention policy.
- Manage web announcements and show active announcements to app users.
- Record and browse Admin actions.
- Support manual vehicle service state and require explicit final Admin confirmation before reopening after safety/manual blocks are cleared.
- Provide a summary dashboard, with explicit empty/unavailable states where event or vehicle feeds do not exist yet.

## Non-goals
- Real vehicle commands, telemetry, NFC, or ESP32/Pi integration.
- Inventing pilot thresholds, legal determinations, or implementing deletion workflows without a reviewed retention/legal process.
- Applying migrations to a hosted Supabase project.

## Approaches
- Supabase-backed RPC workflows (chosen): secure cross-device records and auditable Admin actions; requires owner to apply migration before live use.
- Browser-only local storage: fast demo, but not suitable for multi-admin workflows or durable audit and requests.
- Direct browser table writes: rejected because Admin authorization and atomic audit records must be enforced server-side.

## Constraints and decisions
- Keep the current visual language and existing `AdminPage` entry point.
- All privileged mutations go through narrowly scoped Postgres functions that check approved Admin status; RLS remains enabled and direct table access is revoked.
- Numeric cancellation/no-show settings default to unset and warnings say data is unavailable until event data exists.
- An announcement is shown to ordinary users only while published and within its optional schedule.
- Reopening is allowed only after manual OUT_OF_SERVICE and Safety Block are cleared and an Admin explicitly confirms.
- Privacy requests are recorded with type, description, status, reviewer, decision note, and timestamps; no automatic data deletion is performed.
