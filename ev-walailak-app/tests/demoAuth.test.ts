import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PageId, UserRole } from '../src/types.ts';
import {
  authenticateDemoUser,
  authenticateUser,
  clearDemoSession,
  DEMO_ACCOUNTS_STORAGE_KEY,
  DEMO_ROLE_SHORTCUTS,
  DEMO_SESSION_STORAGE_KEY,
  getDemoCredentials,
  getLandingPage,
  isPageAllowed,
  readDemoSession,
  registerDemoUser,
  writeDemoSession,
} from '../src/auth/demoAuth.ts';

const demoPassword = 'Demo1234!';

const roleCases: { role: UserRole; email: string; landing: PageId; allowed: PageId[] }[] = [
  { role: 'Student', email: 'student@demo.wu.ac.th', landing: 'home', allowed: ['home', 'ride'] },
  { role: 'Employee', email: 'employee@demo.wu.ac.th', landing: 'home', allowed: ['home', 'ride'] },
  { role: 'Manager', email: 'manager@demo.wu.ac.th', landing: 'manager', allowed: ['home', 'ride', 'manager', 'manager-profile'] },
  { role: 'Admin', email: 'admin@demo.wu.ac.th', landing: 'admin', allowed: ['admin'] },
];

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

test('demoAuth authenticates every demo account and normalizes email', () => {
  for (const account of roleCases) {
    const user = authenticateDemoUser(`  ${account.email.toUpperCase()}  `, demoPassword);
    assert.equal(user?.email, account.email);
    assert.equal(user?.role, account.role);
  }
});

test('demoAuth rejects an unknown account and an incorrect password', () => {
  assert.equal(authenticateDemoUser('unknown@demo.wu.ac.th', demoPassword), null);
  assert.equal(authenticateDemoUser('student@demo.wu.ac.th', 'wrong-password'), null);
});

test('demoAuth provides the matching shortcut credentials for each role', () => {
  for (const account of roleCases) {
    assert.deepEqual(getDemoCredentials(account.role), { email: account.email, password: demoPassword });
  }
});

test('demoAuth labels the employee role as บุคลากร', () => {
  const employeeShortcut = DEMO_ROLE_SHORTCUTS.find(({ role }) => role === 'Employee');
  assert.equal(employeeShortcut?.label, 'บุคลากร');
});

test('demoAuth keeps each role within its permitted pages and landing page', () => {
  for (const account of roleCases) {
    assert.equal(getLandingPage(account.role), account.landing);
    for (const page of ['home', 'ride', 'manager', 'manager-profile', 'admin'] satisfies PageId[]) {
      assert.equal(isPageAllowed(account.role, page), account.allowed.includes(page));
    }
  }
});

test('demoAuth restores a minimal, versioned session without storing the password', () => {
  const storage = new MemoryStorage();
  const user = authenticateDemoUser('student@demo.wu.ac.th', demoPassword);
  assert.ok(user);

  writeDemoSession(user, storage);

  const stored = JSON.parse(storage.getItem(DEMO_SESSION_STORAGE_KEY) ?? 'null') as Record<string, unknown>;
  assert.equal(stored.schemaVersion, 1);
  assert.deepEqual(stored.user, user);
  assert.equal('password' in stored, false);
  assert.deepEqual(readDemoSession(storage), user);

  clearDemoSession(storage);
  assert.equal(readDemoSession(storage), null);
});

test('demoAuth clears corrupt, stale, and role-tampered session records', () => {
  const storage = new MemoryStorage();
  storage.setItem(DEMO_SESSION_STORAGE_KEY, '{invalid json');
  assert.equal(readDemoSession(storage), null);
  assert.equal(storage.getItem(DEMO_SESSION_STORAGE_KEY), null);

  const student = authenticateDemoUser('student@demo.wu.ac.th', demoPassword);
  assert.ok(student);
  storage.setItem(DEMO_SESSION_STORAGE_KEY, JSON.stringify({ schemaVersion: 0, user: student }));
  assert.equal(readDemoSession(storage), null);
  storage.setItem(DEMO_SESSION_STORAGE_KEY, JSON.stringify({ schemaVersion: 1, user: { ...student, role: 'Admin' } }));
  assert.equal(readDemoSession(storage), null);
});

test('demoAuth degrades safely when browser storage throws', () => {
  const unavailableStorage = {
    getItem() { throw new Error('storage unavailable'); },
    setItem() { throw new Error('storage unavailable'); },
    removeItem() { throw new Error('storage unavailable'); },
  };
  const user = authenticateDemoUser('student@demo.wu.ac.th', demoPassword);
  assert.ok(user);

  assert.doesNotThrow(() => writeDemoSession(user, unavailableStorage));
  assert.equal(readDemoSession(unavailableStorage), null);
  assert.doesNotThrow(() => clearDemoSession(unavailableStorage));
});

test('registered demo accounts persist and authenticate without storing a plaintext password', async () => {
  const storage = new MemoryStorage();
  const registration = await registerDemoUser('ผู้ใช้ใหม่', 'New.User@demo.wu.ac.th', 'LongPassword123!', storage);

  assert.equal(registration.error, null);
  assert.ok(registration.user);
  assert.equal(registration.user.email, 'new.user@demo.wu.ac.th');
  assert.equal(registration.user.role, 'Student');

  const stored = storage.getItem(DEMO_ACCOUNTS_STORAGE_KEY) ?? '';
  assert.equal(stored.includes('LongPassword123!'), false);
  assert.equal(await authenticateUser('new.user@demo.wu.ac.th', 'LongPassword123!', storage).then((user) => user?.id), registration.user.id);
  assert.equal(await authenticateUser('new.user@demo.wu.ac.th', 'wrong-password', storage), null);
});

test('registered demo accounts reject duplicate emails regardless of letter case', async () => {
  const storage = new MemoryStorage();
  const first = await registerDemoUser('คนแรก', 'same.user@demo.wu.ac.th', 'LongPassword123!', storage);
  const duplicate = await registerDemoUser('คนที่สอง', ' SAME.USER@DEMO.WU.AC.TH ', 'DifferentPassword123!', storage);

  assert.ok(first.user);
  assert.equal(duplicate.user, null);
  assert.equal(duplicate.error, 'email-in-use');
  assert.equal(await authenticateUser('same.user@demo.wu.ac.th', 'LongPassword123!', storage).then((user) => user?.name), 'คนแรก');
});

test('registered demo accounts validate fields and can restore a session after reload', async () => {
  const storage = new MemoryStorage();
  assert.equal((await registerDemoUser('', 'valid@demo.wu.ac.th', 'LongPassword123!', storage)).error, 'invalid-input');
  assert.equal((await registerDemoUser('ผู้ใช้', 'invalid-email', 'LongPassword123!', storage)).error, 'invalid-input');
  assert.equal((await registerDemoUser('ผู้ใช้', 'valid@demo.wu.ac.th', 'short', storage)).error, 'invalid-input');

  const registration = await registerDemoUser('ผู้ใช้', 'valid@demo.wu.ac.th', 'LongPassword123!', storage);
  assert.ok(registration.user);
  writeDemoSession(registration.user, storage);
  assert.deepEqual(readDemoSession(storage), registration.user);
});

