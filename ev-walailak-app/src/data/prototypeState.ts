import { announcements, initialAccounts, initialAlerts, sessionHistory } from './mockData';
import type {
  AccountRecord,
  AlertRecord,
  AuditEntry,
  DemoTripRecord,
  DemoVehicleSession,
  PrivacyRequestRecord,
  PrototypeAnnouncement,
  PrototypeServiceSettings,
  UserRole,
  UserStatus,
  VehicleIssueRecord,
} from '../types';

export const PROTOTYPE_STORAGE_KEY = 'ev-walailak-prototype-state:v1';
const SCHEMA_VERSION = 1;

export interface PrototypeState {
  schemaVersion: 1;
  session: DemoVehicleSession | null;
  trips: DemoTripRecord[];
  issues: VehicleIssueRecord[];
  alerts: AlertRecord[];
  accounts: AccountRecord[];
  service: PrototypeServiceSettings;
  announcements: PrototypeAnnouncement[];
  auditLog: AuditEntry[];
  privacyRequests: PrivacyRequestRecord[];
}

export interface PrototypeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface NewIssueInput {
  reporterId: string;
  reporterName: string;
  category: string;
  details: string;
  severity: 'high' | 'low';
}

export interface AuditActor {
  id: string;
  name: string;
}

export interface ReserveSessionInput {
  userId: string;
  driverName: string;
  driverRole: Exclude<UserRole, 'Admin'>;
  driverPhone: string | null;
}

function browserStorage(): PrototypeStorage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSession(value: unknown): value is DemoVehicleSession | null {
  if (value === null) return true;
  if (!isRecord(value)) return false;
  return typeof value.id === 'string'
    && typeof value.userId === 'string'
    && typeof value.driverName === 'string'
    && typeof value.driverRole === 'string'
    && ['Student', 'Employee', 'Manager', 'Admin'].includes(value.driverRole)
    && (value.driverPhone === null || typeof value.driverPhone === 'string')
    && ['reserved', 'active', 'paused', 'pending-end'].includes(String(value.status))
    && (value.locked === undefined || typeof value.locked === 'boolean')
    && typeof value.startedAt === 'string'
    && (value.reserveExpiresAt === null || typeof value.reserveExpiresAt === 'string')
    && typeof value.distanceKm === 'number'
    && typeof value.lastPositionAt === 'string';
}

function isPrototypeState(value: unknown): value is PrototypeState {
  if (!isRecord(value) || value.schemaVersion !== SCHEMA_VERSION) return false;
  if (!Array.isArray(value.trips) || !value.trips.every(isTrip)) return false;
  if (!Array.isArray(value.issues) || !value.issues.every(isIssue)) return false;
  if (!Array.isArray(value.alerts) || !value.alerts.every(isAlert)) return false;
  if (!Array.isArray(value.accounts) || !value.accounts.every(isAccount)) return false;
  if (!Array.isArray(value.announcements) || !value.announcements.every(isAnnouncement)) return false;
  if (!Array.isArray(value.auditLog) || !value.auditLog.every(isAuditEntry)) return false;
  if (!Array.isArray(value.privacyRequests) || !value.privacyRequests.every(isPrivacyRequest)) return false;
  if (!isRecord(value.service)) return false;
  return isSession(value.session)
    && typeof value.service.serviceOpen === 'boolean'
    && typeof value.service.startTime === 'string'
    && typeof value.service.endTime === 'string'
    && typeof value.service.manualOutOfService === 'boolean'
    && typeof value.service.serviceReason === 'string';
}

function isTrip(value: unknown): value is DemoTripRecord {
  return isRecord(value)
    && typeof value.sessionId === 'string'
    && typeof value.userId === 'string'
    && typeof value.driverName === 'string'
    && typeof value.startedAt === 'string'
    && typeof value.endedAt === 'string'
    && typeof value.durationMinutes === 'number'
    && (typeof value.distanceKm === 'number' || value.distanceKm === null);
}

