import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PageId, UserRole } from '../src/types.ts';
import {
  authenticateDemoUser,
  clearDemoSession,
  DEMO_ROLE_SHORTCUTS,
  DEMO_SESSION_STORAGE_KEY,
  getDemoCredentials,
  getLandingPage,
  isPageAllowed,
  readDemoSession,
  writeDemoSession,
} from '../src/auth/demoAuth.ts';

const demoPassword = 'Demo1234!';

const roleCases: { role: UserRole; email: string; landing: PageId; allowed: PageId[] }[] = [
  { role: 'Student', email: 'student@demo.wu.ac.th', landing: 'home', allowed: ['home', 'ride'] },
  { role: 'Employee', email: 'employee@demo.wu.ac.th', landing: 'home', allowed: ['home', 'ride'] },
  { role: 'Manager', email: 'manager@demo.wu.ac.th', landing: 'manager', allowed: ['home', 'ride', 'manager'] },
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
    for (const page of ['home', 'ride', 'manager', 'admin'] satisfies PageId[]) {
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
