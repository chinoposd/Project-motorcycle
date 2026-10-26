# Forgot Password Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users registered through Supabase Auth request an email reset link and set a new password under the same email and password rules used during registration.

**Architecture:** Reuse Supabase Auth `resetPasswordForEmail`, the existing `PASSWORD_RECOVERY` handler, and `PasswordRecoveryPage`. Extract shared email normalization/validation so registration and recovery cannot drift; expose a typed reset result so Login can distinguish local validation, missing Supabase configuration, and request failure without revealing whether an account exists.

**Tech Stack:** React, TypeScript, Supabase JS v2, Node's built-in test runner, Vite SSR rendering for page tests.

**Spec:** `docs/superpowers/specs/2026-10-26-forgot-password-design.md`

## Global Constraints

- Only Supabase Auth accounts can receive reset links; browser-only demo accounts remain outside this flow.
- Normalize emails with `trim().toLowerCase()` and validate with the registration email pattern `^[^\s@]+@[^\s@]+\.[^\s@]+$`.
- Never reveal whether a submitted email belongs to an account; accepted requests use neutral wording.
- Keep recovery password rules identical to signup: 9–256 characters, lowercase, uppercase, digit, and punctuation/symbol.
- Use the existing redirect-to-app-origin recovery flow; do not add service-role keys or configure Supabase SMTP from frontend code.

## Review Focus

- Mixed-case or padded email must resolve to the same account as signup — pin normalization in `tests/emailAddress.test.ts` and the reset-request test.
- Invalid email must not invoke Supabase — pin in `tests/passwordResetRequest.test.ts`.
- A missing Supabase client or request error must not show the “email sent” state — pin result reasons in `tests/passwordResetRequest.test.ts` and error feedback in `tests/passwordResetFeedback.test.ts`.
- A successful request must not reveal account existence — assert the neutral success copy in `tests/passwordResetFeedback.test.ts`.
- Demo shortcuts and registration navigation must remain intact after adding the reset view — assert in `tests/loginPageFormat.test.ts`.

---

### Task 1: Share registration validation and test the Supabase reset request

**Files:**
- Create: `ev-walailak-app/src/auth/emailAddress.ts`
- Create: `ev-walailak-app/src/auth/passwordPolicy.ts`
- Create: `ev-walailak-app/src/auth/passwordResetFeedback.ts`
- Create: `ev-walailak-app/src/auth/passwordResetRequest.ts`
- Modify: `ev-walailak-app/src/auth/supabaseAuth.ts`
- Modify: `ev-walailak-app/src/pages/PasswordRecoveryPage.tsx`
- Create: `ev-walailak-app/tests/emailAddress.test.ts`
- Create: `ev-walailak-app/tests/passwordPolicy.test.ts`
- Create: `ev-walailak-app/tests/passwordResetFeedback.test.ts`
- Create: `ev-walailak-app/tests/passwordResetRequest.test.ts`

**Interfaces:**
- Produces `normalizeAuthEmail(value: string): string` and `isValidAuthEmail(value: string): boolean`.
- Produces `isValidAuthPassword(value: string): boolean` and uses it in both signup and password recovery.
- `ResetPassword` is `(email: string, options: { redirectTo: string }) => Promise<{ error: unknown | null }>`.
- Produces `requestPasswordReset(email: string, redirectTo: string, reset: ResetPassword | null): Promise<PasswordResetResult>` where `PasswordResetResult` is `{ ok: true } | { ok: false; reason: 'invalid-email' | 'not-configured' | 'request-failed' }`.
- Produces `getPasswordResetFeedback(result: PasswordResetResult): { tone: 'success' | 'error'; message: string }`; its success copy does not confirm account existence.
- `sendSupabasePasswordReset(email: string): Promise<PasswordResetResult>` adapts the production Supabase client's `auth.resetPasswordForEmail` to that tested request function; preserve the existing `.ok` consumer in `App.tsx`.

- [ ] **Step 1: Write failing email-rule and reset-request tests**

  Name tests `normalizes email like Supabase signup`, `uses the signup email format`, `keeps reset passwords within signup policy`, `maps accepted recovery to neutral feedback`, and `sends a normalized address to the configured reset sender`. Assert `normalizeAuthEmail(' User@WU.AC.TH ') === 'user@wu.ac.th'`; a malformed email is rejected; `Abcdef12!` is valid, an 8-character password is invalid, and a 257-character password is invalid. Assert accepted recovery returns the exact neutral copy `ถ้าอีเมลนี้เป็นบัญชีผู้ใช้จริงของระบบ เราจะส่งลิงก์รีเซ็ตรหัสผ่านให้`; for the reset sender, assert invalid email does not call it, valid email passes `'user@wu.ac.th'` and `'https://app.example'`, a missing sender returns `not-configured`, and returned/thrown sender errors return `request-failed`.

