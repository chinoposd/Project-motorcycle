import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isValidAuthEmail, normalizeAuthEmail } from '../src/auth/emailAddress.ts';

test('normalizes email like Supabase signup', () => {
  assert.equal(normalizeAuthEmail(' User@WU.AC.TH '), 'user@wu.ac.th');
});

test('uses the signup email format', () => {
  assert.equal(isValidAuthEmail('user@wu.ac.th'), true);
  assert.equal(isValidAuthEmail('not-an-email'), false);
  assert.equal(isValidAuthEmail('user@'), false);
});
