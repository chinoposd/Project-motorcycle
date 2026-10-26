import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getPasswordResetFeedback } from '../src/auth/passwordResetFeedback.ts';

test('maps accepted recovery to neutral feedback', () => {
  assert.deepEqual(getPasswordResetFeedback({ ok: true }), {
    tone: 'success',
    message: 'ถ้าอีเมลนี้เป็นบัญชีผู้ใช้จริงของระบบ เราจะส่งลิงก์รีเซ็ตรหัสผ่านให้',
  });
});

test('does not show a sent state for unavailable or failed recovery', () => {
  for (const result of [
    { ok: false, reason: 'not-configured' as const },
    { ok: false, reason: 'request-failed' as const },
  ]) {
    assert.equal(getPasswordResetFeedback(result).tone, 'error');
    assert.notEqual(getPasswordResetFeedback(result).message, 'ถ้าอีเมลนี้เป็นบัญชีผู้ใช้จริงของระบบ เราจะส่งลิงก์รีเซ็ตรหัสผ่านให้');
  }
});
