export type PageId = 'home' | 'ride' | 'manager' | 'manager-profile' | 'profile-settings' | 'admin';
export type ManagerView = 'overview' | 'ride';
export type SessionStatus = 'idle' | 'active' | 'paused';
export type AlertSeverity = 'high' | 'warning' | 'info';
export type AlertState = 'unread' | 'acknowledged';
export type UserStatus = 'Pending' | 'Approved' | 'Rejected' | 'Suspended';
export type UserRole = 'Student' | 'Employee' | 'Manager' | 'Admin';

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
}

