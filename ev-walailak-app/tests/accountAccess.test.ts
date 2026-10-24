import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getAccountGate, isApplicantRole, parseSupabaseProfile, type AccountAccess } from '../src/auth/accountAccess.ts';

const approvedWithoutPermission: AccountAccess = {
  status: 'Approved',
  drivingPermission: false,
};

test('account access keeps approval separate from driving permission', () => {
  assert.equal(getAccountGate(approvedWithoutPermission), 'approved-no-driving-permission');
  assert.equal(getAccountGate({ status: 'Approved', drivingPermission: true }), 'ready');
});

test('account access does not let driving permission bypass account status', () => {
  assert.equal(getAccountGate({ status: 'Pending', drivingPermission: true }), 'pending');
  assert.equal(getAccountGate({ status: 'Rejected', drivingPermission: true }), 'rejected');
  assert.equal(getAccountGate({ status: 'Suspended', drivingPermission: true }), 'suspended');
});

test('only Student and Employee can be requested from the registration form', () => {
  assert.equal(isApplicantRole('Student'), true);
  assert.equal(isApplicantRole('Employee'), true);
  assert.equal(isApplicantRole('Manager'), false);
  assert.equal(isApplicantRole('Admin'), false);
  assert.equal(isApplicantRole(null), false);
});

test('profile parsing accepts trusted profile fields and rejects privilege-shaped applicant data', () => {
  assert.deepEqual(parseSupabaseProfile({
    id: 'user-1',
    full_name: 'ผู้ใช้ใหม่',
    requested_role: 'Student',
    role: 'Student',
    account_status: 'Pending',
    driving_permission: false,
  }), {
    id: 'user-1',
    fullName: 'ผู้ใช้ใหม่',
    requestedRole: 'Student',
    role: 'Student',
    status: 'Pending',
    drivingPermission: false,
  });
  assert.equal(parseSupabaseProfile({
    id: 'user-2',
    full_name: 'ผู้สมัคร',
    requested_role: 'Admin',
    role: 'Admin',
    account_status: 'Approved',
    driving_permission: true,
  }), null);
  assert.equal(parseSupabaseProfile({
    id: 'user-3',
    full_name: 'ผู้สมัคร',
    requested_role: 'Employee',
    role: 'Student',
    account_status: 'self-approved',
    driving_permission: true,
  }), null);
});
