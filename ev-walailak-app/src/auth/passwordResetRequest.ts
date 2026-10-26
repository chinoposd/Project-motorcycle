import { isValidAuthEmail, normalizeAuthEmail } from './emailAddress.ts';

export type PasswordResetResult =
  | { ok: true }
  | { ok: false; reason: 'invalid-email' | 'not-configured' | 'request-failed' };

export type ResetPassword = (
  email: string,
  options: { redirectTo: string },
) => Promise<{ error: unknown | null }>;

export async function requestPasswordReset(
  email: string,
  redirectTo: string,
  reset: ResetPassword | null,
): Promise<PasswordResetResult> {
  if (!isValidAuthEmail(email)) return { ok: false, reason: 'invalid-email' };
  if (!reset) return { ok: false, reason: 'not-configured' };

  try {
    const { error } = await reset(normalizeAuthEmail(email), { redirectTo });
    return error ? { ok: false, reason: 'request-failed' } : { ok: true };
  } catch {
    return { ok: false, reason: 'request-failed' };
  }
}
