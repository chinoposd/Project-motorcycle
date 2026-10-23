import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MANAGER_PROFILE_STORAGE_KEY,
  readManagerProfile,
  writeManagerProfile,
} from '../src/auth/managerProfile.ts';

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

test('manager profile uses a safe default and saves editable fields per user', () => {
  const storage = new MemoryStorage();
  const defaultProfile = { name: 'ผู้จัดการระบบ', phone: '', department: 'ระบบบริหารยานพาหนะไฟฟ้า' };
  assert.deepEqual(readManagerProfile('manager-1', 'ผู้จัดการระบบ', storage), defaultProfile);

  const updated = { name: 'ผู้จัดการใหม่', phone: '0812345678', department: 'ศูนย์ยานพาหนะ' };
  assert.equal(writeManagerProfile('manager-1', updated, storage), true);
  assert.deepEqual(readManagerProfile('manager-1', 'ผู้จัดการระบบ', storage), updated);
  assert.deepEqual(readManagerProfile('manager-2', 'อีกบัญชี', storage), {
    name: 'อีกบัญชี', phone: '', department: 'ระบบบริหารยานพาหนะไฟฟ้า',
  });

  const raw = storage.getItem(MANAGER_PROFILE_STORAGE_KEY) ?? '';
  assert.equal(raw.includes('password'), false);
  assert.equal(raw.includes('@'), false);
});

test('manager profile ignores malformed storage and rejects invalid profile data', () => {
  const storage = new MemoryStorage();
  storage.setItem(MANAGER_PROFILE_STORAGE_KEY, '{broken');
  assert.deepEqual(readManagerProfile('manager-1', 'ผู้จัดการระบบ', storage), {
    name: 'ผู้จัดการระบบ', phone: '', department: 'ระบบบริหารยานพาหนะไฟฟ้า',
  });
  assert.equal(writeManagerProfile('manager-1', { name: ' ', phone: '', department: '' }, storage), false);
});

test('manager profile handles unavailable browser storage without throwing', () => {
  const unavailableStorage = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
    removeItem() { throw new Error('blocked'); },
  };
  assert.deepEqual(readManagerProfile('manager-1', 'ผู้จัดการระบบ', unavailableStorage), {
    name: 'ผู้จัดการระบบ', phone: '', department: 'ระบบบริหารยานพาหนะไฟฟ้า',
  });
  assert.equal(writeManagerProfile('manager-1', { name: 'ผู้จัดการ', phone: '', department: 'ศูนย์' }, unavailableStorage), false);
});

