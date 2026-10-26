import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { AuthRequestEpoch } from './auth/authRequestEpoch';
import { requiresApprovalGate } from './auth/accountAccess';
import { getPageForAuthUpdate, shouldResetPageForAuthUpdate } from './auth/authSessionPolicy';
import { clearDemoSession, closeDemoAccount, getLandingPage, isPageAllowed, readDemoSession, writeDemoSession, type DemoUser } from './auth/demoAuth';
import { getCurrentSupabaseUser, sendSupabasePasswordReset, signOutSupabase, updateSupabasePassword, type AppUser } from './auth/supabaseAuth';
import { createSupabaseProfilePhotoUrl, saveSupabaseProfilePhoto, updateSupabaseProfile } from './auth/supabaseProfile';
import { supabase, supabaseConfig } from './auth/supabaseClient';
import { readManagerProfile, writeManagerProfile, type ManagerProfile } from './auth/managerProfile';
import { readUserProfile, writeUserProfile } from './auth/userProfile';
import { readProfilePhoto, writeProfilePhoto } from './auth/profilePhoto';
import {
  acknowledgePrototypeAlert,
  activatePrototypeSession,
  addPrototypeAuditEntry,
  cancelPrototypeReservation,
  completePrototypeSession,
  expirePrototypeReservation,
  hasActiveSafetyBlock,
  inspectPrototypeIssue,
  isPrototypeVehicleAvailable,
  readLatestPrototypeState,
  readPrototypeState,
  reportPrototypeIssue,
  reservePrototypeSession,
  setPrototypeSessionLock,
  setPrototypeSessionStatus,
  setPrototypePrivacyRequestState,
  submitPrototypePrivacyRequest,
  writePrototypeState,
  PROTOTYPE_STORAGE_KEY,
  type PrototypeState,
} from './data/prototypeState';
import AppShell from './components/AppShell';
import EndSessionDialog from './components/EndSessionDialog';
import PreflightDialog from './components/PreflightDialog';
import PasswordRecoveryPage from './pages/PasswordRecoveryPage';
import UtilityViewPage from './pages/UtilityViewPage';
import AdminPage from './pages/AdminPage';
import ApprovalStatusPage from './pages/ApprovalStatusPage';
import LoginPage from './pages/LoginPage';
import ManagerPage from './pages/ManagerPage';
import ManagerProfilePage from './pages/ManagerProfilePage';
import ProfileSettingsPage from './pages/ProfileSettingsPage';
import OverviewPage from './pages/OverviewPage';
import RidePage from './pages/RidePage';
import type { ManagerView, PageId, SessionStatus, UtilityView } from './types';

function isWithinServiceHours(start: string, end: string, now = new Date()): boolean {
  const localTime = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(now);
  return start <= end ? localTime >= start && localTime <= end : localTime >= start || localTime <= end;
}

const APP_HISTORY_STATE_KEY = '__evWalailakApp';

interface AppHistoryState {
  page: PageId;
  managerView: ManagerView;
}

const APP_PAGE_PATHS: Record<PageId, string> = {
  home: '/OverviewPage',
  ride: '/RidePage',
  manager: '/ManagerPage',
  'manager-profile': '/ManagerProfilePage',
  'profile-settings': '/ProfileSettingsPage',
  admin: '/AdminPage',
};

function getPageForPath(pathname: string): PageId | null {
  if (pathname === '/ManagerRidePage') return 'manager';
  const page = Object.entries(APP_PAGE_PATHS).find(([, path]) => path === pathname)?.[0];
  return page ? page as PageId : null;
}

function getManagerViewForPath(pathname: string): ManagerView {
  return pathname === '/ManagerRidePage' ? 'ride' : 'overview';
}

function getPathForAppState(page: PageId, managerView: ManagerView): string {
  return page === 'manager' && managerView === 'ride' ? '/ManagerRidePage' : APP_PAGE_PATHS[page];
}

function readAppHistoryState(state: unknown): AppHistoryState | null {
  if (!state || typeof state !== 'object') return null;
  const appState = (state as Record<string, unknown>)[APP_HISTORY_STATE_KEY];
  if (!appState || typeof appState !== 'object') return null;

  const { page, managerView } = appState as Record<string, unknown>;
  const validPages: PageId[] = ['home', 'ride', 'manager', 'manager-profile', 'profile-settings', 'admin'];
  if (!validPages.includes(page as PageId) || (managerView !== 'overview' && managerView !== 'ride')) return null;
  return { page: page as PageId, managerView };
}

function makeHistoryState(page: PageId, managerView: ManagerView): Record<string, unknown> {
  const currentState = window.history.state;
  const baseState = currentState && typeof currentState === 'object' && !Array.isArray(currentState)
    ? currentState as Record<string, unknown>
    : {};
  return { ...baseState, [APP_HISTORY_STATE_KEY]: { page, managerView } };
}

