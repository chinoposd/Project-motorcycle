import type { User as SupabaseAuthUser } from '@supabase/supabase-js';
import { isApplicantRole, parseSupabaseProfile } from './accountAccess';
import { supabase } from './supabaseClient';
import type { DemoUser } from './demoAuth';

export type AppUser = DemoUser & {
  authSource: 'demo' | 'supabase';
  accountStatus?: 'Pending' | 'Approved' | 'Rejected' | 'Suspended';
  drivingPermission?: boolean;
};

export type SupabaseAuthError =
  | 'not-configured'
  | 'invalid-credentials'
  | 'email-unverified'
  | 'invalid-registration'
  | 'signup-failed'
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
  const email = input.email.trim().toLowerCase();
  if (!name || name.length > 80 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    || input.password.length < 8 || input.password.length > 256
    || !isApplicantRole(input.requestedRole)) {
    return { user: null, error: 'invalid-registration' };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: {
      data: {
        full_name: name,
        requested_role: input.requestedRole,
      },
    },
  });
  if (error || !data.user) return { user: null, error: mapSignupError(error?.message ?? '') };
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

async function resolveProfile(authUser: SupabaseAuthUser): Promise<SupabaseAuthResult> {
  if (!supabase || !authUser.email) return { user: null, error: 'profile-missing' };
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, requested_role, role, account_status, driving_permission')
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
      drivingPermission: profile.drivingPermission,
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

function mapSignupError(message: string): SupabaseAuthError {
  const normalized = message.toLowerCase();
  if (normalized.includes('already registered') || normalized.includes('already been registered')) return 'signup-failed';
  return 'request-failed';
}
