import type { UserRole, UserStatus } from '../types.ts';

export interface AccountAccess {
  status: UserStatus;
  drivingPermission: boolean;
}

export interface ApprovalGateIdentity {
  authSource: 'demo' | 'supabase';
  accountStatus?: UserStatus;
}

export interface SupabaseProfile {
  id: string;
  fullName: string;
  requestedRole: 'Student' | 'Employee';
  role: UserRole;
  status: UserStatus;
  drivingPermission: boolean;
}

export type AccountGate = 'pending' | 'rejected' | 'suspended' | 'approved-no-driving-permission' | 'ready';

export function requiresApprovalGate(identity: ApprovalGateIdentity): boolean {
  return identity.authSource === 'supabase' && identity.accountStatus !== 'Approved';
}

export function isApplicantRole(value: unknown): value is 'Student' | 'Employee' {
  return value === 'Student' || value === 'Employee';
}

export function getAccountGate(access: AccountAccess): AccountGate {
  if (access.status === 'Pending') return 'pending';
  if (access.status === 'Rejected') return 'rejected';
  if (access.status === 'Suspended') return 'suspended';
  return access.drivingPermission ? 'ready' : 'approved-no-driving-permission';
}

export function parseSupabaseProfile(value: unknown): SupabaseProfile | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== 'string' || typeof value.full_name !== 'string') return null;
  if (!isApplicantRole(value.requested_role)) return null;
  if (!isUserRole(value.role) || !isUserStatus(value.account_status) || typeof value.driving_permission !== 'boolean') return null;
  return {
    id: value.id,
    fullName: value.full_name,
    requestedRole: value.requested_role,
    role: value.role,
    status: value.account_status,
    drivingPermission: value.driving_permission,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUserRole(value: unknown): value is UserRole {
  return value === 'Student' || value === 'Employee' || value === 'Manager' || value === 'Admin';
}

function isUserStatus(value: unknown): value is UserStatus {
  return value === 'Pending' || value === 'Approved' || value === 'Rejected' || value === 'Suspended';
}
