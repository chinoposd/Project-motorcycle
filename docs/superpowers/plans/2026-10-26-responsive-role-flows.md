# Responsive Web App and Role Flows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. Keep existing user changes intact.

**Goal:** Make all EV Walailak screens work across desktop/mobile and connect role-specific journeys into a coherent, honest browser prototype.

**Architecture:** `App.tsx` remains the authenticated application coordinator and role access boundary. Add one typed, versioned local prototype store for vehicle/session, issue/alert, account/service demo, and audit state; pass state and actions into pages. Keep Supabase Auth operations in the existing auth layer and do not add schema/policy or vehicle-control services. Reuse the current theme and page components while centralizing responsive shell/utility dialogs where useful.

**Tech Stack:** React, TypeScript, Vite, CSS, existing Supabase JS client and lucide-react. Do not add dependencies. Do not add or run tests unless the user asks; run the existing production build as an implementation check.

## File map

- `ev-walailak-app/src/types.ts` — typed role, navigation, prototype workflow, incident, and audit record shapes.
- `ev-walailak-app/src/data/prototypeState.ts` (new) — versioned local-storage read/write, defaults, validation, and failure fallback for non-secret prototype state.
- `ev-walailak-app/src/App.tsx` — initialize and coordinate shared demo state; route/role guard; sign-in/register/recovery callback outcomes; actions for session, reports, alerts, account/service updates and utilities. Preserve in-progress breadcrumb props and user edits.
- `ev-walailak-app/src/auth/demoAuth.ts` — retain existing four demo shortcuts and auth format; add only safe integration points if needed.
- `ev-walailak-app/src/auth/supabaseAuth.ts` and `src/auth/supabaseClient.ts` — reuse existing Supabase Auth helpers/client; no privileged client-side profile writes or schema changes.
- `ev-walailak-app/src/pages/LoginPage.tsx`, `RegisterPage.tsx`, `ApprovalStatusPage.tsx`, `src/components/PasswordRecoveryDialog.tsx` (new) — connect real auth when configured, keep demo behavior explicit, and provide a consistent recovery path.
- `ev-walailak-app/src/pages/OverviewPage.tsx`, `RidePage.tsx`, `src/components/VehiclePanel.tsx`, `SessionWorkflow.tsx` — complete the driver demo journey with preflight, active/paused same-session resume, end confirmation, completion/history, and issue reporting entry points.
- `ev-walailak-app/src/pages/ManagerPage.tsx` and `ManagerRidePage.tsx` (if present; otherwise the current Manager ride view) — consume shared active vehicle/session state, handle alerts and local inspection outcomes, expose telephone contact only while a phone is available for the active session.
- `ev-walailak-app/src/pages/AdminPage.tsx` — make mock account, Driving Permission, service setting, announcement, privacy request and local audit flows visibly update with reasons; keep all of these isolated from real Supabase account data.
- `ev-walailak-app/src/components/AppShell.tsx`, reusable utility/confirmation dialog component(s), and `ev-walailak-app/src/styles.css` — role-safe navigation, help/utility surfaces, responsive layouts, touch targets, focus states, dialog/mobile behavior. Keep the existing breadcrumb changes.

## Tasks

### Task 1: Add the local prototype state contract

**Files:** `src/types.ts`, new `src/data/prototypeState.ts`, `src/data/mockData.ts`.

- [ ] Define one-vehicle demo state: active Session owner and status, per-user completed trip summary, issue records, alerts, mock account status plus separate Driving Permission, service settings, and audit entries.
- [ ] Add a versioned browser-store adapter that validates parsed data, handles unavailable/corrupt storage with safe initial mock state, and never stores credentials, tokens, phone location history, or Supabase user data.
- [ ] Seed state from existing mock records and provide pure update helpers for Session transition, report creation, alert acknowledgement, inspection resolution, Admin decisions, and audit append. Prevent resolving an alert from implicitly clearing a safety issue.
- [ ] Keep one current vehicle Session shared with Manager/Admin monitoring; scope user trip summaries to the trip owner.

**Check:** Types and storage helper compile; corrupted or inaccessible storage returns safe demo state without claiming persistence.

### Task 2: Coordinate typed app flows and preserve role boundaries

**Files:** `src/App.tsx`, `src/types.ts`, `src/auth/demoAuth.ts` only if required.

- [ ] Replace the three-value UI-only Session flag with the typed prototype lifecycle needed by the demo journey (idle, preflight/reserved, active, paused, pending end, completed) without representing a client check as hardware confirmation.
- [ ] Initialize shared prototype state once; connect each action to a reducer/store update and persist local demo mutations. Preserve current breadcrumb props, login restoration, logout reset behavior, current user profile persistence, and pre-existing uncommitted edits.
- [ ] Keep `isPageAllowed` as the centralized gate for nav, breadcrumbs, and utility links; send disallowed destinations to the role landing page.
- [ ] Ensure Student/Employee can see only their own trip summaries; Manager/Admin can see only the active driver's operational details; an ended Session no longer exposes a driver's phone to Manager.
- [ ] Add typed view state for help, usage guide, announcements, trip history, issue report, inspection, audit log, and privacy request so every visible utility action has a destination and return path.

**Check:** Existing navigation and auth restoration code paths still compile; role-specific destinations cannot bypass `isPageAllowed`.

### Task 3: Connect Supabase and demo authentication journeys

**Files:** `src/pages/LoginPage.tsx`, `src/pages/RegisterPage.tsx`, new `src/components/PasswordRecoveryDialog.tsx`, `src/App.tsx`, `src/auth/supabaseAuth.ts` only for missing client-auth helpers.

