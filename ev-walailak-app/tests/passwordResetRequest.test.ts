import assert from 'node:assert/strict';
import { test } from 'node:test';
import { requestPasswordReset, type ResetPassword } from '../src/auth/passwordResetRequest.ts';

test('sends a normalized address to the configured reset sender', async () => {
  const calls: Array<{ email: string; redirectTo: string }> = [];
  const reset: ResetPassword = async (email, options) => {
    calls.push({ email, redirectTo: options.redirectTo });
    return { error: null };
  };

  assert.deepEqual(await requestPasswordReset(' User@WU.AC.TH ', 'https://app.example', reset), { ok: true });
  assert.deepEqual(calls, [{ email: 'user@wu.ac.th', redirectTo: 'https://app.example' }]);
});

test('does not invoke Supabase for an invalid email', async () => {
  let calls = 0;
  const reset: ResetPassword = async () => {
    calls += 1;
    return { error: null };
  };

  assert.deepEqual(await requestPasswordReset('invalid', 'https://app.example', reset), { ok: false, reason: 'invalid-email' });
  assert.equal(calls, 0);
});

test('reports unavailable Supabase without sending a reset request', async () => {
  assert.deepEqual(await requestPasswordReset('user@wu.ac.th', 'https://app.example', null), { ok: false, reason: 'not-configured' });
});

test('maps returned and thrown Supabase errors to recoverable failure', async () => {
  const returnedError: ResetPassword = async () => ({ error: new Error('SMTP unavailable') });
  const thrownError: ResetPassword = async () => { throw new Error('network unavailable'); };

  assert.deepEqual(await requestPasswordReset('user@wu.ac.th', 'https://app.example', returnedError), { ok: false, reason: 'request-failed' });
  assert.deepEqual(await requestPasswordReset('user@wu.ac.th', 'https://app.example', thrownError), { ok: false, reason: 'request-failed' });
});
