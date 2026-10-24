import assert from 'node:assert/strict';
import { test } from 'node:test';
import { requiresApprovalGate } from '../src/auth/accountAccess.ts';
import { isPageAllowed } from '../src/auth/demoAuth.ts';

test('demo profile route remains available while Supabase users must pass account approval', () => {
  assert.equal(isPageAllowed('Student', 'profile-settings'), true);
  assert.equal(requiresApprovalGate({ authSource: 'demo' }), false);
  assert.equal(requiresApprovalGate({ authSource: 'supabase', accountStatus: 'Pending' }), true);
  assert.equal(requiresApprovalGate({ authSource: 'supabase', accountStatus: 'Approved' }), false);
  assert.equal(requiresApprovalGate({ authSource: 'supabase' }), true);
});
