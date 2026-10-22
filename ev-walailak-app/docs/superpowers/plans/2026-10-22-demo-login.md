# EV Walailak Demo Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a responsive, clearly demo-only login flow that restores a tab session and gates prototype pages by role.

**Architecture:** Keep credential matching, session validation, and role/page permissions in a small typed auth module. Render a standalone login surface before the existing app shell; pass the authenticated demo user to the shell for role-specific navigation and logout. Persist only a validated minimal user record in versioned `sessionStorage`.

**Tech Stack:** React, TypeScript, Vite, existing lucide-react icons, Node 24 built-in test runner with TypeScript stripping.

**Spec:** `docs/superpowers/specs/demo-login.md`

## Global Constraints

- This is a client-side demo only and must visibly say it is not real authentication.
- Use the existing app palette and Thai-friendly font stack.
- Do not add a backend, Supabase integration, registration, or real password reset.
- Never persist the demo password; session persistence is best-effort.
- Keep page permissions in one testable role policy and hide inaccessible navigation.

## Review Focus

- Email whitespace/case differences — test normalized email matching.
- Invalid email/password combinations — test generic rejection with no partial identity leak.
- Role-to-page boundaries and landing routes — test every role, including Admin's no-ride access.
- Corrupt/stale session data and unavailable storage — test safe rejection and best-effort flow.
- Keyboard, error, password visibility, and mobile layout — verify in rendered-browser QA.

---

### Task 1: Demo auth rules and session utilities

**Files:**
- Create: `tests/demoAuth.test.ts`
- Create: `src/auth/demoAuth.ts`
- Modify: `package.json`

**Interfaces:**
- `authenticateDemoUser(email: string, password: string): DemoUser | null`
- `getDemoCredentials(role: UserRole): { email: string; password: string }`
- `isPageAllowed(role: UserRole, page: PageId): boolean`
- `getLandingPage(role: UserRole): PageId`
- `readDemoSession(storage: SessionStorageLike): DemoUser | null`
- `writeDemoSession(user: DemoUser, storage: SessionStorageLike): void`
- `clearDemoSession(storage: SessionStorageLike): void`

- [ ] **Step 1: Write the failing tests first** — cover valid accounts and normalized email, wrong/unknown credentials, shortcut credentials for each role, every role's page permissions/landing page, session round-trip without password fields, and corrupt or unavailable storage.
- [ ] **Step 2: Add the built-in Node test script** — set `package.json` test script to `node --experimental-strip-types --test`; no new test dependency is needed.
- [ ] **Step 3: Run the focused tests and confirm RED** — run `npm test -- --test-name-pattern=demoAuth`; expected failure because `src/auth/demoAuth.ts` is not present.
- [ ] **Step 4: Implement the smallest typed helper module** — define the four demo accounts, shared password, role policy, versioned key, runtime session shape validation, and guarded storage operations.
- [ ] **Step 5: Run the focused tests and confirm GREEN** — run `npm test -- --test-name-pattern=demoAuth`; all auth tests pass.
- [ ] **Step 6: Run the complete test command** — run `npm test`; all project tests pass.

### Task 2: Responsive login surface

**Files:**
- Create: `src/pages/LoginPage.tsx`
- Add: `public/assets/ev-01-motorcycle-login.png` from the generated transparent-background cutout if alpha validation passes.
- Modify: `src/styles.css`

**Interfaces:**
- `LoginPage({ onLogin }: { onLogin: (user: DemoUser) => void })`
- Consume the auth module's demo account shortcuts and `authenticateDemoUser`.

- [ ] **Step 1: Build the controlled sign-in form** — email/password fields, submit, accessible show/hide control, generic error announcement, and four role shortcut buttons that fill but do not submit.
- [ ] **Step 2: Match the approved desktop/mobile concepts** — split navy identity area and pale form area on desktop; compact identity band and single-column form on mobile; retain the explicit demo disclosure.
- [ ] **Step 3: Run `npm run build`** — confirm strict TypeScript and Vite build pass.

### Task 3: Session gate, role-aware shell, and logout

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/AppShell.tsx`

**Interfaces:**
- `AppShell` receives a validated `DemoUser`, `onNavigate`, and `onLogout`.
- Initial app state reads session once; successful login saves the minimal record; logout clears it.

- [ ] **Step 1: Gate app rendering on demo identity** — show `LoginPage` when no valid session; successful login selects the role landing page.
- [ ] **Step 2: Apply page permissions at navigation boundaries** — render only permitted nav items and reject disallowed page selection.
- [ ] **Step 3: Add profile identity and logout** — show the signed-in name/role and return to login after clearing storage.
- [ ] **Step 4: Run `npm test` and `npm run build`** — confirm the complete suite and production build pass.
- [ ] **Step 5: Verify rendered workflow at desktop and mobile** — unauthenticated load, shortcut-fill then submit, invalid credentials, role navigation, refresh restore, logout, password toggle, and console health.
