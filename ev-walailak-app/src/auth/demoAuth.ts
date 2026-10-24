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

interface StoredDemoAccount extends DemoUser {
  passwordSalt: string;
  passwordHash: string;
  iterations: number;
}

export type RegistrationError = 'invalid-input' | 'email-in-use' | 'storage-unavailable' | 'crypto-unavailable';

export interface RegistrationResult {
  user: DemoUser | null;
  error: RegistrationError | null;
}

export const DEMO_SESSION_STORAGE_KEY = 'ev-walailak-demo-session:v1';
export const DEMO_ACCOUNTS_STORAGE_KEY = 'ev-walailak-demo-accounts:v1';
export const DEMO_CLOSED_ACCOUNTS_STORAGE_KEY = 'ev-walailak-closed-accounts:v1';
const SESSION_SCHEMA_VERSION = 1;
const ACCOUNT_SCHEMA_VERSION = 1;
const PASSWORD_HASH_ITERATIONS = 600_000;
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
  Student: ['home', 'ride', 'profile-settings'],
  Employee: ['home', 'ride', 'profile-settings'],
  Manager: ['home', 'ride', 'manager', 'manager-profile'],
  Admin: ['admin', 'profile-settings'],
};

const ROLE_LANDING_PAGE: Record<UserRole, PageId> = {
  Student: 'home',
  Employee: 'home',
  Manager: 'manager',
  Admin: 'admin',
};

export function authenticateDemoUser(email: string, password: string, storage?: SessionStorageLike): DemoUser | null {
  const normalizedEmail = email.trim().toLowerCase();
  const account = DEMO_ACCOUNTS.find((candidate) => candidate.email === normalizedEmail && candidate.password === password);
  return account && !isDemoAccountClosed(account.id, storage) ? toDemoUser(account) : null;
}

export async function authenticateUser(email: string, password: string, storage?: SessionStorageLike): Promise<DemoUser | null> {
  const demoUser = authenticateDemoUser(email, password, storage);
  if (demoUser) return demoUser;

  const accountStorage = getAccountStorage(storage);
  const cryptoProvider = getCrypto();
  if (!accountStorage || !cryptoProvider) return null;

  const accounts = readStoredAccounts(accountStorage);
  if (!accounts) return null;
  const account = accounts.find((candidate) => candidate.email === normalizeEmail(email));
  if (!account || isDemoAccountClosed(account.id, storage)) return null;

  try {
    const candidateHash = await derivePasswordHash(password, account.passwordSalt, cryptoProvider);
    return constantTimeEqual(candidateHash, account.passwordHash) ? toDemoUser(account) : null;
  } catch {
    return null;
  }
}

export async function registerDemoUser(
  name: string,
  email: string,
  password: string,
  storage?: SessionStorageLike,
): Promise<RegistrationResult> {
  const normalizedName = name.trim();
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedName || normalizedName.length > 80 || !isValidEmail(normalizedEmail) || password.length < 8 || password.length > 256) {
    return { user: null, error: 'invalid-input' };
  }

  const accountStorage = getAccountStorage(storage);
  const cryptoProvider = getCrypto();
  if (!accountStorage) return { user: null, error: 'storage-unavailable' };
  if (!cryptoProvider) return { user: null, error: 'crypto-unavailable' };

  const accounts = readStoredAccounts(accountStorage);
  if (!accounts) return { user: null, error: 'storage-unavailable' };
  if (DEMO_ACCOUNTS.some((account) => account.email === normalizedEmail)
    || accounts.some((account) => account.email === normalizedEmail)) {
    return { user: null, error: 'email-in-use' };
  }

  try {
    const saltBytes = cryptoProvider.getRandomValues(new Uint8Array(16));
    const passwordSalt = toHex(saltBytes);
    const passwordHash = await derivePasswordHash(password, passwordSalt, cryptoProvider);
    const user: DemoUser = {
      id: `registered-${cryptoProvider.randomUUID()}`,
      name: normalizedName,
      email: normalizedEmail,
      role: 'Student',
    };
    const storedAccount: StoredDemoAccount = {
      ...user,
      passwordSalt,
      passwordHash,
      iterations: PASSWORD_HASH_ITERATIONS,
    };
    accountStorage.setItem(DEMO_ACCOUNTS_STORAGE_KEY, JSON.stringify({
      schemaVersion: ACCOUNT_SCHEMA_VERSION,
      accounts: [...accounts, storedAccount],
    }));
    return { user, error: null };
  } catch {
    return { user: null, error: 'storage-unavailable' };
  }
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

