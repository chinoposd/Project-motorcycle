import { getLandingPage, isPageAllowed } from './demoAuth.ts';
import type { PageId, UserRole } from '../types.ts';

export interface AuthIdentity {
  id: string;
  authSource: 'demo' | 'supabase';
  role: UserRole;
}

export function shouldResetPageForAuthUpdate(
  current: AuthIdentity | null,
  next: AuthIdentity,
  currentPage: PageId,
): boolean {
  const sameIdentity = current?.id === next.id && current.authSource === next.authSource;
  return !sameIdentity || !isPageAllowed(next.role, currentPage);
}

export function getPageForAuthUpdate(next: AuthIdentity): PageId {
  return getLandingPage(next.role);
}
