export type PageId = 'home' | 'ride' | 'manager' | 'manager-profile' | 'profile-settings' | 'admin';
export type ManagerView = 'overview' | 'ride';
export type SessionStatus = 'idle' | 'reserved' | 'active' | 'paused' | 'pending-end';
export type AlertSeverity = 'high' | 'warning' | 'info';
export type AlertState = 'unread' | 'acknowledged';
export type UserStatus = 'Pending' | 'Approved' | 'Rejected' | 'Suspended';
export type UserRole = 'Student' | 'Employee' | 'Manager' | 'Admin';
export type UtilityView = 'help' | 'guide' | 'announcements' | 'trip-history' | 'issue-report' | 'inspection' | 'audit-log' | 'privacy-request';

export interface AlertRecord {
  id: string;
  title: string;
  description: string;
  time: string;
  severity: AlertSeverity;
  category: string;
  state: AlertState;
}

export interface AccountRecord {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  drivingPermission: boolean;
}

export interface DemoVehicleSession {
  id: string;
  userId: string;
  driverName: string;
  driverRole: UserRole;
  driverPhone: string | null;
  status: Exclude<SessionStatus, 'idle'>;
  locked?: boolean;
  startedAt: string;
  reserveExpiresAt: string | null;
  distanceKm: number;
  lastPositionAt: string;
}

export interface DemoTripRecord {
  sessionId: string;
  userId: string;
  driverName: string;
  startedAt: string;
  endedAt: string;
  durationMinutes: number;
  distanceKm: number | null;
}

export interface VehicleIssueRecord {
  id: string;
  reporterId: string;
  reporterName: string;
  category: string;
  details: string;
  severity: 'high' | 'low';
  state: 'open' | 'inspected' | 'resolved';
  createdAt: string;
  inspectionNote: string | null;
}

export interface AuditEntry {
  id: string;
  actorId: string;
  actorName: string;
  action: string;
  target: string;
  reason: string;
  createdAt: string;
}

export interface PrototypeAnnouncement {
  id: string;
  title: string;
  detail: string;
  time: string;
}

export interface PrototypeServiceSettings {
  serviceOpen: boolean;
  startTime: string;
  endTime: string;
  manualOutOfService: boolean;
  serviceReason: string;
}

export interface PrivacyRequestRecord {
  id: string;
  requesterId: string;
  requesterName: string;
  requestType: string;
  details: string;
  state: 'submitted' | 'reviewing' | 'completed';
  createdAt: string;
}

