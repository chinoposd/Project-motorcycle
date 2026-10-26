import type { Json } from './database.types';
import { supabase } from './supabaseClient';

export type PortalResult<T> = { data: T; error: null } | { data: null; error: string };
export type PortalAction = 'set_driving_permission' | 'update_settings' | 'save_announcement'
  | 'review_privacy_request' | 'set_manual_service_stop' | 'set_safety_block' | 'confirm_service_reopen';

export interface PortalSettings {
  session_start: string | null;
  session_end: string | null;
  allowed_weekdays: number[] | null;
  cancellation_limit: number | null;
  cancellation_cooldown_hours: number | null;
  no_show_limit: number | null;
  no_show_cooldown_hours: number | null;
  effective_from: string;
}

export interface PermissionAccount { id: string; name: string; email: string; role: 'Student' | 'Employee' | 'Manager'; induction_confirmed: boolean; driving_permission: boolean; }
export type AnnouncementRole = 'Student' | 'Employee' | 'Manager' | 'Admin';
export interface PortalAnnouncement { id: string; title: string; body: string; published: boolean; important: boolean; audience_roles: AnnouncementRole[]; starts_at: string | null; ends_at: string | null; published_at: string | null; updated_at: string; }
export interface PublishedAnnouncement { id: string; title: string; body: string; important: boolean; published_at: string; seen: boolean; }
export interface PrivacyRequest {
  id: string; requester_id: string; requester_name: string; requester_email: string;
  request_type: 'access' | 'correction' | 'deletion'; details: string;
  status: 'Pending' | 'InReview' | 'Completed' | 'Rejected'; admin_note: string; created_at: string; reviewed_at: string | null;
}
export interface ServiceControl { manual_out_of_service: boolean; safety_block_active: boolean; final_confirmation_required: boolean; service_reason: string; updated_at: string; }
export interface PortalAudit { id: number | string; actor: string | null; action: string; target_type: string; target_id: string; reason: string; created_at: string; before_value?: unknown; after_value?: unknown; }
export interface UserPrivacyRequest { id: string; request_type: 'access' | 'correction' | 'deletion'; details: string; status: string; admin_note: string; created_at: string; reviewed_at: string | null; }
export interface AdminPortalSnapshot {
  pending_accounts: number;
  permission_accounts: PermissionAccount[];
  settings: PortalSettings;
  announcements: PortalAnnouncement[];
  privacy_requests: PrivacyRequest[];
  service: ServiceControl;
  audit: PortalAudit[];
  cancellation_events_available: boolean;
  no_show_events_available: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }

export async function loadAdminPortal(): Promise<PortalResult<AdminPortalSnapshot>> {
  if (!supabase) return { data: null, error: 'ยังไม่ได้ตั้งค่า Supabase สำหรับระบบจริง' };
  const { data, error } = await supabase.rpc('admin_portal_snapshot');
  if (error) return { data: null, error: mapPortalError(error.code, error.message) };
  if (!isRecord(data) || !isRecord(data.settings) || !isRecord(data.service)
    || !Array.isArray(data.permission_accounts) || !Array.isArray(data.announcements)
    || !Array.isArray(data.privacy_requests) || !Array.isArray(data.audit)) {
    return { data: null, error: 'ข้อมูลหน้า Admin จาก Supabase ไม่ครบ · โหลดใหม่อีกครั้ง' };
  }
  return { data: data as unknown as AdminPortalSnapshot, error: null };
}

export async function runAdminPortalAction(action: PortalAction, payload: Record<string, unknown>): Promise<PortalResult<Json>> {
  if (!supabase) return { data: null, error: 'ยังไม่ได้ตั้งค่า Supabase สำหรับระบบจริง' };
  const { data, error } = action === 'set_driving_permission'
    ? await supabase.rpc('admin_set_driving_permission', { p_payload: payload as Json })
    : await supabase.rpc('admin_portal_action', { p_action: action, p_payload: payload as Json });
  return error ? { data: null, error: mapPortalError(error.code, error.message) } : { data, error: null };
}

export async function submitDataSubjectRequest(type: 'access' | 'correction' | 'deletion', details: string): Promise<PortalResult<string>> {
  if (!supabase) return { data: null, error: 'การส่งคำขอต้องเข้าสู่ระบบบัญชีจริงก่อน' };
  const { data, error } = await supabase.rpc('submit_data_subject_request', { p_request_type: type, p_details: details.trim() });
  return error ? { data: null, error: mapPortalError(error.code, error.message) } : { data, error: null };
}

export async function loadMyDataSubjectRequests(): Promise<PortalResult<UserPrivacyRequest[]>> {
  if (!supabase) return { data: null, error: 'การดูคำขอต้องเข้าสู่ระบบบัญชีจริงก่อน' };
  const { data, error } = await supabase.rpc('list_my_data_subject_requests');
  return error ? { data: null, error: mapPortalError(error.code, error.message) } : { data: (data ?? []).map((row) => ({ ...row, request_type: row.request_type as UserPrivacyRequest['request_type'] })), error: null };
}

export async function loadPublishedAnnouncements(): Promise<PortalResult<PublishedAnnouncement[]>> {
  if (!supabase) return { data: [], error: null };
  const { data, error } = await supabase.rpc('list_published_announcements');
  return error ? { data: null, error: mapPortalError(error.code, error.message) } : { data: data ?? [], error: null };
}

export async function markAnnouncementSeen(id: string): Promise<PortalResult<boolean>> {
  if (!supabase) return { data: null, error: 'การอ่านประกาศต้องเข้าสู่ระบบบัญชีจริงก่อน' };
  const { data, error } = await supabase.rpc('mark_announcement_seen', { p_announcement_id: id });
  return error ? { data: null, error: mapPortalError(error.code, error.message) } : { data: Boolean(data), error: null };
}

function mapPortalError(code: string, message: string): string {
  const normalized = message.toLowerCase();
  if (code === 'PGRST202' || code === '42883' || normalized.includes('admin_portal_') || normalized.includes('data_subject_request')
    || normalized.includes('published_announcements') || normalized.includes('mark_announcement_seen')) {
    return 'ยังไม่ได้ติดตั้ง migration เครื่องมือ Admin ใหม่ใน Supabase';
  }
  if (code === '42501' || normalized.includes('approved admin access required')) return 'ต้องเข้าสู่ระบบด้วยบัญชี Admin ที่อนุมัติแล้ว';
  if (code === '22023') return 'ข้อมูลไม่ครบหรือไม่ผ่านเงื่อนไขที่กำหนด · ตรวจข้อมูลแล้วยืนยันอีกครั้ง';
  if (code === 'P0002') return 'รายการนี้ถูกดำเนินการไปแล้วหรือไม่มีอยู่ · โหลดข้อมูลใหม่';
  return 'บันทึกข้อมูลไม่สำเร็จ · ตรวจการเชื่อมต่อและลองใหม่';
}
