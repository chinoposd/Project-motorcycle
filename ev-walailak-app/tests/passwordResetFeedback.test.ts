import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getPasswordResetFeedback,
  getVisiblePasswordResetFeedback,
  isPasswordResetFeedbackForEmail,
} from '../src/auth/passwordResetFeedback.ts';

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

test('only shows reset feedback for the email that was submitted', () => {
  assert.equal(isPasswordResetFeedbackForEmail('user@example.com', 'user@example.com'), true);
  assert.equal(isPasswordResetFeedbackForEmail('User@Example.com', ' user@example.com '), true);
  assert.equal(isPasswordResetFeedbackForEmail('user@example.com', 'changed@example.com'), false);
});

test('hides a completed or pending reset result after the email changes', () => {
  const feedback = getPasswordResetFeedback({ ok: true });
  const requestState = { requestedEmail: 'first@example.com', feedback };

  assert.deepEqual(getVisiblePasswordResetFeedback(requestState, ' FIRST@example.com '), feedback);
  assert.equal(getVisiblePasswordResetFeedback(requestState, 'corrected@example.com'), null);
});
