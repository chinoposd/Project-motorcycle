import { supabase } from './supabaseClient';

const PROFILE_PHOTO_BUCKET = 'profile-photos';
const MAX_PROFILE_PHOTO_BYTES = 600_000;
const SIGNED_URL_LIFETIME_SECONDS = 60 * 60 * 24;

export interface SupabaseProfileUpdate {
  name?: string;
  phone?: string;
}

export type ProfileSaveResult =
  | { ok: true; name: string; phone: string }
  | { ok: false; message: string };

export type ProfilePhotoSaveResult =
  | { ok: true; avatarPath: string | null; photoUrl: string | null; cleanupFailed?: boolean }
  | { ok: false; message: string };

export async function updateSupabaseProfile(userId: string, update: SupabaseProfileUpdate): Promise<ProfileSaveResult> {
  if (!supabase) return { ok: false, message: 'ยังไม่ได้เชื่อมต่อ Supabase' };
  const fullName = update.name?.trim();
  const phone = update.phone?.trim();
  if (fullName !== undefined && (!fullName || fullName.length > 80)) {
    return { ok: false, message: 'ชื่อ–นามสกุลต้องมี 1–80 ตัวอักษร' };
  }
  if (phone !== undefined && phone.length > 30) {
    return { ok: false, message: 'เบอร์โทรศัพท์ยาวเกิน 30 ตัวอักษร' };
  }

  const fields = {
    ...(fullName === undefined ? {} : { full_name: fullName }),
    ...(phone === undefined ? {} : { phone }),
  };
  if (Object.keys(fields).length === 0) return { ok: false, message: 'ไม่มีข้อมูลที่เปลี่ยนแปลง' };

  const { data, error } = await supabase
    .from('profiles')
    .update(fields)
    .eq('id', userId)
    .select('full_name, phone')
    .maybeSingle();
  if (error) return { ok: false, message: 'บันทึกไม่สำเร็จ · ตรวจสอบ migration และสิทธิ์โปรไฟล์ใน Supabase' };
  if (!data) return { ok: false, message: 'ไม่พบโปรไฟล์ของบัญชีนี้ หรือบัญชีไม่มีสิทธิ์แก้ไข' };
  return { ok: true, name: data.full_name, phone: data.phone };
}

export async function createSupabaseProfilePhotoUrl(path: string | null): Promise<string | null> {
  if (!supabase || !path) return null;
  const { data, error } = await supabase.storage
    .from(PROFILE_PHOTO_BUCKET)
    .createSignedUrl(path, SIGNED_URL_LIFETIME_SECONDS);
  return error ? null : data.signedUrl;
}

export async function saveSupabaseProfilePhoto(
  userId: string,
  currentPath: string | null,
  photoDataUrl: string | null,
): Promise<ProfilePhotoSaveResult> {
  if (!supabase) return { ok: false, message: 'ยังไม่ได้เชื่อมต่อ Supabase' };
  if (photoDataUrl !== null) {
    let photoBlob: Blob;
    try {
      photoBlob = await (await fetch(photoDataUrl)).blob();
    } catch {
      return { ok: false, message: 'อ่านไฟล์รูปไม่สำเร็จ · กรุณาเลือกรูปใหม่' };
    }
    if (photoBlob.type !== 'image/jpeg' || photoBlob.size > MAX_PROFILE_PHOTO_BYTES) {
      return { ok: false, message: 'รูปต้องเป็น JPEG และมีขนาดไม่เกิน 600 KB' };
    }

    const path = `${userId}/${crypto.randomUUID()}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from(PROFILE_PHOTO_BUCKET)
      .upload(path, photoBlob, { contentType: 'image/jpeg', cacheControl: '3600', upsert: false });
    if (uploadError) return { ok: false, message: 'อัปโหลดรูปไม่สำเร็จ · ตรวจสอบ bucket และสิทธิ์ Storage ใน Supabase' };

    const { data, error } = await supabase
      .from('profiles')
      .update({ avatar_path: path })
      .eq('id', userId)
      .select('avatar_path')
      .maybeSingle();
    if (error || !data) {
      await supabase.storage.from(PROFILE_PHOTO_BUCKET).remove([path]);
      return { ok: false, message: 'บันทึกรูปลงโปรไฟล์ไม่สำเร็จ · ตรวจสอบ migration และสิทธิ์โปรไฟล์' };
    }

    const photoUrl = await createSupabaseProfilePhotoUrl(path);
    let cleanupFailed = false;
    if (currentPath && currentPath !== path) {
      const { error: removeError } = await supabase.storage.from(PROFILE_PHOTO_BUCKET).remove([currentPath]);
      cleanupFailed = Boolean(removeError);
    }
    return { ok: true, avatarPath: path, photoUrl, ...(cleanupFailed ? { cleanupFailed: true } : {}) };
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ avatar_path: null })
    .eq('id', userId)
    .select('avatar_path')
    .maybeSingle();
  if (error) return { ok: false, message: 'ลบรูปจากโปรไฟล์ไม่สำเร็จ · ตรวจสอบสิทธิ์ฐานข้อมูล' };
  if (!data) return { ok: false, message: 'ไม่พบโปรไฟล์ของบัญชีนี้' };

  let cleanupFailed = false;
  if (currentPath) {
    const { error: removeError } = await supabase.storage.from(PROFILE_PHOTO_BUCKET).remove([currentPath]);
    cleanupFailed = Boolean(removeError);
  }
  return { ok: true, avatarPath: null, photoUrl: null, ...(cleanupFailed ? { cleanupFailed: true } : {}) };
}