- [ ] On configured Supabase projects, sign-in uses the existing `signInWithSupabase`; on unconfigured projects, retain the four current demo shortcuts and local demo login.
- [ ] On configured projects, registration validates Student/Employee input and uses the existing `signUpWithSupabase`, including confirmation-required and Pending approval states. Do not treat local form validation as account creation.
- [ ] Add a recovery form styled like registration and use Supabase `resetPasswordForEmail` for real accounts; show honest no-email-sent copy for demo or unconfigured auth.
- [ ] Route callback errors/success to accessible inline feedback; preserve return/back/close paths and do not persist passwords.
- [ ] Update `App.handleLogin` to distinguish Supabase identities from demo identities: never write a Supabase user to demo session storage or sign the user out while handling a successful Supabase login.
- [ ] Preserve account approval gate and current static demo account format; keep Admin mock decisions separate from Supabase profiles.

**Check:** Existing auth helper contracts and approval-state mapping compile; real and demo branches show distinct outcomes.

### Task 4: Complete the Student/Employee browser prototype journey

**Files:** `src/pages/OverviewPage.tsx`, `src/pages/RidePage.tsx`, `src/components/VehiclePanel.tsx`, `src/components/SessionWorkflow.tsx`, `src/App.tsx`, new reusable dialog(s), `src/data/prototypeState.ts`.

- [ ] Replace toast-only overview history, guide, announcements, and report actions with typed views/dialogs and working back navigation.
- [ ] Make Start open a labeled demo preflight/reservation step. Confirming advances local prototype state only; account/permission/vehicle checks must be described as sample policy data, never as server authorization or physical inspection.
- [ ] Make pause/resume preserve the same Session ID and owner. The UI explicitly says offline NFC Resume would only resume that existing Session; the website does not implement offline NFC actions.
- [ ] Make End require user confirmation, keep unverified return/safety conditions visibly simulated, then show a completion summary and return to the user's own history/dashboard.
- [ ] Add a report form with validation and severity: a high-severity demo report prevents a new demo Session but does not alter an active Session; lower severity creates an alert without blocking start.

**Check:** Each stage has a clear next/back action, status label, and explicit local-demo notice.

### Task 5: Connect Manager and Admin operational actions

**Files:** `src/pages/ManagerPage.tsx`, Manager ride view component, `src/pages/AdminPage.tsx`, `src/App.tsx`, `src/data/prototypeState.ts`, reusable dialog(s).

- [ ] Manager overview reads the shared active Session and vehicle issues; Manager ride view controls only the current demo Session, not a second vehicle Session.
- [ ] Alert acknowledgement updates unread count and audit state but never resolves the underlying Safety Block.
- [ ] “Call driver” is a `tel:` action only for an active mock Session with a phone number; no contact link is rendered after end.
- [ ] Manager/Admin inspection actions record actor, result, reason, and time in the local demo audit trail. A resolved demo Safety Block does not override Admin Manual OUT_OF_SERVICE; Admin reopening and final demo availability confirmation remain separate.
- [ ] Admin account status, Driving Permission, service hours, announcements, privacy request, and audit views have working save/cancel paths, reason validation where required, and visibly updated local data. None writes real Supabase profile or authorization data.
- [ ] Keep Admin outside all driver actions.

**Check:** Local status changes are visible across app views, have matching audit entries, and cannot cause a real auth/vehicle side effect.

### Task 6: Finish responsive behavior and accessible navigation on all pages

**Files:** `src/components/AppShell.tsx`, auth/profile/overview/ride/Manager/Admin screens, shared dialogs, `src/styles.css`.

- [ ] Check the existing breakpoints and correct only the gaps: compact mobile navigation, stack dashboard grids and form columns, keep map controls and statuses visible, contain table scrolling, and prevent page-level horizontal overflow.
- [ ] Apply responsive behavior to Login, registration, recovery, approval status, overview, ride, both Manager views, both profile variants, and Admin.
- [ ] Make menu/dialog controls keyboard reachable with visible focus, accessible names, escape/close behavior, and touch-sized buttons; keep heading/order/breadcrumb semantics.
- [ ] Preserve EV Walailak navy/blue styling and current page visual language.

**Check:** Every listed screen has an intentional desktop/mobile layout and all navigation/actions remain reachable at narrow widths.

### Task 7: Connect final cross-page destinations and implementation check

**Files:** `src/App.tsx`, `src/components/AppShell.tsx`, affected page files, `src/styles.css`.

- [ ] Sweep all actionable buttons/links, including Help, breadcrumb, return-to-dashboard, account review, settings save, inspection, guide, announcements, issue reporting, history, and dialogs. Remove any toast-only placeholder or convert it into an explicitly informational message when no action is intended.
- [ ] Check that every modal/detail view has a close/back route, every submit has validation and visible outcome, and every role-restricted action remains guarded.
- [ ] Run `npm run build` from `ev-walailak-app`; resolve implementation compile/build errors without altering unrelated generated/cache files.
- [ ] Do not add or run the test suite unless the user asks. Do not commit or push.

## Review focus

- Shared single-vehicle Session versus driver-private trip/contact data (requirements C-042–C-044).
- High severity report blocking new starts without stopping Active Session; acknowledgement does not resolve it (C-050–C-058).
- Account approval and Driving Permission are separate; static demo shortcuts remain compatible; Admin mock operations do not imply Supabase writes (C-083–C-088, C-136).
- A demo End cannot be presented as a real Return Zone/stopped/Motor Ready confirmation (C-020–C-032, C-141–C-143).
- NFC offline Resume is same-session-only, and no web/offline claim should imply a new offline start is available without a Signed Offline Manifest (C-026, C-142, C-145–C-149).
- Storage loss, invalid local state, no active Session, missing driver contact, and small-screen navigation all have non-misleading outcomes.
