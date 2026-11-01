import { supabase } from '../../auth/supabaseClient';

export interface DrivingPermissionRequest {
  id: string;
  user_id: string;
  user_name?: string;
  role?: string;
  details: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';
  decision_reason: string;
  created_at: string;
  reviewed_at: string | null;
}

function errorMessage(error: { code?: string; message: string } | null): string | null {
  if (!error) return null;
  if (error.code === 'PGRST202' || error.code === '42P01') return 'ยังไม่ได้ติดตั้ง migration คำขอสิทธิ์ขับรถใน Supabase';
  return error.message;
}

export async function loadMyDrivingRequest(): Promise<{ data: DrivingPermissionRequest | null; error: string | null }> {
  if (!supabase) return { data: null, error: 'ต้องเข้าสู่ระบบบัญชีจริงก่อน' };
  const { data, error } = await supabase.rpc('my_driving_permission_request');
  return { data: data as DrivingPermissionRequest | null, error: errorMessage(error) };
}

export async function submitDrivingRequest(): Promise<string | null> {
  if (!supabase) return 'ต้องเข้าสู่ระบบบัญชีจริงก่อน';
  const { error } = await supabase.rpc('request_driving_permission');
  return errorMessage(error);
}

export async function cancelDrivingRequest(): Promise<string | null> {
  if (!supabase) return 'ต้องเข้าสู่ระบบบัญชีจริงก่อน';
  const { error } = await supabase.rpc('cancel_driving_permission_request');
  return errorMessage(error);
}

export async function loadDrivingRequests(): Promise<{ data: DrivingPermissionRequest[]; error: string | null }> {
  if (!supabase) return { data: [], error: 'ต้องเข้าสู่ระบบบัญชี Admin' };
  const { data, error } = await supabase.rpc('admin_driving_permission_requests');
  return { data: (data as DrivingPermissionRequest[] | null) ?? [], error: errorMessage(error) };
}

export async function reviewDrivingRequest(id: string, decision: 'approve' | 'reject', reason: string, inductionConfirmed: boolean, documentsVerified: boolean): Promise<string | null> {
  if (!supabase) return 'ต้องเข้าสู่ระบบบัญชี Admin';
  const { error } = await supabase.rpc('admin_review_driving_permission_request', {
    p_request_id: id,
    p_decision: decision,
    p_reason: reason,
    p_induction_confirmed: inductionConfirmed,
    p_documents_verified: documentsVerified,
  });
  return errorMessage(error);
}
