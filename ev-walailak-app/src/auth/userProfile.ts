import type { SessionStorageLike } from './demoAuth.ts';

export interface UserProfile {
  name?: string;
  phone: string;
}

interface ProfileNameAudit {
  actorId: string;
  subjectId: string;
  oldName: string;
  newName: string;
  timestamp: string;
}

interface StoredUserProfiles {
  schemaVersion: 1;
  profiles: Record<string, UserProfile>;
  auditLog?: ProfileNameAudit[];
}

export const USER_PROFILE_STORAGE_KEY = 'ev-walailak-user-profiles:v1';

export function readUserProfile(userId: string, storage?: SessionStorageLike): UserProfile {
  const profileStorage = getStorage(storage);
  if (!profileStorage || !userId) return { phone: '' };

  try {
    const raw = profileStorage.getItem(USER_PROFILE_STORAGE_KEY);
    if (raw === null) return { phone: '' };
    const parsed: unknown = JSON.parse(raw);
    if (!isStoredProfiles(parsed)) return { phone: '' };
    return parsed.profiles[userId] ?? { phone: '' };
  } catch {
    return { phone: '' };
  }
}

export function writeUserProfile(userId: string, profile: UserProfile, previousName?: string, storage?: SessionStorageLike): boolean {
  const phone = profile.phone.trim();
  const name = profile.name?.trim();
  const profileStorage = getStorage(storage);
  if (!userId || userId.length > 120 || phone.length > 30 || (name !== undefined && (!name || name.length > 80)) || !profileStorage) return false;

  try {
    const current = readStoredProfiles(profileStorage);
    const profiles = { ...current.profiles, [userId]: { ...(name === undefined ? {} : { name }), phone } };
    const nameChanged = name !== undefined && previousName !== undefined && name !== previousName.trim();
    const next: StoredUserProfiles = {
      schemaVersion: 1,
      profiles,
      ...(current.auditLog || nameChanged ? {
        auditLog: [
          ...(current.auditLog ?? []),
          ...(nameChanged ? [{ actorId: userId, subjectId: userId, oldName: previousName!.trim(), newName: name!, timestamp: new Date().toISOString() }] : []),
        ].slice(-100),
      } : {}),
    };
    profileStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

function getStorage(storage?: SessionStorageLike): SessionStorageLike | null {
  if (storage) return storage;
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function readStoredProfiles(storage: SessionStorageLike): StoredUserProfiles {
  try {
    const raw = storage.getItem(USER_PROFILE_STORAGE_KEY);
    if (raw === null) return { schemaVersion: 1, profiles: {} };
    const parsed: unknown = JSON.parse(raw);
    return isStoredProfiles(parsed) ? parsed : { schemaVersion: 1, profiles: {} };
  } catch {
    return { schemaVersion: 1, profiles: {} };
  }
}

function isStoredProfiles(value: unknown): value is StoredUserProfiles {
  if (!isRecord(value) || value.schemaVersion !== 1 || !isRecord(value.profiles)) return false;
  if (!['profiles,schemaVersion', 'auditLog,profiles,schemaVersion'].includes(Object.keys(value).sort().join(','))) return false;
  if (!Object.entries(value.profiles).every(([userId, profile]) =>
    userId.length > 0 && userId.length <= 120 && isUserProfile(profile))) return false;
  return value.auditLog === undefined || (Array.isArray(value.auditLog) && value.auditLog.every(isProfileNameAudit));
}

function isUserProfile(value: unknown): value is UserProfile {
  if (!isRecord(value) || !['phone', 'name,phone'].includes(Object.keys(value).sort().join(','))) return false;
  return typeof value.phone === 'string'
    && value.phone.length <= 30
    && (value.name === undefined || (typeof value.name === 'string' && value.name.trim().length > 0 && value.name.length <= 80));
}

function isProfileNameAudit(value: unknown): value is ProfileNameAudit {
  return isRecord(value)
    && Object.keys(value).sort().join(',') === 'actorId,newName,oldName,subjectId,timestamp'
    && typeof value.actorId === 'string'
    && typeof value.subjectId === 'string'
    && typeof value.oldName === 'string'
    && typeof value.newName === 'string'
    && typeof value.timestamp === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
