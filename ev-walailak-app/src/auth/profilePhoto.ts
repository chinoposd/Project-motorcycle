import type { SessionStorageLike } from './demoAuth.ts';

interface StoredProfilePhotos {
  schemaVersion: 1;
  photos: Record<string, string>;
}

export const PROFILE_PHOTO_STORAGE_KEY = 'ev-walailak-profile-photos:v1';
export const MAX_PROFILE_PHOTO_DATA_LENGTH = 750_000;
const MAX_LEGACY_PROFILE_PHOTO_DATA_LENGTH = 1_500_000;
const PROFILE_PHOTO_DATA_URL = /^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/;

export function readProfilePhoto(userId: string, storage?: SessionStorageLike): string | null {
  const profileStorage = getStorage(storage);
  if (!profileStorage || !userId) return null;

  try {
    const raw = profileStorage.getItem(PROFILE_PHOTO_STORAGE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isStoredProfilePhotos(parsed)) return null;
    return parsed.photos[userId] ?? null;
  } catch {
    return null;
  }
}

export function writeProfilePhoto(userId: string, photo: string | null, storage?: SessionStorageLike): boolean {
  const profileStorage = getStorage(storage);
  if (!userId || userId.length > 120 || !profileStorage) return false;
  if (photo !== null && (photo.length > MAX_PROFILE_PHOTO_DATA_LENGTH || !PROFILE_PHOTO_DATA_URL.test(photo))) return false;

  try {
    const current = readStoredProfilePhotos(profileStorage);
    const photos = { ...current.photos };
    if (photo === null) delete photos[userId];
    else photos[userId] = photo;
    profileStorage.setItem(PROFILE_PHOTO_STORAGE_KEY, JSON.stringify({ schemaVersion: 1, photos }));
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

function readStoredProfilePhotos(storage: SessionStorageLike): StoredProfilePhotos {
  try {
    const raw = storage.getItem(PROFILE_PHOTO_STORAGE_KEY);
    if (raw === null) return { schemaVersion: 1, photos: {} };
    const parsed: unknown = JSON.parse(raw);
    return isStoredProfilePhotos(parsed) ? parsed : { schemaVersion: 1, photos: {} };
  } catch {
    return { schemaVersion: 1, photos: {} };
  }
}

function isStoredProfilePhotos(value: unknown): value is StoredProfilePhotos {
  if (!isRecord(value) || value.schemaVersion !== 1 || !isRecord(value.photos)) return false;
  if (Object.keys(value).sort().join(',') !== 'photos,schemaVersion') return false;
  return Object.entries(value.photos).every(([userId, photo]) =>
    userId.length > 0 && userId.length <= 120 && typeof photo === 'string'
      && photo.length <= MAX_LEGACY_PROFILE_PHOTO_DATA_LENGTH && PROFILE_PHOTO_DATA_URL.test(photo));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