function isIssue(value: unknown): value is VehicleIssueRecord {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.reporterId === 'string'
    && typeof value.reporterName === 'string'
    && typeof value.category === 'string'
    && typeof value.details === 'string'
    && (value.severity === 'high' || value.severity === 'low')
    && ['open', 'inspected', 'resolved'].includes(String(value.state))
    && typeof value.createdAt === 'string'
    && (typeof value.inspectionNote === 'string' || value.inspectionNote === null);
}

function isAlert(value: unknown): value is AlertRecord {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.title === 'string'
    && typeof value.description === 'string'
    && typeof value.time === 'string'
    && ['high', 'warning', 'info'].includes(String(value.severity))
    && typeof value.category === 'string'
    && (value.state === 'unread' || value.state === 'acknowledged');
}

function isAccount(value: unknown): value is AccountRecord {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.name === 'string'
    && typeof value.email === 'string'
    && ['Student', 'Employee', 'Manager', 'Admin'].includes(String(value.role))
    && ['Pending', 'Approved', 'Rejected', 'Suspended'].includes(String(value.status))
    && typeof value.drivingPermission === 'boolean';
}

function isAnnouncement(value: unknown): value is PrototypeAnnouncement {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.title === 'string'
    && typeof value.detail === 'string'
    && typeof value.time === 'string';
}

function isAuditEntry(value: unknown): value is AuditEntry {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.actorId === 'string'
    && typeof value.actorName === 'string'
    && typeof value.action === 'string'
    && typeof value.target === 'string'
    && typeof value.reason === 'string'
    && typeof value.createdAt === 'string';
}

function isPrivacyRequest(value: unknown): value is PrivacyRequestRecord {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.requesterId === 'string'
    && typeof value.requesterName === 'string'
    && typeof value.requestType === 'string'
    && typeof value.details === 'string'
    && ['submitted', 'reviewing', 'completed'].includes(String(value.state))
    && typeof value.createdAt === 'string';
}

export function createInitialPrototypeState(): PrototypeState {
  const issue: VehicleIssueRecord = {
    id: 'issue-demo-brake',
    reporterId: 'demo-student',
    reporterName: 'นภัส พรหมดี',
    category: 'เบรก / ความปลอดภัยสูง',
    details: 'รายการรายงานตัวอย่างเพื่อสาธิต Safety Block',
    severity: 'high',
    state: 'open',
    createdAt: '2026-10-26T10:41:00+07:00',
    inspectionNote: null,
  };

  return {
    schemaVersion: SCHEMA_VERSION,
    session: null,
    trips: sessionHistory.map((trip) => ({ ...trip })),
    issues: [issue],
    alerts: initialAlerts.map((alert) => ({ ...alert })),
    accounts: initialAccounts.map((account) => ({ ...account })),
    service: {
      serviceOpen: true,
      startTime: '08:00',
      endTime: '17:00',
      manualOutOfService: false,
      serviceReason: '',
    },
    announcements: announcements.map((announcement) => ({ ...announcement })),
    auditLog: [],
    privacyRequests: [],
  };
}

export function readPrototypeState(storage = browserStorage()): PrototypeState {
  if (!storage) return createInitialPrototypeState();
  try {
    const raw = storage.getItem(PROTOTYPE_STORAGE_KEY);
    if (!raw) return createInitialPrototypeState();
    const parsed: unknown = JSON.parse(raw);
    return isPrototypeState(parsed) ? parsed : createInitialPrototypeState();
  } catch {
    return createInitialPrototypeState();
  }
}

