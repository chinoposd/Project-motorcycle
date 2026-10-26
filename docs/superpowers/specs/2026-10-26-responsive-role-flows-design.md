# Responsive Web App and Role Flow Design

## Intent

Make every existing EV Walailak page usable on desktop and mobile, and connect the visible actions into a coherent browser prototype. The app should let users follow the intended journey for their role without dead-end controls, while clearly distinguishing demo state from real authentication, vehicle data, and vehicle commands.

## Goals

- Keep the existing React, TypeScript, Vite, Supabase Auth, visual theme, and role model.
- Make the shell, authentication screens, dashboards, ride screens, profile screens, and admin tools work without horizontal page overflow on narrow screens and remain readable on desktop.
- Ensure every primary control navigates to an allowed page or opens a useful view/dialog with a working close/back path.
- Connect the student/employee demo journey across overview, preflight, active ride, pause/resume, and simulated completion.
- Connect Manager monitoring actions and Admin account/service actions to shared prototype state and visible outcomes.
- Keep role authorization in the app-level navigation guard; do not expose restricted routes through breadcrumbs or contextual links.
- Keep demo account shortcuts available in their current format, and connect the sign-in, registration, and password-recovery screens to the existing Supabase Auth services when configured.

## Non-goals and safety boundary

- No PWA manifest, install prompt, service worker, or offline web operation.
- No vehicle hardware, NFC, GPS, BMS, geofence, Motor Ready, or real-time command integration.
- No new Supabase tables, policies, Edge Functions, or privileged account-management writes. Do not make Admin's mock account actions appear to update real Supabase accounts.
- Demo session and admin/manager actions must be labeled as local prototype data. They must not claim that a real vehicle was reserved, checked, unlocked, stopped, inspected, or returned.
- The offline NFC rule remains explicit: NFC resume can only re-enter the same existing paused Session; it cannot start a new Session. This feature is informational only in this web prototype.

## Approaches considered

1. **Responsive pages plus connected prototype flows (selected).** Reuse current React state and page components; make primary actions lead to working, role-aware screens or dialogs. This fits the selected scope and avoids implying hardware/backend readiness.
2. **Add installable/offline PWA support.** Adds a service worker and offline shell, but does not make NFC or vehicle commands work; outside the selected scope.
3. **Connect backend and real vehicle workflows.** Requires trusted backend/Edge Functions, database policies, firmware APIs, and verified hardware safety signals; the current frontend and available project context are insufficient.

## Existing application context

- `ev-walailak-app/src/App.tsx` owns authentication restore, role-gated page selection, profile actions, demo Session status, alert acknowledgement, and shared navigation.
- `src/auth/demoAuth.ts` defines Student, Employee, Manager, and Admin page access and their landing pages.
- `AppShell` already provides role-filtered navigation, profile access, logout, prototype status, and an in-progress breadcrumb change in the working tree.
- Existing responsive CSS covers several common breakpoints, but page-specific behavior and interaction coverage are not consistent. Overview history/manual/announcements, help, some Manager actions, and Admin tools still end in toast-only placeholder actions.
- `RidePage` and `VehiclePanel` are demo controls. Real Supabase users cannot send vehicle commands, and the project requirements reserve safety confirmation for backend and vehicle hardware.
- `supabaseAuth.ts` already defines real sign-in and sign-up helpers, but `LoginPage.tsx` currently authenticates only local demo accounts and the registration form only validates locally. Wire these existing screens to the auth helpers without changing the database schema or weakening the role/approval checks.

## Proposed behavior

### Shared shell and responsive layout

- Keep role-filtered navigation and breadcrumbs as the primary route map; make page identity and back navigation consistent on every signed-in page.
- At mobile width, collapse navigation into a keyboard-accessible menu or compact navigation layout, retain visible profile/logout access, and provide touch-sized controls. Layout grids stack in a deliberate reading order; data tables may scroll inside their own container, never across the whole page.
- Apply the same responsive rules to login, registration, password recovery, approval status, overview, ride, Manager, profile settings, and Admin screens.
- All dialogs have a clear title, close/cancel route, focusable actions, and no nested horizontal scroll.

### Student and Employee flow

`Login/Register/Approval -> Overview -> preflight checklist -> simulated Session -> Ride -> pause/resume same Session -> confirm simulated return -> completion summary -> Overview/history`.