- [ ] **Step 2: Run the focused tests and verify they fail for the missing exports**

  Run from `ev-walailak-app`: `node --experimental-strip-types --test tests/emailAddress.test.ts tests/passwordPolicy.test.ts tests/passwordResetFeedback.test.ts tests/passwordResetRequest.test.ts`
  Expected: FAIL because the shared validation and reset-request modules do not exist yet.

- [ ] **Step 3: Implement the shared helpers and wire signup/reset to them**

  Use the exact `email` regular expression from Global Constraints. Update `signUpWithSupabase` to use the shared email and password validators without changing registration outcomes. Update `PasswordRecoveryPage` to use the same password validator and enforce the 256-character maximum. Return a typed reset failure reason while keeping the existing `.ok` contract. Map reset results with `getPasswordResetFeedback` so Login uses one tested neutral success message.

- [ ] **Step 4: Run focused tests and verify they pass**

  Run: `node --experimental-strip-types --test tests/emailAddress.test.ts tests/passwordPolicy.test.ts tests/passwordResetFeedback.test.ts tests/passwordResetRequest.test.ts`
  Expected: all focused assertions pass.

- [ ] **Step 5: Commit the service and tests**

  Run this commit step from the repository root:

  ```bash
  git add docs/superpowers/specs/2026-10-26-forgot-password-design.md docs/superpowers/plans/2026-10-26-forgot-password.md ev-walailak-app/src/auth/emailAddress.ts ev-walailak-app/src/auth/passwordPolicy.ts ev-walailak-app/src/auth/passwordResetFeedback.ts ev-walailak-app/src/auth/passwordResetRequest.ts ev-walailak-app/src/auth/supabaseAuth.ts ev-walailak-app/src/pages/PasswordRecoveryPage.tsx ev-walailak-app/tests/emailAddress.test.ts ev-walailak-app/tests/passwordPolicy.test.ts ev-walailak-app/tests/passwordResetFeedback.test.ts ev-walailak-app/tests/passwordResetRequest.test.ts
  git commit -m "feat: align Supabase password reset with signup"
  ```

### Task 2: Add the forgot-password flow to Login

**Files:**
- Modify: `ev-walailak-app/src/pages/LoginPage.tsx`
- Modify: `ev-walailak-app/tests/loginPageFormat.test.ts`
- Modify: `ev-walailak-app/src/styles.css` only if the new form needs a distinct layout rule.

**Interfaces:**
- Consumes `sendSupabasePasswordReset(email)` from Task 1.
- Login owns `login | forgot-password` view state. The reset form starts with the current login email, includes a back-to-login action, and does not render demo shortcuts or registration controls while active.

- [ ] **Step 1: Write the failing Login rendering test**

  Name it `login exposes forgot-password without removing registration or demo shortcuts`. Assert the initial Login screen exposes an accessible “ลืมรหัสผ่าน?” button while retaining the original registration action and all four demo-role shortcuts.

- [ ] **Step 2: Run the focused test and verify it fails because the entry point is absent**

  Run: `node --experimental-strip-types --test tests/loginPageFormat.test.ts`
  Expected: FAIL on the missing forgot-password control.

- [ ] **Step 3: Implement the reset-request view and submit states**

  Prefill from the login email; validate using Task 1; submit with a pending state. On accepted request show neutral copy (“ถ้าอีเมลนี้เป็นบัญชีผู้ใช้จริงของระบบ เราจะส่งลิงก์รีเซ็ตรหัสผ่านให้”); on missing config or failure show recoverable guidance. Leave demo shortcuts and registration form behavior unchanged.

- [ ] **Step 4: Run focused tests, full suite, and production build**

  Run from `ev-walailak-app`: `node --experimental-strip-types --test tests/loginPageFormat.test.ts`, then `npm test`, then `npm run build`.
  Expected: all tests pass and TypeScript/Vite build completes.

- [ ] **Step 5: Commit the Login UI and test**

  Run this commit step from the repository root:

  ```bash
  git add ev-walailak-app/src/pages/LoginPage.tsx ev-walailak-app/src/styles.css ev-walailak-app/tests/loginPageFormat.test.ts
  git commit -m "feat: add forgot-password flow to login"
  ```