const AdminPage = lazy(() => import('./pages/AdminPage'));
const ApprovalStatusPage = lazy(() => import('./pages/ApprovalStatusPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const ManagerPage = lazy(() => import('./pages/ManagerPage'));
const ManagerProfilePage = lazy(() => import('./pages/ManagerProfilePage'));
const ProfileSettingsPage = lazy(() => import('./pages/ProfileSettingsPage'));
const OverviewPage = lazy(() => import('./pages/OverviewPage'));
const PasswordRecoveryPage = lazy(() => import('./pages/PasswordRecoveryPage'));
const RidePage = lazy(() => import('./pages/RidePage'));

const appPageFallback = <div className="page-loading" role="status" aria-live="polite">กำลังโหลดหน้า…</div>;

export default function App() {
  const [user, setUser] = useState<AppUser | null>(() => {
    const restored = readDemoSession();
    if (!restored) return null;
    const name = restored.role === 'Manager'
      ? readManagerProfile(restored.id, restored.name).name
      : restored.role === 'Admin' ? readUserProfile(restored.id).name ?? restored.name : restored.name;
    return { ...restored, name, authSource: 'demo' };
  });
  const [isRestoringAuth, setIsRestoringAuth] = useState(supabaseConfig.mode === 'configured');
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [managerProfile, setManagerProfile] = useState<ManagerProfile>(() => {
    const restored = readDemoSession();
    return restored?.role === 'Manager'
      ? readManagerProfile(restored.id, restored.name)
      : { name: 'ผู้จัดการระบบ', phone: '', department: 'ระบบบริหารยานพาหนะไฟฟ้า' };
  });
  const [page, setPage] = useState<PageId>(() => user ? getLandingPage(user.role) : 'home');
  const [managerView, setManagerView] = useState<ManagerView>('overview');
  const [utilityView, setUtilityView] = useState<UtilityView | null>(null);
  const [isPreflightOpen, setIsPreflightOpen] = useState(false);
  const [isEndSessionOpen, setIsEndSessionOpen] = useState(false);
  const [passwordRecoveryMode, setPasswordRecoveryMode] = useState<'request' | 'update' | null>(
    () => new URLSearchParams(window.location.search).get('recovery') === '1' ? 'update' : null,
  );
  const [prototypeState, setPrototypeState] = useState<PrototypeState>(readPrototypeState);
  const prototypeStateRef = useRef(prototypeState);
  const alerts = prototypeState.alerts;
  const ownSession = user && prototypeState.session?.userId === user.id ? prototypeState.session : null;
  const sessionStatus: SessionStatus = ownSession?.status ?? 'idle';
  const [toast, setToast] = useState('');
  const currentUserRef = useRef(user);
  const currentPageRef = useRef(page);
  const authRequestEpochRef = useRef(new AuthRequestEpoch());
  const [profilePhoto, setProfilePhoto] = useState<string | null>(() => user ? readProfilePhoto(user.id) : null);

  const showToast = useCallback((message: string) => setToast(message), []);

  function getLatestPrototypeState(): PrototypeState {
    const latest = readLatestPrototypeState(prototypeStateRef.current);
    prototypeStateRef.current = latest;
    setPrototypeState(latest);
    return latest;
  }

  function updatePrototypeState(update: (current: PrototypeState) => PrototypeState): boolean {
    const latest = getLatestPrototypeState();
    const next = update(latest);
    prototypeStateRef.current = next;
    setPrototypeState(next);
    return writePrototypeState(next);
  }

  function navigatePage(nextPage: PageId) {
    currentPageRef.current = nextPage;
    setPage(nextPage);
    setUtilityView(null);
  }

  function handleOpenUtility(nextView: UtilityView) {
    if (!user) return;
    const allowedViews: Record<DemoUser['role'], readonly UtilityView[]> = {
      Student: ['help', 'guide', 'announcements', 'trip-history', 'issue-report', 'privacy-request'],
      Employee: ['help', 'guide', 'announcements', 'trip-history', 'issue-report', 'privacy-request'],
      Manager: ['help', 'guide', 'announcements', 'trip-history', 'issue-report', 'inspection'],
      Admin: ['help', 'guide', 'announcements', 'inspection', 'audit-log', 'privacy-request'],
    };
    if (!allowedViews[user.role].includes(nextView)) {
      showToast('บัญชีนี้ไม่มีสิทธิ์เปิดรายการดังกล่าว');
      return;
    }
    setUtilityView(nextView);
  }

  useEffect(() => {
    if (!supabase) return undefined;
    let mounted = true;

    function clearCloudIdentity() {
      if (currentUserRef.current?.authSource !== 'supabase') return;
      currentUserRef.current = null;
      setUser(null);
      setProfilePhoto(null);
      navigatePage('home');
    }

    async function resolveCloudSession(requestEpoch: number, expectedUserId?: string) {
      try {
        const result = await getCurrentSupabaseUser();
        if (!mounted || !authRequestEpochRef.current.isCurrent(requestEpoch)) return;
        if (result.user && expectedUserId && result.user.id !== expectedUserId) {
          clearCloudIdentity();
          return;
        }
        if (result.user) {
          clearDemoSession();
          const shouldResetPage = shouldResetPageForAuthUpdate(currentUserRef.current, result.user, currentPageRef.current);
          currentUserRef.current = result.user;
          setUser(result.user);
          setProfilePhoto(readProfilePhoto(result.user.id));
          if (shouldResetPage) navigatePage(getPageForAuthUpdate(result.user));
          setManagerProfile({ name: 'ผู้จัดการระบบ', phone: '', department: 'ระบบบริหารยานพาหนะไฟฟ้า' });
        } else if (result.error === 'profile-missing' || result.error === 'profile-invalid') {
          clearCloudIdentity();
          await signOutSupabase().catch(() => undefined);
        }
      } catch {
        // A changed identity was cleared before starting the lookup. Network
        // failure must not restore it or produce an unhandled rejection.
      } finally {
        if (mounted && authRequestEpochRef.current.isCurrent(requestEpoch)) setIsRestoringAuth(false);
      }
    }

    // Start the fallback restore first so even a synchronous initial auth event
    // advances the epoch beyond it and remains authoritative.
    void resolveCloudSession(authRequestEpochRef.current.begin());
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY') {
        authRequestEpochRef.current.invalidate();
        clearDemoSession();
        currentUserRef.current = null;
        setUser(null);
        setProfilePhoto(null);
        setPasswordRecoveryMode('update');
        setIsRestoringAuth(false);
        return;
      }
      if (event === 'SIGNED_OUT' || (event === 'INITIAL_SESSION' && !session)) {
        authRequestEpochRef.current.invalidate();
        clearCloudIdentity();
        setIsRestoringAuth(false);
        return;
      }
      // Refreshes, user updates, and initial sessions all supersede earlier
      // lookups, even when Supabase emits multiple events for the same user.
      if (!session) return;
      const requestEpoch = authRequestEpochRef.current.begin();
      const expectedUserId = session.user.id;
      const sameIdentity = currentUserRef.current?.authSource === 'supabase'
        && currentUserRef.current.id === expectedUserId;
      if (!sameIdentity) {
        clearCloudIdentity();
        setIsRestoringAuth(true);
      }
      queueMicrotask(() => {
        if (!mounted || !authRequestEpochRef.current.isCurrent(requestEpoch)) return;
        void resolveCloudSession(requestEpoch, expectedUserId);
      });
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    function handlePrototypeStorage(event: StorageEvent) {
      if (event.key !== PROTOTYPE_STORAGE_KEY && event.key !== null) return;
      const latest = readPrototypeState();
      prototypeStateRef.current = latest;
      setPrototypeState(latest);
    }
    window.addEventListener('storage', handlePrototypeStorage);
    return () => window.removeEventListener('storage', handlePrototypeStorage);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const current = readLatestPrototypeState(prototypeStateRef.current);
      prototypeStateRef.current = current;
      const expired = expirePrototypeReservation(current);
      if (expired !== current) {
        prototypeStateRef.current = expired;
        setPrototypeState(expired);
        writePrototypeState(expired);
        setToast('หมดเวลาสงวนรถตัวอย่างแล้ว · กลับไปเริ่มใหม่ได้');
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(''), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  function handleLogin(nextUser: AppUser) {
    authRequestEpochRef.current.invalidate();
    setIsRestoringAuth(false);
    if (nextUser.authSource === 'demo') {
      void signOutSupabase();
      writeDemoSession(nextUser);
    } else clearDemoSession();
    const nextProfile = nextUser.authSource === 'demo' && nextUser.role === 'Manager'
      ? readManagerProfile(nextUser.id, nextUser.name)
      : managerProfile;
    setManagerProfile(nextProfile);
    const userProfile = nextUser.authSource === 'demo' && nextUser.role === 'Admin' ? readUserProfile(nextUser.id) : null;
    const authenticatedUser = nextUser.authSource === 'demo' && nextUser.role === 'Manager'
      ? { ...nextUser, name: nextProfile.name }
      : nextUser.authSource === 'demo' && nextUser.role === 'Admin'
        ? { ...nextUser, name: userProfile?.name ?? nextUser.name }
        : nextUser;
    currentUserRef.current = authenticatedUser;
    setUser(authenticatedUser);
    setProfilePhoto(readProfilePhoto(nextUser.id));
    navigatePage(getLandingPage(nextUser.role));
    setToast('');
  }

  function handlePasswordUpdated() {
    authRequestEpochRef.current.invalidate();
    void signOutSupabase();
    clearDemoSession();
    currentUserRef.current = null;
    setUser(null);
    setIsRestoringAuth(false);
    setPasswordRecoveryMode(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('recovery');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    setToast('เปลี่ยนรหัสผ่านแล้ว · เข้าสู่ระบบด้วยรหัสผ่านใหม่ได้เลย');
  }

  function handleLogout() {
    authRequestEpochRef.current.invalidate();
    setIsPasswordRecovery(false);
    if (user?.authSource === 'supabase') void signOutSupabase();
    clearDemoSession();
    currentUserRef.current = null;
    setUser(null);
    setProfilePhoto(null);
    setManagerProfile({ name: 'ผู้จัดการระบบ', phone: '', department: 'ระบบบริหารยานพาหนะไฟฟ้า' });
    navigatePage('home');
    setManagerView('overview');
    setUtilityView(null);
    setToast('');
  }

  function handleNavigate(nextPage: PageId) {
    if (!user) return;
    if (user.authSource === 'supabase' && nextPage === 'manager-profile') {
      showToast('การตั้งค่าโปรไฟล์ Manager ยังไม่เปิดใช้');
      return;
    }
    navigatePage(isPageAllowed(user.role, nextPage) ? nextPage : getLandingPage(user.role));
  }

  function handleManagerProfileSave(profile: ManagerProfile): boolean {
    if (user?.authSource === 'supabase') {
      showToast('การแก้โปรไฟล์บัญชีจริงยังไม่เปิดใช้ · ไม่มีการบันทึกข้อมูล');
      return false;
    }
    if (!user || user.role !== 'Manager' || !writeManagerProfile(user.id, profile)) {
      showToast('บันทึกไม่สำเร็จ · เบราว์เซอร์อาจปิดการจัดเก็บข้อมูล');
      return false;
    }
    const normalizedProfile = readManagerProfile(user.id, user.name);
    setManagerProfile(normalizedProfile);
    const updatedUser = { ...user, name: normalizedProfile.name };
    currentUserRef.current = updatedUser;
    setUser(updatedUser);
    showToast('บันทึกโปรไฟล์ Manager ในเบราว์เซอร์นี้แล้ว');
    return true;
  }

  async function handleUserProfileSave(profile: { name?: string; phone: string }): Promise<boolean> {
    if (user?.authSource === 'supabase') {
      let result;
      try {
        result = await updateSupabaseProfile(user.id, profile);
      } catch {
        showToast('บันทึกไม่สำเร็จ · ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่');
        return false;
      }
      if (!result.ok) {
        showToast(result.message);
        return false;
      }
      const updatedUser = { ...user, name: result.name, phone: result.phone };
      currentUserRef.current = updatedUser;
      setUser(updatedUser);
      showToast('บันทึกข้อมูลโปรไฟล์ใน Supabase แล้ว');
      return true;
    }
    if (!user || user.role === 'Manager' || !writeUserProfile(user.id, profile, user.role === 'Admin' ? user.name : undefined)) {
      showToast('บันทึกไม่สำเร็จ · เบราว์เซอร์อาจปิดการจัดเก็บข้อมูล');
      return false;
    }
    if (user.role === 'Admin' && profile.name) {
      const updatedUser = { ...user, name: profile.name.trim() };
      currentUserRef.current = updatedUser;
      setUser(updatedUser);
      showToast('บันทึกข้อมูลโปรไฟล์และ Audit Log ในเบราว์เซอร์นี้แล้ว');
    } else showToast('บันทึกเบอร์โทรศัพท์ในเบราว์เซอร์นี้แล้ว');
    return true;
  }

  async function handleProfilePhotoSave(photo: string | null): Promise<boolean> {
    if (!user) return false;
    if (user.authSource === 'supabase') {
      let result;
      try {
        result = await saveSupabaseProfilePhoto(user.id, user.avatarPath ?? null, photo);
      } catch {
        showToast('บันทึกรูปไม่สำเร็จ · ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่');
        return false;
      }
      if (!result.ok) {
        showToast(result.message);
        return false;
      }
      const updatedUser = { ...user, avatarPath: result.avatarPath };
      currentUserRef.current = updatedUser;
      setUser(updatedUser);
      setProfilePhoto(result.photoUrl);
      showToast(result.cleanupFailed
        ? 'บันทึกรูปโปรไฟล์แล้ว แต่ลบไฟล์รูปเก่าไม่สำเร็จ'
        : photo ? 'บันทึกรูปโปรไฟล์ใน Supabase แล้ว' : 'ลบรูปโปรไฟล์จาก Supabase แล้ว');
      return true;
    }
    if (!user || !writeProfilePhoto(user.id, photo)) {
      showToast('บันทึกรูปไม่สำเร็จ · พื้นที่จัดเก็บในเบราว์เซอร์อาจไม่เพียงพอ');
      return false;
    }
    setProfilePhoto(photo);
    showToast(photo ? 'บันทึกรูปโปรไฟล์ในเบราว์เซอร์นี้แล้ว' : 'ลบรูปโปรไฟล์แล้ว');
    return true;
  }

  function handleProfilePasswordReset() {
    if (user?.authSource !== 'supabase') {
      showToast('บัญชีทดลองไม่มีอีเมลกู้รหัสผ่าน · ใช้รหัสผ่านเดิมของบัญชีทดลอง');
      return;
    }
    setPasswordRecoveryMode('request');
  }

  function handleProfileCloseAccount(): boolean {
    if (!user || user.authSource === 'supabase' || (user.role !== 'Admin' && sessionStatus !== 'idle') || !closeDemoAccount(user.id)) {
      showToast('ปิดบัญชีไม่ได้ · ยังมี Session ค้างหรือจัดเก็บข้อมูลไม่สำเร็จ');
      return false;
    }
    clearDemoSession();
    currentUserRef.current = null;
    setUser(null);
    setProfilePhoto(null);
    navigatePage('home');
    setToast('ปิดบัญชีตัวอย่างแล้ว · ประวัติเดิมไม่ได้ถูกลบ');
    return true;
  }

  function handleStartPause() {
    if (user?.authSource === 'supabase') {
      if (user.accountStatus !== 'Approved') {
        showToast('บัญชีจริงยังไม่ได้รับอนุมัติ · เริ่ม Session ตัวอย่างไม่ได้');
        return;
      }
      if (!user.drivingPermission) {
        showToast('บัญชีจริงยังไม่มี Driving Permission · เริ่ม Session ตัวอย่างไม่ได้');
        return;
      }
    }
    if (!user || user.role === 'Admin') {
      showToast('บทบาท Admin ไม่มีสิทธิ์ใช้งานรถ');
      return;
    }
    const current = getLatestPrototypeState();
    if (current.session && current.session.userId !== user.id) {
      showToast(current.session.status === 'reserved' ? 'รถถูกสงวนโดยบัญชีอื่น · ยังเริ่ม Session ใหม่ไม่ได้' : 'รถกำลังอยู่ใน Session ของผู้ใช้อื่น');
      return;
    }
    const ownStatus = current.session?.status ?? 'idle';
    if (ownStatus === 'idle') {
      if (user.role !== 'Manager' && !isWithinServiceHours(current.service.startTime, current.service.endTime)) {
        showToast('อยู่นอกเวลาให้บริการตัวอย่าง · Manager ได้รับการยกเว้นตามบทบาท');
        return;
      }
      if (!isPrototypeVehicleAvailable(current)) {
        const reason = hasActiveSafetyBlock(current) ? 'มี Safety Block ค้างอยู่ · รอ Admin ตรวจและยืนยันในต้นแบบ'
          : current.service.manualOutOfService ? 'รถถูกกำหนดหยุดให้บริการในข้อมูลตัวอย่าง'
            : !current.service.serviceOpen ? 'ขณะนี้หยุดให้บริการในข้อมูลตัวอย่าง' : 'รถไม่พร้อมใช้งานในขณะนี้';
        showToast(reason);
        return;
      }
      const phone = user.role === 'Manager' ? managerProfile.phone : readUserProfile(user.id).phone;
      const reserved = reservePrototypeSession(current, {
        userId: user.id,
        driverName: user.name,
        driverRole: user.role,
        driverPhone: phone || null,
      });
      if (!reserved) {
        showToast('สงวนรถตัวอย่างไม่สำเร็จ · ลองตรวจสถานะรถอีกครั้ง');
        return;
      }
      const audited = addPrototypeAuditEntry(reserved, { id: user.id, name: user.name }, 'สงวนรถตัวอย่าง', reserved.session?.id ?? '', 'สงวนได้ 5 นาที · ไม่มีคำสั่งถึงรถจริง');
      const saved = writePrototypeState(audited);
      prototypeStateRef.current = audited;
      setPrototypeState(audited);
      if (user.role === 'Manager') {
        setManagerView('ride');
        navigatePage('manager');
      } else navigatePage('ride');
      showToast(saved ? 'สงวนรถตัวอย่างแล้ว · ตรวจรายการภายใน 5 นาที' : 'สงวนรถไว้ในหน้าจอนี้ · เบราว์เซอร์บันทึกข้อมูลไม่ได้');
      return;
    }
    if (ownStatus === 'reserved') {
      setIsPreflightOpen(true);
      return;
    }
    if (ownStatus === 'paused' && current.session?.locked) {
      showToast('ปลดล็อก Session ตัวอย่างก่อนทำงานต่อ');
      return;
    }
    const nextStatus = ownStatus === 'active' ? 'paused' : 'active';
    const changed = setPrototypeSessionStatus(current, user.id, nextStatus);
    if (!changed) {
      showToast('เปลี่ยนสถานะ Session ไม่สำเร็จ');
      return;
    }
    const audited = addPrototypeAuditEntry(changed, { id: user.id, name: user.name }, nextStatus === 'paused' ? 'พัก Session ตัวอย่าง' : 'ทำงานต่อใน Session เดิม', current.session?.id ?? '', 'ข้อมูลจำลองในเบราว์เซอร์ · ไม่มีคำสั่งถึงรถ');
    const saved = writePrototypeState(audited);
    prototypeStateRef.current = audited;
    setPrototypeState(audited);
    showToast(saved ? (nextStatus === 'paused' ? 'พัก Session ตัวอย่างแล้ว' : 'ทำงานต่อใน Session เดิมแล้ว') : 'เปลี่ยนสถานะเฉพาะหน้าจอ · เบราว์เซอร์บันทึกไม่ได้');
  }

  function handlePreflightConfirm() {
    if (!user) return;
    const current = getLatestPrototypeState();
    if (hasActiveSafetyBlock(current) || !current.service.serviceOpen || current.service.manualOutOfService
      || (user.role !== 'Manager' && !isWithinServiceHours(current.service.startTime, current.service.endTime))) {
      setIsPreflightOpen(false);
      showToast(hasActiveSafetyBlock(current)
        ? 'เริ่มไม่ได้ · มี Safety Block ใหม่ระหว่างการสงวนรถ'
        : 'เริ่มไม่ได้ · เวลาหรือสถานะบริการเปลี่ยนระหว่างสงวนรถ');
      return;
    }
    const activated = activatePrototypeSession(current, user.id);
    if (!activated || activated.session?.status !== 'active') {
      const expired = expirePrototypeReservation(current);
      if (expired !== current) {
        prototypeStateRef.current = expired;
        setPrototypeState(expired);
        writePrototypeState(expired);
      }
      setIsPreflightOpen(false);
      showToast('เริ่ม Session ไม่สำเร็จ · รถอาจหมดเวลาสงวนแล้ว');
      return;
    }
    const audited = addPrototypeAuditEntry(activated, { id: user.id, name: user.name }, 'เริ่ม Session ตัวอย่าง', activated.session.id, 'ผ่านรายการตรวจจำลอง · ไม่มีการตรวจจากอุปกรณ์');
    writePrototypeState(audited);
    prototypeStateRef.current = audited;
    setPrototypeState(audited);
    setIsPreflightOpen(false);
    showToast('เริ่ม Session ตัวอย่างแล้ว · ไม่มีคำสั่งส่งถึงรถ');
  }

  function handleCancelReservation() {
    if (!user) return;
    const current = getLatestPrototypeState();
    const cancelled = cancelPrototypeReservation(current, user.id);
    if (cancelled === current) return;
    const audited = addPrototypeAuditEntry(cancelled, { id: user.id, name: user.name }, 'ยกเลิกการสงวนรถ', current.session?.id ?? '', 'ยกเลิกก่อนเริ่ม Session ตัวอย่าง');
    writePrototypeState(audited);
    prototypeStateRef.current = audited;
    setPrototypeState(audited);
    showToast('ยกเลิกการสงวนรถตัวอย่างแล้ว');
  }

  function handleLock() {
    if (!user) return;
    const current = getLatestPrototypeState();
    if (current.session?.userId !== user.id) {
      showToast('ไม่มี Session ของบัญชีนี้ให้ล็อก');
      return;
    }
    if (current.session.status !== 'paused') {
      showToast('ต้องพัก Session ก่อนจึงจะเปลี่ยนสถานะล็อกในต้นแบบได้');
      return;
    }
    const locked = !current.session.locked;
    const changed = setPrototypeSessionLock(current, user.id, locked);
    if (!changed) return;
    const audited = addPrototypeAuditEntry(changed, { id: user.id, name: user.name }, locked ? 'ล็อก Session ตัวอย่าง' : 'ปลดล็อก Session ตัวอย่าง', current.session.id, 'เปลี่ยนสถานะในต้นแบบเท่านั้น · ไม่มีคำสั่งส่งถึงรถจริง');
    const saved = writePrototypeState(audited);
    prototypeStateRef.current = audited;
    setPrototypeState(audited);
    showToast(saved ? (locked ? 'ล็อก Session ตัวอย่างแล้ว' : 'ปลดล็อก Session ตัวอย่างแล้ว') : 'เปลี่ยนสถานะในหน้าจอแล้ว · เบราว์เซอร์จัดเก็บข้อมูลไม่ได้');
  }

  function handleEndSession() {
    const current = getLatestPrototypeState();
    if (!user || current.session?.userId !== user.id) {
      showToast('ไม่มี Session ของบัญชีนี้ให้จบ');
      return;
    }
    if (current.session.status !== 'paused') {
      showToast('พัก Session ก่อนจึงจะส่งคำขอจบในต้นแบบได้');
      return;
    }
    setIsEndSessionOpen(true);
  }

  function handleConfirmEndSession() {
    if (!user) return;
    const current = getLatestPrototypeState();
    const completed = completePrototypeSession(current, user.id);
    if (!completed) {
      setIsEndSessionOpen(false);
      showToast('จบ Session ไม่สำเร็จ · ต้องเป็น Session ของบัญชีนี้และพักอยู่');
      return;
    }
    const audited = addPrototypeAuditEntry(completed, { id: user.id, name: user.name }, 'จบ Session ตัวอย่าง', current.session?.id ?? '', 'ผู้ใช้ยืนยันเงื่อนไขจำลอง · ไม่ได้ตรวจรถหรือ Return Zone จริง');
    writePrototypeState(audited);
    prototypeStateRef.current = audited;
    setPrototypeState(audited);
    setIsEndSessionOpen(false);
    if (user.role === 'Manager') setManagerView('overview');
    navigatePage(getLandingPage(user.role));
    showToast('บันทึกประวัติ Session ตัวอย่างแล้ว');
  }

  function handleSubmitIssue(input: { category: string; details: string; severity: 'high' | 'low' }) {
    if (!user || user.role === 'Admin') {
      showToast('บัญชีนี้ไม่สามารถส่งรายงานตัวอย่างได้');
      return;
    }
    const changed = reportPrototypeIssue(getLatestPrototypeState(), { ...input, reporterId: user.id, reporterName: user.name });
    const audited = addPrototypeAuditEntry(changed, { id: user.id, name: user.name }, 'รายงานปัญหารถ', input.category, input.severity === 'high' ? 'สร้าง Safety Block สำหรับการเริ่ม Session ใหม่' : 'สร้าง Alert โดยไม่บล็อกการเริ่ม Session');
    const saved = writePrototypeState(audited);
    prototypeStateRef.current = audited;
    setPrototypeState(audited);
    setUtilityView(null);
    showToast(saved ? (input.severity === 'high' ? 'บันทึกรายงานและ Safety Block ตัวอย่างแล้ว' : 'บันทึกรายงานและ Alert ตัวอย่างแล้ว') : 'บันทึกในหน้าจอแล้ว · เบราว์เซอร์จัดเก็บข้อมูลไม่ได้');
  }

  function handleInspectIssue(issueId: string, note: string, safeToClear: boolean) {
    if (!user || !['Manager', 'Admin'].includes(user.role)) return;
    const current = getLatestPrototypeState();
    const updated = inspectPrototypeIssue(current, issueId, note, user.role === 'Admin' && safeToClear);
    const audited = addPrototypeAuditEntry(updated, { id: user.id, name: user.name }, safeToClear && user.role === 'Admin' ? 'ยืนยันปิด Safety Block ตัวอย่าง' : 'บันทึกผลตรวจปัญหารถ', issueId, note);
    const saved = writePrototypeState(audited);
    prototypeStateRef.current = audited;
    setPrototypeState(audited);
    showToast(saved ? (safeToClear && user.role === 'Admin' ? 'ปิด Safety Block ในข้อมูลตัวอย่างแล้ว' : 'บันทึกผลตรวจใน Audit Log แล้ว') : 'บันทึกผลตรวจในหน้าจอแล้ว');
  }

  function handleSubmitPrivacyRequest(requestType: string, details: string) {
    if (!user || !['Student', 'Employee', 'Admin'].includes(user.role)) return;
    const updated = submitPrototypePrivacyRequest(getLatestPrototypeState(), { id: user.id, name: user.name }, requestType, details);
    const audited = addPrototypeAuditEntry(updated, { id: user.id, name: user.name }, 'ส่งคำขอข้อมูลส่วนบุคคลตัวอย่าง', requestType, details);
    const saved = writePrototypeState(audited);
    prototypeStateRef.current = audited;
    setPrototypeState(audited);
    showToast(saved ? 'บันทึกคำขอตัวอย่างแล้ว · ยังไม่ได้ส่งให้หน่วยงานจริง' : 'บันทึกคำขอเฉพาะหน้าจอแล้ว');
  }

  function handleReviewPrivacyRequest(requestId: string, status: 'reviewing' | 'completed') {
    if (!user || user.role !== 'Admin') return;
    const updated = setPrototypePrivacyRequestState(getLatestPrototypeState(), requestId, status);
    const audited = addPrototypeAuditEntry(updated, { id: user.id, name: user.name }, 'อัปเดตสถานะคำขอข้อมูลตัวอย่าง', requestId, status);
    const saved = writePrototypeState(audited);
    prototypeStateRef.current = audited;
    setPrototypeState(audited);
    showToast(saved ? 'บันทึกสถานะคำขอในข้อมูลตัวอย่างแล้ว' : 'เปลี่ยนข้อมูลในหน้าจอแล้ว');
  }

  function acknowledgeAlert(id: string) {
    const actor = user;
    const saved = updatePrototypeState((current) => {
      const acknowledged = acknowledgePrototypeAlert(current, id);
      if (!actor) return acknowledged;
      return addPrototypeAuditEntry(acknowledged, { id: actor.id, name: actor.name }, 'รับทราบ Alert', id, 'บันทึกการรับทราบในข้อมูลตัวอย่าง');
    });
    showToast(saved ? 'บันทึกการรับทราบ Alert ในข้อมูลตัวอย่างแล้ว' : 'อัปเดต Alert เฉพาะในหน้านี้ · เบราว์เซอร์จัดเก็บข้อมูลไม่ได้');
  }

  if (passwordRecoveryMode) return <PasswordRecoveryPage mode={passwordRecoveryMode} onClose={() => {
    if (passwordRecoveryMode === 'update') {
      authRequestEpochRef.current.invalidate();
      void signOutSupabase();
      clearDemoSession();
      currentUserRef.current = null;
      setUser(null);
      setIsRestoringAuth(false);
    }
    setPasswordRecoveryMode(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('recovery');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }} onPasswordUpdated={handlePasswordUpdated} />;
  if (isRestoringAuth) return <main className="auth-loading" role="status">กำลังตรวจสอบบัญชี…</main>;
  if (!user) return <LoginPage onLogin={handleLogin} onPasswordUpdated={handlePasswordUpdated} notice={toast} />;
  if (requiresApprovalGate(user)) return <ApprovalStatusPage user={user} onLogout={handleLogout} />;

  const breadcrumbLabel = page === 'manager'
    ? managerView === 'overview' ? 'ภาพรวมการปฏิบัติงาน' : 'ขับขี่รถ'
    : utilityView ? ({
      help: 'ช่วยเหลือ', guide: 'คู่มือการใช้งาน', announcements: 'ประกาศ', 'trip-history': 'ประวัติการใช้งาน',
      'issue-report': 'รายงานปัญหา', inspection: 'ตรวจปัญหา', 'audit-log': 'Audit Log', 'privacy-request': 'คำขอข้อมูลส่วนบุคคล',
    } as const)[utilityView] : undefined;

  return (
    <AppShell authSource={user.authSource} page={page} breadcrumbLabel={breadcrumbLabel} user={user} profilePhoto={profilePhoto} onNavigate={handleNavigate} onLogout={handleLogout} onOpenUtility={handleOpenUtility}>
      {utilityView ? <UtilityViewPage view={utilityView} user={user} state={prototypeState} onBack={() => setUtilityView(null)} onSubmitIssue={handleSubmitIssue} onInspectIssue={handleInspectIssue} onSubmitPrivacyRequest={handleSubmitPrivacyRequest} onReviewPrivacyRequest={handleReviewPrivacyRequest} /> : <>
      {page === 'home' && <OverviewPage user={user} sessionStatus={sessionStatus} session={ownSession} prototypeState={prototypeState} onStartPause={handleStartPause} onCancelReservation={handleCancelReservation} onOpenUtility={handleOpenUtility} onLock={handleLock} />}
      {page === 'ride' && <RidePage status={sessionStatus} session={ownSession} onPauseResume={handleStartPause} onCancelReservation={handleCancelReservation} onEnd={handleEndSession} onOpenUtility={handleOpenUtility} onLock={handleLock} onReturnToOverview={() => handleNavigate('home')} />}
      {page === 'manager' && <ManagerPage view={managerView} onViewChange={setManagerView} alerts={alerts} issues={prototypeState.issues} trips={prototypeState.trips} monitoredSession={prototypeState.session?.status === 'active' ? prototypeState.session : null} ownSession={ownSession} onAcknowledge={acknowledgeAlert} sessionStatus={sessionStatus} onStartPause={handleStartPause} onCancelReservation={handleCancelReservation} onEnd={handleEndSession} onLock={handleLock} onOpenUtility={handleOpenUtility} onShowToast={showToast} />}
      {page === 'manager-profile' && user.role === 'Manager' && <ManagerProfilePage user={user} profile={managerProfile} profilePhoto={profilePhoto} onPhotoSave={handleProfilePhotoSave} onSave={handleManagerProfileSave} onCancel={() => handleNavigate('manager')} canCloseAccount={sessionStatus === 'idle'} onResetPassword={handleProfilePasswordReset} onCloseAccount={handleProfileCloseAccount} onShowToast={showToast} />}
      {page === 'profile-settings' && user.role !== 'Manager' && <ProfileSettingsPage user={user} profile={readUserProfile(user.id)} profilePhoto={profilePhoto} onPhotoSave={handleProfilePhotoSave} onSave={handleUserProfileSave} onCancel={() => handleNavigate(getLandingPage(user.role))} canCloseAccount={user.role === 'Admin' || sessionStatus === 'idle'} onResetPassword={handleProfilePasswordReset} onCloseAccount={handleProfileCloseAccount} onShowToast={showToast} />}
      {page === 'admin' && <AdminPage state={prototypeState} user={user} onUpdate={(next) => updatePrototypeState((current) => next(current))} onShowToast={showToast} onOpenUtility={handleOpenUtility} />}
      </>}
      <div className={`toast${toast ? ' visible' : ''}`} role="status" aria-live="polite">{toast}</div>
      {isPreflightOpen && <PreflightDialog onCancel={() => setIsPreflightOpen(false)} onConfirm={handlePreflightConfirm} />}
      {isEndSessionOpen && <EndSessionDialog onCancel={() => setIsEndSessionOpen(false)} onConfirm={handleConfirmEndSession} />}
    </AppShell>
  );
}

