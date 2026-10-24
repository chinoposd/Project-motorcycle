import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AuthRequestEpoch } from '../src/auth/authRequestEpoch.ts';

test('new auth events invalidate responses from earlier in-flight profile requests', () => {
  const epoch = new AuthRequestEpoch();
  const oldRequest = epoch.begin();
  const currentRequest = epoch.begin();

  assert.equal(epoch.isCurrent(oldRequest), false);
  assert.equal(epoch.isCurrent(currentRequest), true);
});

test('logout invalidates an in-flight auth profile request', () => {
  const epoch = new AuthRequestEpoch();
  const request = epoch.begin();
  epoch.invalidate();

  assert.equal(epoch.isCurrent(request), false);
});
