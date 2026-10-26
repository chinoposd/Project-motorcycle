# Adminx3 Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the documented Admin web/cloud workflows on Adminx3 and accurately expose external hardware/Pilot/policy prerequisites.

**Architecture:** Extend the existing audited Supabase RPC boundary. Persist operations in normalized, RLS-protected tables, expose role-scoped snapshots and actions, and separate trusted gateway/maintenance calls from browser calls. Compose focused React panels with independent loading/error handling and share operational state with Manager and the affected user pages.

**Tech Stack:** React, TypeScript, Vite, Supabase PostgreSQL/RPC/Edge Functions, Node tests and an isolated embedded PostgreSQL test runtime.

**Spec:** `docs/superpowers/specs/2026-10-26-adminx3-completion-design.md` (approved by owner in this conversation).

## Global Constraints

- Branch Adminx3 starts at develop f9b4b5c. Existing unrelated Vite cache modifications are excluded from commits.
- Admin never drives; Student and Employee share start policies; Manager remains subject to Driving Permission and basic safety.
- No invented Pilot defaults. Null means not configured; no false live telemetry, motor confirmations or privacy deletion success.
- No client service-role/signing secrets. Authorize every RPC by current server-side profile or trusted service role, with locked search_path and explicit grants.
- Do not terminate a moving/active vehicle because of policy changes, service blocks, logout or stale data.
- Complete only actual actions; migrations/deployments and physical validation are separate, reported states.

## Review Focus

- Concurrent/stale appeals, reservations, zone edits and acknowledgments must preserve single-winner behavior and original evidence.
- Pilot updates and correction across evaluation cycles must not rewrite old cooldowns or affect unrelated restriction categories.
- A browser must not supply authoritative telemetry, Motor Ready or another user's inspection/phone/history.
- Privacy completion must require verified identity and actual fulfillment, and a cleanup job must preserve recorded legal holds.
- Missing telemetry/distance, unavailable migrations and network failures must produce honest empty/unavailable states and recoverable forms.

### Task 1: Persistence, appeals and configuration

**Files:** `supabase/migrations/*_adminx3_foundation.sql`, `tests/adminx3Database.test.ts`, `tests/helpers/operationsDb.ts`.

**Interfaces:** authenticated `admin_operations_snapshot(p_date date)`, `admin_operations_action(p_action text,p_payload jsonb)`, `my_operations_snapshot()`, `user_operations_action(p_action text,p_payload jsonb)` return JSON; tables stay inaccessible directly.

- [ ] Add isolated PostgreSQL migration-test harness and failing tests for denied callers, appeal ownership/deduplication, stale decisions, one-card replacement and audited settings.
- [ ] Generate migration with Supabase CLI; add operations tables, indexes, secure helpers, appeal/config/NFC actions and scoped snapshots.
- [ ] Run database tests and commit task files after passing.

### Task 2: Sessions, events, policy evaluation and trusted integration

**Files:** `supabase/migrations/*_adminx3_sessions.sql`, `supabase/functions/vehicle-gateway/*`, `supabase/functions/_shared/*`, `tests/adminx3Sessions.test.ts`.

**Interfaces:** `request_web_session(p_inspection_confirmed boolean,p_terms_confirmed boolean,p_request_id uuid)`, `session_owner_action(p_session_id uuid,p_action text)`, trusted `vehicle_ingest_event(p_event jsonb)` and `operations_maintenance()`; all return JSON.

- [ ] Add failing tests for Admin/permission/hours denials, Manager exceptions, server expiry, per-vehicle/user serialization, missing safety evidence, trusted-only confirmation and idempotent ingest.
- [ ] Implement reservation/session state machine, per-category evaluation cycles/cooldowns, Pilot versioning, shared alert episodes, issue reports, No-show decisions and cross-cycle compensation.
- [ ] Implement gateway authentication/replay and offline manifest/reconciliation contracts; mark unvalidated vehicle protocol unavailable.
- [ ] Verify database policy paths, trusted/browser separation, nonretroactivity, alert acknowledgment and event replay; commit after passing.

### Task 3: Operations, privacy fulfillment and GPS investigation

**Files:** `supabase/migrations/*_adminx3_workflows.sql`, `supabase/functions/privacy-worker/*`, `tests/adminx3Workflows.test.ts`.

**Interfaces:** extend operations snapshots/actions for trip corrections/reports, zones, daily statistics, inspection logs, GPS explanations and privacy verification/fulfillment/jobs. Trusted worker claims and completes jobs with actual evidence.

- [ ] Add failing tests for zone busy/stopped preconditions, historical phone privacy, missing-distance statistics, privileged trip correction, incomplete privacy closure and GPS owner access.
- [ ] Implement those workflows, audit records, required user notices/acknowledgments, policy-review/hold gates and retention deadlines.
- [ ] Implement worker access export/actual cleanup and retryable job outcomes; never run destructive operations on hosted user data during development.
- [ ] Verify role/ownership and fulfillment gates, then commit.

### Task 4: Typed client and complete Admin workspace

**Files:** `src/features/operations/*`, `src/pages/AdminPage.tsx`, `src/pages/AdminPortalPanels.tsx`, `src/auth/database.types.ts`, `src/styles.css`, `tests/adminx3Page.test.ts`.

**Interfaces:** typed operation snapshot/action clients, independently refreshed panels, shared form/error components, `AdminOperations({isDemo,onShowToast,onAccountsChanged})`.

- [ ] Add rendered tests for required sections and honest unavailable/read-only states.
- [ ] Build appeal review, operational overview/alerts/reports, zones/contact/Pilot fields, NFC, No-show/GPS review and privacy panels. Preserve accounts, announcements, permissions, hours and audit.
- [ ] Build and run affected rendered tests; commit.

### Task 5: User/Manager flow integration

**Files:** `src/pages/ApprovalStatusPage.tsx`, `src/pages/OverviewPage.tsx`, `src/pages/ManagerPage.tsx`, `src/pages/RidePage.tsx`, `src/pages/ProfileSettingsPage.tsx`, `src/pages/ManagerProfilePage.tsx`, `src/App.tsx`, feature components and related tests.

- [ ] Add failing tests for blocked-account appeals, real-account non-demo views, user Session inspection/reservation, owner history and shared Manager alerts.
- [ ] Integrate appeals, My Trips/report issue, notices, contact/NFC controls, privacy results, actual Session requests and real operational views; hide internal causes and others' locations/identity from ordinary users.
- [ ] Run affected tests and build; commit.

### Task 6: Final review, browser checks and handoff

**Files:** `docs/admin-requirements-audit.md`, `docs/supabase-admin-setup.md`, `docs/adminx3-integration.md`, plan ledger.

- [ ] Run appropriate database, client and rendered tests; run the full suite once and report any unrelated failures by name; build production assets.
- [ ] Check new Admin and user flows in browser at desktop/mobile sizes and error/empty states.
- [ ] Dispatch one fresh whole-branch reviewer (required by executing-plans); fix important findings with regression tests.
- [ ] Update requirement matrix with implemented, deployment-pending, Pilot-pending and physical-validation-pending evidence; commit code on Adminx3. Do not merge or push unless separately requested.