export function readLatestPrototypeState(fallback: PrototypeState): PrototypeState {
  const storage = browserStorage();
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(PROTOTYPE_STORAGE_KEY);
    if (!raw) return createInitialPrototypeState();
    const parsed: unknown = JSON.parse(raw);
    return isPrototypeState(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function writePrototypeState(state: PrototypeState, storage = browserStorage()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(PROTOTYPE_STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function createPrototypeId(prefix: string): string {
  const uniquePart = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  return `${prefix}-${uniquePart}`;
}

export function hasActiveSafetyBlock(state: PrototypeState): boolean {
  return state.issues.some((issue) => issue.severity === 'high' && issue.state !== 'resolved');
}

export function isPrototypeVehicleAvailable(state: PrototypeState): boolean {
  return state.service.serviceOpen && !state.service.manualOutOfService && !hasActiveSafetyBlock(state) && !state.session;
}

export function reservePrototypeSession(state: PrototypeState, input: ReserveSessionInput, now = new Date()): PrototypeState | null {
  if (!isPrototypeVehicleAvailable(state)) return null;
  const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);
  const session: DemoVehicleSession = {
    id: createPrototypeId('session'),
    userId: input.userId,
    driverName: input.driverName,
    driverRole: input.driverRole,
    driverPhone: input.driverPhone,
    status: 'reserved',
    locked: false,
    startedAt: now.toISOString(),
    reserveExpiresAt: expiresAt.toISOString(),
    distanceKm: 0,
    lastPositionAt: now.toISOString(),
  };
  return { ...state, session };
}

export function expirePrototypeReservation(state: PrototypeState, now = new Date()): PrototypeState {
  if (state.session?.status !== 'reserved' || !state.session.reserveExpiresAt
    || Date.parse(state.session.reserveExpiresAt) > now.getTime()) return state;
  return { ...state, session: null };
}

export function cancelPrototypeReservation(state: PrototypeState, userId: string): PrototypeState {
  return state.session?.userId === userId && state.session.status === 'reserved'
    ? { ...state, session: null }
    : state;
}

export function activatePrototypeSession(state: PrototypeState, userId: string, now = new Date()): PrototypeState | null {
  const session = state.session;
  if (!session || session.userId !== userId || session.status !== 'reserved') return null;
  if (session.reserveExpiresAt && Date.parse(session.reserveExpiresAt) <= now.getTime()) return expirePrototypeReservation(state, now);
  return {
    ...state,
    session: { ...session, status: 'active', locked: false, startedAt: now.toISOString(), reserveExpiresAt: null, lastPositionAt: now.toISOString() },
  };
}

export function setPrototypeSessionStatus(
  state: PrototypeState,
  userId: string,
  status: 'active' | 'paused',
): PrototypeState | null {
  if (!state.session || state.session.userId !== userId || !['active', 'paused'].includes(state.session.status)) return null;
  return { ...state, session: { ...state.session, status, lastPositionAt: new Date().toISOString() } };
}

export function setPrototypeSessionLock(state: PrototypeState, userId: string, locked: boolean): PrototypeState | null {
  if (!state.session || state.session.userId !== userId || state.session.status !== 'paused') return null;
  return { ...state, session: { ...state.session, locked, lastPositionAt: new Date().toISOString() } };
}

export function completePrototypeSession(state: PrototypeState, userId: string, endedAt = new Date()): PrototypeState | null {
  const session = state.session;
  if (!session || session.userId !== userId || session.status !== 'paused') return null;
  const elapsed = Math.max(0, endedAt.getTime() - Date.parse(session.startedAt));
  const trip: DemoTripRecord = {
    sessionId: session.id,
    userId: session.userId,
    driverName: session.driverName,
    startedAt: session.startedAt,
    endedAt: endedAt.toISOString(),
    durationMinutes: Math.max(1, Math.round(elapsed / 60_000)),
    distanceKm: session.distanceKm,
  };
  return { ...state, session: null, trips: [trip, ...state.trips] };
}

export function acknowledgePrototypeAlert(state: PrototypeState, alertId: string): PrototypeState {
  return {
    ...state,
    alerts: state.alerts.map((alert) => alert.id === alertId ? { ...alert, state: 'acknowledged' } : alert),
  };
}

export function reportPrototypeIssue(state: PrototypeState, input: NewIssueInput, createdAt = new Date().toISOString()): PrototypeState {
  const id = createPrototypeId('issue');
  const issue: VehicleIssueRecord = { ...input, id, state: 'open', createdAt, inspectionNote: null };
  const alert: AlertRecord = {
    id: `alert-${id}`,
    title: input.category,
    description: input.details,
    time: new Date(createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' }) + ' น.',
    severity: input.severity === 'high' ? 'high' : 'warning',
    category: input.severity === 'high' ? 'Safety Block' : 'รายงานผู้ใช้',
    state: 'unread',
  };
  return { ...state, issues: [issue, ...state.issues], alerts: [alert, ...state.alerts] };
}

export function inspectPrototypeIssue(state: PrototypeState, issueId: string, inspectionNote: string, safeToClear: boolean): PrototypeState {
  return {
    ...state,
    issues: state.issues.map((issue) => issue.id === issueId
      ? { ...issue, state: safeToClear ? 'resolved' : 'inspected', inspectionNote: inspectionNote.trim() }
      : issue),
  };
}

export function setDemoAccountStatus(state: PrototypeState, accountId: string, status: UserStatus): PrototypeState {
  return {
    ...state,
    accounts: state.accounts.map((account) => account.id === accountId ? { ...account, status } : account),
  };
}

export function setDemoDrivingPermission(state: PrototypeState, accountId: string, drivingPermission: boolean): PrototypeState {
  return {
    ...state,
    accounts: state.accounts.map((account) => account.id === accountId ? { ...account, drivingPermission } : account),
  };
}

export function addPrototypeAuditEntry(
  state: PrototypeState,
  actor: AuditActor,
  action: string,
  target: string,
  reason: string,
  createdAt = new Date().toISOString(),
): PrototypeState {
  const entry: AuditEntry = {
    id: createPrototypeId('audit'),
    actorId: actor.id,
    actorName: actor.name,
    action,
    target,
    reason: reason.trim(),
    createdAt,
  };
  return { ...state, auditLog: [entry, ...state.auditLog] };
}

export function setPrototypeService(state: PrototypeState, service: PrototypeServiceSettings): PrototypeState {
  return { ...state, service: { ...service } };
}

export function submitPrototypePrivacyRequest(
  state: PrototypeState,
  requester: AuditActor,
  requestType: string,
  details: string,
): PrototypeState {
  const request: PrivacyRequestRecord = {
    id: createPrototypeId('privacy'),
    requesterId: requester.id,
    requesterName: requester.name,
    requestType: requestType.trim(),
    details: details.trim(),
    state: 'submitted',
    createdAt: new Date().toISOString(),
  };
  return { ...state, privacyRequests: [request, ...state.privacyRequests] };
}

export function setPrototypePrivacyRequestState(
  state: PrototypeState,
  requestId: string,
  status: PrivacyRequestRecord['state'],
): PrototypeState {
  return {
    ...state,
    privacyRequests: state.privacyRequests.map((request) => request.id === requestId ? { ...request, state: status } : request),
  };
}

export function addPrototypeAnnouncement(state: PrototypeState, title: string, detail: string): PrototypeState {
  const announcement: PrototypeAnnouncement = {
    id: createPrototypeId('announcement'),
    title: title.trim(),
    detail: detail.trim(),
    time: 'ประกาศใหม่',
  };
  return { ...state, announcements: [announcement, ...state.announcements] };
}

export function userTrips(state: PrototypeState, userId: string): DemoTripRecord[] {
  return state.trips
    .filter((trip) => trip.userId === userId)
    .sort((first, second) => Date.parse(second.endedAt) - Date.parse(first.endedAt));
}

export function sessionForViewer(state: PrototypeState, role: UserRole, userId: string): DemoVehicleSession | null {
  if (!state.session) return null;
  if (role === 'Manager' || role === 'Admin') return state.session.status === 'active' ? state.session : null;
  if (state.session.userId !== userId) return null;
  return state.session;
}
