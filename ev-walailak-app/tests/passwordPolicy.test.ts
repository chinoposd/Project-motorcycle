import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isValidAuthPassword } from '../src/auth/passwordPolicy.ts';

test('keeps reset passwords within signup policy', () => {
  assert.equal(isValidAuthPassword('Abcdef12!'), true);
  assert.equal(isValidAuthPassword('Abc12!xy'), false);
  assert.equal(isValidAuthPassword(`Aa1!${'x'.repeat(253)}`), false);
  assert.equal(isValidAuthPassword('abcdefgh9!'), false);
});
