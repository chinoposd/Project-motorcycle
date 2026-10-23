import type { SessionStorageLike } from './demoAuth.ts';

export interface ManagerProfile {
  name: string;
  phone: string;
  department: string;
}

interface StoredManagerProfiles {
  schemaVersion: 1;
  profiles: Record<string, ManagerProfile>;
}

export const MANAGER_PROFILE_STORAGE_KEY = 'ev-walailak-manager-profiles:v1';
const DEFAULT_DEPARTMENT = 'ระบบบริหารยานพาหนะไฟฟ้า';

export function readManagerProfile(userId: string, fallbackName: string, storage?: SessionStorageLike): ManagerProfile {
  const fallback = { name: fallbackName, phone: '', department: DEFAULT_DEPARTMENT };
  const profileStorage = getStorage(storage);
  if (!profileStorage || !userId) return fallback;

  try {
    const raw = profileStorage.getItem(MANAGER_PROFILE_STORAGE_KEY);
    if (raw === null) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (!isStoredProfiles(parsed)) return fallback;
    return parsed.profiles[userId] ?? fallback;
  } catch {
    return fallback;
  }
}

export function writeManagerProfile(userId: string, profile: ManagerProfile, storage?: SessionStorageLike): boolean {
  const normalizedProfile = normalizeProfile(profile);
  const profileStorage = getStorage(storage);
  if (!userId || userId.length > 120 || !normalizedProfile || !profileStorage) return false;

  try {
    const current = readProfiles(profileStorage);
    const next: StoredManagerProfiles = {
      schemaVersion: 1,
      profiles: { ...current, [userId]: normalizedProfile },
    };
    profileStorage.setItem(MANAGER_PROFILE_STORAGE_KEY, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

function normalizeProfile(profile: ManagerProfile): ManagerProfile | null {
  const name = profile.name.trim();
  const phone = profile.phone.trim();
  const department = profile.department.trim();
  if (!name || name.length > 80 || phone.length > 30 || !department || department.length > 80) return null;
  return { name, phone, department };
}

function getStorage(storage?: SessionStorageLike): SessionStorageLike | null {
  if (storage) return storage;
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function readProfiles(storage: SessionStorageLike): Record<string, ManagerProfile> {
  try {
    const raw = storage.getItem(MANAGER_PROFILE_STORAGE_KEY);
    if (raw === null) return {};
    const parsed: unknown = JSON.parse(raw);
    return isStoredProfiles(parsed) ? parsed.profiles : {};
  } catch {
    return {};
  }
}

function isStoredProfiles(value: unknown): value is StoredManagerProfiles {
  if (!isRecord(value) || value.schemaVersion !== 1 || !isRecord(value.profiles)) return false;
  if (Object.keys(value).sort().join(',') !== 'profiles,schemaVersion') return false;
  return Object.entries(value.profiles).every(([userId, profile]) =>
    userId.length > 0 && userId.length <= 120 && isManagerProfile(profile));
}

function isManagerProfile(value: unknown): value is ManagerProfile {
  if (!isRecord(value) || Object.keys(value).sort().join(',') !== 'department,name,phone') return false;
  return typeof value.name === 'string' && value.name.trim().length > 0 && value.name.length <= 80
    && typeof value.phone === 'string' && value.phone.length <= 30
    && typeof value.department === 'string' && value.department.trim().length > 0 && value.department.length <= 80;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