export function closeDemoAccount(userId: string, storage?: SessionStorageLike): boolean {
  const accountStorage = getAccountStorage(storage);
  if (!accountStorage || !userId || userId.length > 120) return false;

  try {
    const closedIds = readClosedAccountIds(accountStorage);
    accountStorage.setItem(DEMO_CLOSED_ACCOUNTS_STORAGE_KEY, JSON.stringify([...new Set([...closedIds, userId])]));
    return true;
  } catch {
    return false;
  }
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

    const demoAccount = DEMO_ACCOUNTS.find((candidate) => candidate.id === parsed.user.id);
    const registeredAccount = demoAccount ? null : readStoredAccounts(getAccountStorage(storage))
      ?.find((candidate) => candidate.id === parsed.user.id) ?? null;
    const account = demoAccount ?? registeredAccount;
    if (!account || isDemoAccountClosed(account.id, storage) || !matchesAccount(parsed.user, account)) {
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

  const demoAccount = DEMO_ACCOUNTS.find((candidate) => candidate.id === user.id);
  const registeredAccount = demoAccount ? null : readStoredAccounts(getAccountStorage(storage))
    ?.find((candidate) => candidate.id === user.id) ?? null;
  const account = demoAccount ?? registeredAccount;
  if (!account || isDemoAccountClosed(account.id, storage) || !matchesAccount(user, account)) return;

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

function getAccountStorage(storage?: SessionStorageLike): SessionStorageLike | null {
  if (storage) return storage;
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function isDemoAccountClosed(userId: string, storage?: SessionStorageLike): boolean {
  const accountStorage = getAccountStorage(storage);
  return accountStorage ? readClosedAccountIds(accountStorage).includes(userId) : false;
}

function readClosedAccountIds(storage: SessionStorageLike): string[] {
  try {
    const raw = storage.getItem(DEMO_CLOSED_ACCOUNTS_STORAGE_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every((id) => typeof id === 'string' && id.length > 0 && id.length <= 120)
      ? parsed
      : [];
  } catch {
    return [];
  }
}

function readStoredAccounts(storage: SessionStorageLike | null): StoredDemoAccount[] | null {
  if (!storage) return null;
  let rawAccounts: string | null;
  try {
    rawAccounts = storage.getItem(DEMO_ACCOUNTS_STORAGE_KEY);
  } catch {
    return null;
  }
  if (rawAccounts === null) return [];

  try {
    const parsed: unknown = JSON.parse(rawAccounts);
    if (!isRecord(parsed)
      || parsed.schemaVersion !== ACCOUNT_SCHEMA_VERSION
      || !Array.isArray(parsed.accounts)
      || Object.keys(parsed).sort().join(',') !== 'accounts,schemaVersion') return null;
    const accounts = parsed.accounts;
    if (!accounts.every(isStoredDemoAccount)) return null;
    const emails = accounts.map((account) => account.email);
    const ids = accounts.map((account) => account.id);
    if (new Set(emails).size !== emails.length || new Set(ids).size !== ids.length) return null;
    return accounts;
  } catch {
    return null;
  }
}

function isStoredDemoAccount(value: unknown): value is StoredDemoAccount {
  if (!isRecord(value) || value.role !== 'Student') return false;
  return Object.keys(value).sort().join(',') === 'email,id,iterations,name,passwordHash,passwordSalt,role'
    && typeof value.id === 'string'
    && value.id.startsWith('registered-')
    && typeof value.name === 'string'
    && typeof value.email === 'string'
    && value.email === normalizeEmail(value.email)
    && typeof value.passwordSalt === 'string'
    && /^[0-9a-f]{32}$/i.test(value.passwordSalt)
    && typeof value.passwordHash === 'string'
    && /^[0-9a-f]{64}$/i.test(value.passwordHash)
    && value.iterations === PASSWORD_HASH_ITERATIONS;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getCrypto(): Crypto | null {
  return typeof globalThis.crypto === 'undefined' ? null : globalThis.crypto;
}

async function derivePasswordHash(password: string, salt: string, cryptoProvider: Crypto): Promise<string> {
  const passwordKey = await cryptoProvider.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const derivedBits = await cryptoProvider.subtle.deriveBits({
    name: 'PBKDF2',
    salt: fromHex(salt),
    iterations: PASSWORD_HASH_ITERATIONS,
    hash: 'SHA-256',
  }, passwordKey, 256);
  return toHex(new Uint8Array(derivedBits));
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function fromHex(value: string): ArrayBuffer {
  const buffer = new ArrayBuffer(value.length / 2);
  const bytes = new DataView(buffer);
  for (let index = 0; index < value.length; index += 2) {
    bytes.setUint8(index / 2, Number.parseInt(value.slice(index, index + 2), 16));
  }
  return buffer;
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
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

function matchesAccount(user: DemoUser, account: DemoUser): boolean {
  return user.id === account.id
    && user.name === account.name
    && user.email === account.email
    && user.role === account.role;
}

function toDemoUser(account: DemoUser): DemoUser {
  return { id: account.id, name: account.name, email: account.email, role: account.role };
}

function removeSession(storage: SessionStorageLike): void {
  try {
    storage.removeItem(DEMO_SESSION_STORAGE_KEY);
  } catch {
    // The session is invalid even if the browser prevents storage cleanup.
  }
}

