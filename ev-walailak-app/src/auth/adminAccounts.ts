import { supabase } from './supabaseClient';
import type { UserRole, UserStatus } from '../types';

export type AccountAction = 'rename' | 'change_role' | 'suspend' | 'restore' | 'grant_driving' | 'revoke_driving';
export type AccountResult<T> = { data: T; error: null } | { data: null; error: string };

export interface ManagedAccount {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  department: string;
  requestedRole: 'Student' | 'Employee';
  role: UserRole;
  status: UserStatus;
  statusReason: string;
  drivingPermission: boolean;
  inductionConfirmed: boolean;
  createdAt: string;
  updatedAt: string;
}

const roles: UserRole[] = ['Student', 'Employee', 'Manager', 'Admin'];
const statuses: UserStatus[] = ['Pending', 'Approved', 'Rejected', 'Suspended'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function listAllAdminAccounts(): Promise<AccountResult<ManagedAccount[]>> {
  if (!supabase) return { data: null, error: 'ยังไม่ได้ตั้งค่า Supabase สำหรับระบบจริง' };
  const { data, error } = await supabase.rpc('admin_list_accounts');
  if (error) return { data: null, error: mapAccountError(error.code, error.message) };
  if (!Array.isArray(data)) return { data: null, error: 'ข้อมูลบัญชีจาก Supabase ไม่ครบ · โหลดใหม่อีกครั้ง' };
  const accounts: ManagedAccount[] = [];
  for (const item of data) {
    if (!isRecord(item) || typeof item.id !== 'string' || typeof item.email !== 'string'
      || typeof item.full_name !== 'string' || typeof item.role !== 'string'
      || !roles.includes(item.role as UserRole) || typeof item.account_status !== 'string'
      || !statuses.includes(item.account_status as UserStatus)
      || (item.requested_role !== 'Student' && item.requested_role !== 'Employee')) {
      return { data: null, error: 'ข้อมูลบัญชีจาก Supabase ไม่ถูกต้อง · โหลดใหม่อีกครั้ง' };
    }
    accounts.push({
      id: item.id, email: item.email, fullName: item.full_name,
      phone: typeof item.phone === 'string' ? item.phone : '',
      department: typeof item.department === 'string' ? item.department : '',
      requestedRole: item.requested_role,
      role: item.role as UserRole, status: item.account_status as UserStatus,
      statusReason: typeof item.account_status_reason === 'string' ? item.account_status_reason : '',
      drivingPermission: item.driving_permission === true,
      inductionConfirmed: item.induction_confirmed === true,
      createdAt: typeof item.created_at === 'string' ? item.created_at : '',
      updatedAt: typeof item.updated_at === 'string' ? item.updated_at : '',
    });
  }
  return { data: accounts, error: null };
}

export async function updateAdminAccount(input: {
  accountId: string; action: AccountAction; value?: string; reason: string;
}): Promise<AccountResult<boolean>> {
  if (!supabase) return { data: null, error: 'ยังไม่ได้ตั้งค่า Supabase สำหรับระบบจริง' };
  const { error } = await supabase.rpc('admin_update_account', {
    p_account_id: input.accountId, p_action: input.action,
    p_value: input.value ?? '', p_reason: input.reason.trim(),
  });
  return error ? { data: null, error: mapAccountError(error.code, error.message) } : { data: true, error: null };
}

function mapAccountError(code: string, message: string): string {
  const normalized = message.toLowerCase();
  if (code === 'PGRST202' || code === '42883' || normalized.includes('admin_list_accounts') || normalized.includes('admin_update_account')) {
    return 'ยังไม่ได้ติดตั้ง migration หน้าบัญชีทั้งหมดใน Supabase';
  }
  if (code === '42501' || normalized.includes('approved admin access required')) return 'ไม่มีสิทธิ์ดำเนินการนี้ด้วยบัญชี Admin ปัจจุบัน';
  if (code === 'P0002') return 'ไม่พบบัญชีนี้แล้ว · โหลดรายการใหม่';
  if (code === '22023') return 'ข้อมูลไม่ผ่านเงื่อนไข · ตรวจสถานะ บทบาท และเหตุผลแล้วลองใหม่';
  return 'ติดต่อ Supabase ไม่สำเร็จ · ตรวจการเชื่อมต่อแล้วลองใหม่';
}
