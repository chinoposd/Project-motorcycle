import type { User as SupabaseAuthUser } from '@supabase/supabase-js';
import { isApplicantRole, parseSupabaseProfile } from './accountAccess';
import { isValidAuthEmail, normalizeAuthEmail } from './emailAddress';
import { isValidAuthPassword } from './passwordPolicy';
import { requestPasswordReset, type PasswordResetResult } from './passwordResetRequest';
import { supabase } from './supabaseClient';
import type { DemoUser } from './demoAuth';

export type AppUser = DemoUser & {
  authSource: 'demo' | 'supabase';
  accountStatus?: 'Pending' | 'Approved' | 'Rejected' | 'Suspended';
  accountStatusReason?: string;
  drivingPermission?: boolean;
  phone?: string;
  avatarPath?: string | null;
};

export type SupabaseAuthError =
  | 'not-configured'
  | 'invalid-credentials'
  | 'email-unverified'
  | 'invalid-registration'
  | 'email-in-use'
  | 'weak-password'
  | 'email-rate-limited'
  | 'profile-missing'
  | 'profile-invalid'
  | 'request-failed';

export interface SupabaseAuthResult {
  user: AppUser | null;
  error: SupabaseAuthError | null;
  confirmationRequired?: boolean;
}

export interface SupabaseRegistration {
  name: string;
  email: string;
  phone: string;
  password: string;
  requestedRole: 'Student' | 'Employee';
}

export async function signInWithSupabase(email: string, password: string): Promise<SupabaseAuthResult> {
  if (!supabase) return { user: null, error: 'not-configured' };

  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error || !data.user) return { user: null, error: mapAuthError(error?.message ?? '') };

  return resolveProfile(data.user);
}

export async function signUpWithSupabase(input: SupabaseRegistration): Promise<SupabaseAuthResult> {
  if (!supabase) return { user: null, error: 'not-configured' };
  const name = input.name.trim();
  const email = normalizeAuthEmail(input.email);
  const phone = input.phone.trim();
  if (!name || name.length > 80 || !phone || phone.length > 32 || !isValidAuthEmail(email)
    || !isValidAuthPassword(input.password)
    || !isApplicantRole(input.requestedRole)) {
    return { user: null, error: 'invalid-registration' };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: {
      emailRedirectTo: window.location.origin,
      data: {
        full_name: name,
        phone,
        requested_role: input.requestedRole,
      },
    },
  });
  if (error) return { user: null, error: mapSignupError(error.message, error.code ?? '') };
  if (!data.user) return { user: null, error: 'request-failed' };
  if (!data.session && data.user.identities?.length === 0) return { user: null, error: 'email-in-use' };
  if (!data.session) return { user: null, error: null, confirmationRequired: true };

  return resolveProfile(data.user);
}

export async function getCurrentSupabaseUser(): Promise<SupabaseAuthResult> {
  if (!supabase) return { user: null, error: 'not-configured' };
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { user: null, error: null };
  return resolveProfile(data.user);
}

export async function signOutSupabase(): Promise<void> {
  if (supabase) await supabase.auth.signOut();
}

export async function sendSupabasePasswordReset(email: string): Promise<PasswordResetResult> {
  const client = supabase;
  return requestPasswordReset(
    email,
    window.location.origin,
    client ? (normalizedEmail, options) => client.auth.resetPasswordForEmail(normalizedEmail, options) : null,
  );
}

export async function updateSupabasePassword(password: string): Promise<{ ok: boolean }> {
  if (!supabase) return { ok: false };
  const { error } = await supabase.auth.updateUser({ password });
  return { ok: !error };
}

async function resolveProfile(authUser: SupabaseAuthUser): Promise<SupabaseAuthResult> {
  if (!supabase || !authUser.email) return { user: null, error: 'profile-missing' };
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, phone, avatar_path, requested_role, role, account_status, account_status_reason, driving_permission')
    .eq('id', authUser.id)
    .maybeSingle();
  if (error) return { user: null, error: 'request-failed' };
  if (!data) return { user: null, error: 'profile-missing' };

  const profile = parseSupabaseProfile(data);
  if (!profile || profile.id !== authUser.id) return { user: null, error: 'profile-invalid' };
  return {
    user: {
      id: authUser.id,
      email: authUser.email,
      name: profile.fullName,
      role: profile.role,
      authSource: 'supabase',
      accountStatus: profile.status,
      accountStatusReason: data.account_status_reason,
      drivingPermission: profile.drivingPermission,
      phone: data.phone,
      avatarPath: data.avatar_path,
    },
    error: null,
  };
}

function mapAuthError(message: string): SupabaseAuthError {
  const normalized = message.toLowerCase();
  if (normalized.includes('email not confirmed')) return 'email-unverified';
  if (normalized.includes('invalid login credentials')) return 'invalid-credentials';
  return 'request-failed';
}

function mapSignupError(message: string, code: string): SupabaseAuthError {
  const normalized = message.toLowerCase();
  if (code === 'user_already_exists' || normalized.includes('already registered') || normalized.includes('already been registered') || normalized.includes('already exists')) return 'email-in-use';
  if (code === 'weak_password' || normalized.includes('password should be')) return 'weak-password';
  if (code === 'over_email_send_rate_limit' || normalized.includes('email rate limit')) return 'email-rate-limited';
  return 'request-failed';
}

export function getSupabaseAuthErrorMessage(error: SupabaseAuthError): string {
  switch (error) {
    case 'not-configured':
      return 'ยังไม่ได้ตั้งค่าระบบบัญชีจริง · คัดลอก .env.example เป็น .env.local ใส่ Supabase URL และ Publishable key แล้วเริ่ม Vite ใหม่';
    case 'invalid-credentials':
      return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
    case 'email-unverified':
      return 'อีเมลนี้ยังไม่ได้รับการยืนยัน · ตรวจกล่องจดหมายและ Spam ก่อนเข้าสู่ระบบ';
    case 'invalid-registration':
      return 'ข้อมูลสมัครไม่ถูกต้อง · ตรวจชื่อ เบอร์โทร อีเมล ประเภทผู้สมัคร และเงื่อนไขรหัสผ่าน';
    case 'email-in-use':
      return 'อีเมลนี้มีบัญชีแล้ว · ลองเข้าสู่ระบบหรือใช้อีเมลอื่น';
    case 'weak-password':
      return 'รหัสผ่านไม่ผ่านเงื่อนไขของระบบ · ใช้อย่างน้อย 9 ตัว มีพิมพ์เล็ก พิมพ์ใหญ่ ตัวเลข และอักขระพิเศษ';
    case 'email-rate-limited':
      return 'ส่งอีเมลยืนยันถี่เกินไป · รอสักครู่แล้วลองใหม่';
    case 'profile-missing':
      return 'สร้างบัญชีแล้วแต่ไม่พบโปรไฟล์ · ตรวจสอบว่าได้ติดตั้ง migration ของ Supabase แล้ว';
    case 'profile-invalid':
      return 'ข้อมูลโปรไฟล์บัญชีไม่ถูกต้อง · ติดต่อผู้ดูแลระบบ';
    case 'request-failed':
      return 'ติดต่อ Supabase ไม่สำเร็จ · ตรวจอินเทอร์เน็ต การตั้งค่าโปรเจกต์ และ migration แล้วลองใหม่';
  }
}