- Overview actions open their corresponding history, usage guide, announcement list, and vehicle issue-report views instead of placeholder toasts.
- Starting a demo Session opens a preflight view with prototype-only checks and a clear statement that it is not a server authorization or real vehicle safety inspection. Confirming it advances only the local demo state.
- Pause and resume keep the same demo Session. Ending requires a confirmation and shows a completion summary; it must not be labeled as a real successful return.
- One vehicle state and its active Session/report state are shared across roles in the local prototype. Manager/Admin can see the current driver's name, role, start time, and latest vehicle location only while that Session is active. Driver trip history remains private to that driver and Manager does not receive a driver's phone number after the Session ends (C-042–C-044).
- A user can report a vehicle issue through a validated local prototype form. High-severity reporting creates a demo Safety Block that prevents a new demo Session; it never interrupts the current active Session. Lower-severity reports create an alert without automatically blocking a new Session (C-056–C-058).
- History is user-scoped within the active browser prototype and cannot be edited or deleted by the user.

### Manager flow

`Manager landing -> operational overview -> inspect active demo session / review alerts -> acknowledge or record an inspection result -> Manager ride view / Manager profile`.

- Overview and ride views remain distinct: overview monitors operational context; ride view is the Manager's own demo ride screen.
- Alert acknowledgement updates the alert list and unread count. It never clears a safety issue or Safety Block.
- “Call driver” uses a `tel:` link only when a mock Active Session has a phone number; otherwise it explains that no contact is available.
- Vehicle inspection opens a form for notes and a local outcome. A demo Safety Block can be resolved only through an inspection action allowed to Manager/Admin; a separate Admin Manual OUT_OF_SERVICE state still requires Admin reopening and final availability confirmation. These are local simulations, not evidence of an actual vehicle inspection or production release (C-058, C-125).

### Admin flow

`Admin landing -> search/filter account -> inspect -> approve/reject/suspend with reason -> review local audit trail; service settings -> edit -> save -> see applied local state`.

- Account status changes, service hours, service availability, announcements, audit entries, and privacy request examples must visibly update in prototype state and persist only in the current browser's local demo store when that can be done without changing real Supabase account data. Account actions affect only the Admin demo directory and its local audit history; they do not affect demo role shortcuts or real Supabase identities.
- Keep Account Approved separate from Driving Permission in both labels and state; Admin-only demo permission updates are distinct actions.
- Rejection, suspension, permission changes, and service changes require a reason and record who/when in the local demo audit trail.
- Admin is never offered as a vehicle driver.

### Authentication and approval flow

- Keep the four existing demo role shortcuts and their current credentials format.
- When Supabase is configured, sign-in and sign-up use the existing `supabaseAuth.ts` helpers. Registration remains limited to Student/Employee, account status is loaded from the profile, and unapproved users reach the approval-status view.
- Connect password recovery to Supabase's password reset email flow for real accounts. Demo account password recovery must say no email was sent and offer a clear way back.
- When Supabase is not configured, present honest demo-only behavior; never claim an email was sent or a persistent real account was created.
- When logged out or awaiting account approval, restricted app navigation is unavailable.

## Constraints and implementation calls

- Use existing React/TypeScript components and CSS; no new dependencies.
- Keep route identifiers typed and authorization checks centralized. Contextual utilities may use a small typed modal/view state rather than expanding all of them into top-level routes.
- Reuse current mock data but elevate mutable data to the appropriate app-level state so changes survive page navigation.
- Respect the current uncommitted changes to `App.tsx`, `AppShell.tsx`, `styles.css`, `dist`, and Vite cache files; integrate around them rather than reverting them.
- Do not commit or push as part of this request.
- Verification will include a production build and manual rendered checks on desktop and mobile. Automated tests will only be run if explicitly requested.

## Acceptance criteria

1. Every existing page renders at desktop and mobile widths without page-level horizontal overflow, clipped primary controls, or inaccessible navigation.
2. Every primary navigation link, breadcrumb, call-to-action, and page action has a working destination, state update, or dialog and a valid way back.
3. A Student/Employee can complete the entire demo flow from overview through simulated completion and return to history/overview.
4. Manager can move between monitoring and own ride views, acknowledge alerts, contact a mock active driver when available, and record a local inspection result; acknowledgement does not remove a block.
5. Admin can review demo accounts, apply reasoned status/permission/service updates, and inspect a local audit trail. Admin cannot start a ride.
6. Page access remains role-filtered after direct or contextual navigation.
7. The UI consistently discloses which values and actions are demo/local and never claims real vehicle safety confirmation or a hardware command.
8. Real sign-in, registration, password recovery, and approval status use existing Supabase Auth/Profile helpers when configured; the four demo shortcuts remain available and visually distinct.
9. Admin demo account actions are clearly local and do not appear to update real Supabase users.

## Open choices left to implementation

- Exact mobile navigation pattern, chosen to fit existing header styles and labels without adding dependencies.
- Exact reusable dialog/view component boundaries.
- The local prototype storage key/schema version and fallback behavior when browser storage is unavailable.
- Which low-priority legal/administrative links can share a single informational panel rather than separate routes.
