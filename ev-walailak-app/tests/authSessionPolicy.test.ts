import assert from 'node:assert/strict';
import { test } from 'node:test';
import { shouldResetPageForAuthUpdate, type AuthIdentity } from '../src/auth/authSessionPolicy.ts';

const student: AuthIdentity = { id: 'user-1', authSource: 'supabase', role: 'Student' };

test('same identity retains an allowed page when Supabase refreshes the session', () => {
  assert.equal(shouldResetPageForAuthUpdate(student, { ...student }, 'ride'), false);
});

test('identity changes reset to the new role landing page', () => {
  assert.equal(shouldResetPageForAuthUpdate(student, { ...student, id: 'user-2' }, 'ride'), true);
  assert.equal(shouldResetPageForAuthUpdate(student, { ...student, role: 'Admin' }, 'ride'), true);
});

test('role changes retain the page when the new role is still allowed to use it', () => {
  assert.equal(shouldResetPageForAuthUpdate(student, { ...student, role: 'Manager' }, 'ride'), false);
});

test('same identity resets a page that is no longer allowed for its role', () => {
  assert.equal(shouldResetPageForAuthUpdate(student, { ...student }, 'manager'), true);
});
