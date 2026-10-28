# Forgot-password design

## Intent

Let a user with a real Supabase Auth account request a password-reset link from the login screen and safely set a new password after opening that link.

## Approaches

- Use Supabase Auth `resetPasswordForEmail` and the existing `PASSWORD_RECOVERY` event plus password-recovery page. This reuses Supabase's one-time recovery flow and keeps secrets out of the browser. **Chosen** because the app already implements the request helper and recovery screen.
- Send a custom message through an Edge Function and Resend. This adds server-side credentials, email-template maintenance, and recovery-token responsibilities without benefit for the current app.

## Scope and behavior

Add a “ลืมรหัสผ่าน?” entry point and email-request form on Login. Treat only Supabase Auth registrations as real accounts; browser-only demo accounts do not use this recovery flow. Normalize the email with trim/lowercase and validate it using the same rule as registration. Submit through Supabase Auth, show a neutral success message that does not reveal whether an account exists, and show a recoverable error when Supabase is unavailable or the request fails. The emailed redirect returns to the app's existing password-recovery handling. Keep the password requirements on the recovery page aligned with registration: 9–256 characters, lowercase, uppercase, digit, and punctuation/symbol.

## Constraints and non-goals

Actual delivery to arbitrary inboxes depends on Custom SMTP being configured in Supabase and the app redirect URL being allow-listed. This change does not configure SMTP, modify email templates, send passwords, or enable password reset for browser-only demo accounts.
