import { supabase } from './supabaseClient';

export type ApplicantRole = 'Student' | 'Employee';
export type ReviewDecision = 'Approved' | 'Rejected';

export type AdminAccountResult<T> =
  | { data: T; error: null }
  | { data: null; error: string };

export interface AdminAccount {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  department: string;
  requestedRole: ApplicantRole;
  createdAt: string;
}

export interface AdminAccountReviewInput {
  accountId: string;
  decision: ReviewDecision;
  verifiedRole: ApplicantRole | null;
  affiliationVerified: boolean;
  reason: string;
}

export interface AdminAccountReviewResponse {
  accountId: string;
  status: ReviewDecision;
  role: ApplicantRole;
  drivingPermission: boolean;
}

export async function listPendingAdminAccounts(): Promise<AdminAccountResult<AdminAccount[]>> {
  if (!supabase) return { data: null, error: 'ยังไม่ได้ตั้งค่า Supabase สำหรับระบบจริง' };

  try {
    const { data, error } = await supabase.rpc('admin_list_pending_accounts');
    if (error) return { data: null, error: mapReviewError(error.code, error.message) };

    const accounts: AdminAccount[] = (data ?? []).flatMap((row) => {
      if (row.requested_role !== 'Student' && row.requested_role !== 'Employee') return [];
      return [{
        id: row.account_id,
        email: row.email ?? '',
        fullName: row.full_name ?? '',
        phone: row.phone ?? '',
        department: row.department ?? '',
        requestedRole: row.requested_role,
        createdAt: row.created_at,
      }];
    });

    return { data: accounts, error: null };
  } catch {
    return { data: null, error: mapReviewError('', '') };
  }
}

export async function reviewPendingAdminAccount(
  input: AdminAccountReviewInput,
): Promise<AdminAccountResult<AdminAccountReviewResponse>> {
  if (!supabase) return { data: null, error: 'ยังไม่ได้ตั้งค่า Supabase สำหรับระบบจริง' };

  try {
    const { data, error } = await supabase.rpc('admin_review_pending_account', {
      p_account_id: input.accountId,
      p_decision: input.decision,
      p_verified_role: input.verifiedRole,
      p_affiliation_verified: input.affiliationVerified,
      p_reason: input.reason.trim(),
    });
    if (error) return { data: null, error: mapReviewError(error.code, error.message) };

    const row = data?.[0];
    if (!row || row.account_status !== input.decision
      || (row.role !== 'Student' && row.role !== 'Employee')) {
      return { data: null, error: 'ระบบส่งผลการตรวจสอบกลับมาไม่ครบ · โหลดรายการใหม่แล้วลองอีกครั้ง' };
    }

    return {
      data: {
        accountId: row.account_id,
        status: row.account_status,
        role: row.role,
        drivingPermission: row.driving_permission,
      },
      error: null,
    };
  } catch {
    return { data: null, error: mapReviewError('', '') };
  }
}

function mapReviewError(code: string, message: string): string {
  const normalized = message.toLowerCase();
  if (code === 'PGRST202' || code === '42883' || normalized.includes('admin_list_pending_accounts')
    || normalized.includes('admin_review_pending_account')) {
    return 'ยังไม่ได้ติดตั้ง migration ระบบตรวจสอบบัญชี Admin ใน Supabase';
  }
  if (code === '42501' || normalized.includes('approved admin access required')) {
    return 'บัญชีนี้ไม่มีสิทธิ์ Admin ที่อนุมัติแล้ว · ตรวจ role และสถานะบัญชีใน Supabase';
  }
  if (code === 'P0002') return 'บัญชีนี้ไม่อยู่ในสถานะรอตรวจสอบแล้ว · โหลดรายการใหม่';
  if (code === '22023') return 'ข้อมูลการตรวจสอบไม่ครบหรือไม่ถูกต้อง · ตรวจบทบาท การยืนยันสังกัด และเหตุผล';
  return 'ติดต่อ Supabase ไม่สำเร็จ · ตรวจอินเทอร์เน็ต การตั้งค่าโปรเจกต์ และ migration แล้วลองใหม่';
}
