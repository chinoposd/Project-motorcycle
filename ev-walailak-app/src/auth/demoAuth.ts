import type { PageId, UserRole } from '../types.ts';

export interface DemoUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface SessionStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface DemoAccount extends DemoUser {
  password: string;
  shortcutLabel: string;
}

export const DEMO_SESSION_STORAGE_KEY = 'ev-walailak-demo-session:v1';
const SESSION_SCHEMA_VERSION = 1;
const DEMO_PASSWORD = 'Demo1234!';

const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  { id: 'demo-student', name: 'นภัส', email: 'student@demo.wu.ac.th', role: 'Student', password: DEMO_PASSWORD, shortcutLabel: 'นักศึกษา' },
  { id: 'demo-employee', name: 'บุคลากรทดลอง', email: 'employee@demo.wu.ac.th', role: 'Employee', password: DEMO_PASSWORD, shortcutLabel: 'บุคลากร' },
  { id: 'demo-manager', name: 'ผู้จัดการระบบ', email: 'manager@demo.wu.ac.th', role: 'Manager', password: DEMO_PASSWORD, shortcutLabel: 'ผู้จัดการ' },
  { id: 'demo-admin', name: 'ผู้ดูแลระบบ', email: 'admin@demo.wu.ac.th', role: 'Admin', password: DEMO_PASSWORD, shortcutLabel: 'ผู้ดูแลระบบ' },
];

export const DEMO_ROLE_SHORTCUTS: readonly { role: UserRole; label: string }[] = DEMO_ACCOUNTS.map(({ role, shortcutLabel }) => ({
  role,
  label: shortcutLabel,
}));

const ROLE_PAGES: Record<UserRole, readonly PageId[]> = {
  Student: ['home', 'ride'],
  Employee: ['home', 'ride'],
  Manager: ['home', 'ride', 'manager'],
  Admin: ['admin'],
};

const ROLE_LANDING_PAGE: Record<UserRole, PageId> = {
  Student: 'home',
  Employee: 'home',
  Manager: 'manager',
  Admin: 'admin',
};

export function authenticateDemoUser(email: string, password: string): DemoUser | null {
  const normalizedEmail = email.trim().toLowerCase();
  const account = DEMO_ACCOUNTS.find((candidate) => candidate.email === normalizedEmail && candidate.password === password);
  return account ? toDemoUser(account) : null;
}

export function getDemoCredentials(role: UserRole): { email: string; password: string } {
  const account = DEMO_ACCOUNTS.find((candidate) => candidate.role === role);
  if (!account) throw new Error('Unsupported demo role');
  return { email: account.email, password: account.password };
}

export function isPageAllowed(role: UserRole, page: PageId): boolean {
  return ROLE_PAGES[role]?.includes(page) ?? false;
}

export function getLandingPage(role: UserRole): PageId {
  return ROLE_LANDING_PAGE[role];
}

export function readDemoSession(storage?: SessionStorageLike): DemoUser | null {
  const sessionStorage = getStorage(storage);
  if (!sessionStorage) return null;

  let rawSession: string | null;
  try {
    rawSession = sessionStorage.getItem(DEMO_SESSION_STORAGE_KEY);
  } catch {
    return null;
  }

  if (rawSession === null) return null;

  try {
    const parsed: unknown = JSON.parse(rawSession);
    if (!isSessionRecord(parsed)) {
      removeSession(sessionStorage);
      return null;
    }

    const account = DEMO_ACCOUNTS.find((candidate) => candidate.id === parsed.user.id);
    if (!account || !matchesAccount(parsed.user, account)) {
      removeSession(sessionStorage);
      return null;
    }

    return toDemoUser(account);
  } catch {
    removeSession(sessionStorage);
    return null;
  }
}

export function writeDemoSession(user: DemoUser, storage?: SessionStorageLike): void {
  const sessionStorage = getStorage(storage);
  if (!sessionStorage) return;

  const account = DEMO_ACCOUNTS.find((candidate) => candidate.id === user.id);
  if (!account || !matchesAccount(user, account)) return;

  try {
    sessionStorage.setItem(DEMO_SESSION_STORAGE_KEY, JSON.stringify({
      schemaVersion: SESSION_SCHEMA_VERSION,
      user: toDemoUser(account),
    }));
  } catch {
    // The demo session remains usable in memory when browser storage is unavailable.
  }
}

export function clearDemoSession(storage?: SessionStorageLike): void {
  const sessionStorage = getStorage(storage);
  if (!sessionStorage) return;
  removeSession(sessionStorage);
}

function getStorage(storage?: SessionStorageLike): SessionStorageLike | null {
  if (storage) return storage;
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

function isSessionRecord(value: unknown): value is { schemaVersion: number; user: DemoUser } {
  if (!isRecord(value) || value.schemaVersion !== SESSION_SCHEMA_VERSION || !isDemoUser(value.user)) return false;
  return Object.keys(value).sort().join(',') === 'schemaVersion,user';
}

function isDemoUser(value: unknown): value is DemoUser {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value).sort().join(',');
  return keys === 'email,id,name,role'
    && typeof value.id === 'string'
    && typeof value.name === 'string'
    && typeof value.email === 'string'
    && isUserRole(value.role);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUserRole(value: unknown): value is UserRole {
  return value === 'Student' || value === 'Employee' || value === 'Manager' || value === 'Admin';
}

function matchesAccount(user: DemoUser, account: DemoAccount): boolean {
  return user.id === account.id
    && user.name === account.name
    && user.email === account.email
    && user.role === account.role;
}

function toDemoUser(account: DemoAccount): DemoUser {
  return { id: account.id, name: account.name, email: account.email, role: account.role };
}

function removeSession(storage: SessionStorageLike): void {
  try {
    storage.removeItem(DEMO_SESSION_STORAGE_KEY);
  } catch {
    // The session is invalid even if the browser prevents storage cleanup.
  }
}
