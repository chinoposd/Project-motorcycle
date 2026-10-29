import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { AuthRequestEpoch } from './auth/authRequestEpoch';
import { requiresApprovalGate } from './auth/accountAccess';
import { getPageForAuthUpdate, shouldResetPageForAuthUpdate } from './auth/authSessionPolicy';
import { clearDemoSession, closeDemoAccount, getLandingPage, isPageAllowed, readDemoSession, writeDemoSession, type DemoUser } from './auth/demoAuth';
import { getCurrentSupabaseUser, signOutSupabase, type AppUser } from './auth/supabaseAuth';
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
import AnnouncementPopup from './components/AnnouncementPopup';
import EndSessionDialog from './components/EndSessionDialog';
import PreflightDialog from './components/PreflightDialog';
import PasswordRecoveryPage from './pages/PasswordRecoveryPage';
import LandingPage from './pages/LandingPage';
import UtilityViewPage from './pages/UtilityViewPage';
import {bangkokDay} from './features/operations/client';
import {useMyOperations} from './features/operations/useMyOperations';
import {useOperations} from './features/operations/useOperations';
import type { ManagerView, PageId, SessionStatus, UtilityView } from './types';

const APP_HISTORY_STATE_KEY = '__evWalailakApp';
const APP_HISTORY_SENTINEL_KEY = '__evWalailakHistoryBoundary';
const APP_HISTORY_ENTRY_KEY = '__evWalailakHistoryEntry';
const UTILITY_VIEWS: readonly UtilityView[] = ['help', 'guide', 'announcements', 'trip-history', 'issue-report', 'inspection', 'audit-log', 'privacy-request'];
const ALLOWED_UTILITY_VIEWS: Record<DemoUser['role'], readonly UtilityView[]> = {
  Student: ['help', 'guide', 'announcements', 'trip-history', 'issue-report', 'privacy-request'],
  Employee: ['help', 'guide', 'announcements', 'trip-history', 'issue-report', 'privacy-request'],
  Manager: ['help', 'guide', 'announcements', 'trip-history', 'issue-report', 'inspection'],
  Admin: ['help', 'guide', 'announcements', 'inspection', 'audit-log', 'privacy-request'],
};

function ensureHistoryBoundary() {
  if (typeof window === 'undefined') return;
  const bootstrapWindow = window as Window & { __evWalailakHistoryBootstrapped?: boolean };
  if (bootstrapWindow.__evWalailakHistoryBootstrapped) return;
  bootstrapWindow.__evWalailakHistoryBootstrapped = true;

  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const existingState = window.history.state;
  const appEntryState = existingState && typeof existingState === 'object' && !Array.isArray(existingState)
    && (existingState as Record<string, unknown>)[APP_HISTORY_SENTINEL_KEY] !== true
    ? existingState
    : { [APP_HISTORY_ENTRY_KEY]: true };

  // Re-seed on every document load, even when the current state already has
  // an app marker. That marker alone does not prove a boundary exists behind it.
  window.history.replaceState({ [APP_HISTORY_SENTINEL_KEY]: true }, '', currentUrl);
  window.history.pushState(appEntryState, '', currentUrl);
}

// Install the boundary before React renders so the first Back cannot leave the app.
ensureHistoryBoundary();

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', (event) => {
    const state = event.state as Record<string, unknown> | null;
    if (state?.[APP_HISTORY_SENTINEL_KEY] !== true) return;
    event.stopImmediatePropagation();
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.history.pushState({ [APP_HISTORY_ENTRY_KEY]: true }, '', currentUrl);
  });
}

interface AppHistoryState {
  page: PageId;
  managerView: ManagerView;
  utilityView: UtilityView | null;
  utilityEntry: boolean;
  historyIndex: number;
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
  const entry = Object.entries(APP_PAGE_PATHS).find(([, path]) => path === pathname);
  return entry ? entry[0] as PageId : null;
}

function getManagerViewForPath(pathname: string): ManagerView {
  return pathname === '/ManagerRidePage' ? 'ride' : 'overview';
}

function getPathForAppState(page: PageId, managerView: ManagerView): string {
  return page === 'manager' && managerView === 'ride' ? '/ManagerRidePage' : APP_PAGE_PATHS[page];
}

function getUtilityViewFromUrl(): UtilityView | null {
  const view = new URLSearchParams(window.location.search).get('view');
  return UTILITY_VIEWS.includes(view as UtilityView) ? view as UtilityView : null;
}

function getUrlForAppState(page: PageId, managerView: ManagerView, utilityView: UtilityView | null = null): string {
  const path = getPathForAppState(page, managerView);
  return utilityView ? `${path}?view=${encodeURIComponent(utilityView)}` : path;
}

function readAppHistoryState(state: unknown): AppHistoryState | null {
  if (!state || typeof state !== 'object') return null;
  const appState = (state as Record<string, unknown>)[APP_HISTORY_STATE_KEY];
  if (!appState || typeof appState !== 'object') return null;
  const { page, managerView } = appState as Record<string, unknown>;
  const validPages: PageId[] = ['home', 'ride', 'manager', 'manager-profile', 'profile-settings', 'admin'];
  const utilityView = (appState as Record<string, unknown>).utilityView;
  const storedIndex = (appState as Record<string, unknown>).historyIndex;
  if (!validPages.includes(page as PageId) || (managerView !== 'overview' && managerView !== 'ride')) return null;
  if (utilityView !== null && utilityView !== undefined && !UTILITY_VIEWS.includes(utilityView as UtilityView)) return null;
  return {
    page: page as PageId,
    managerView,
    utilityView: (utilityView as UtilityView | null) ?? null,
    utilityEntry: (appState as Record<string, unknown>).utilityEntry === true,
    historyIndex: typeof storedIndex === 'number' && Number.isInteger(storedIndex) && storedIndex >= 0 ? storedIndex : 0,
  };
}

function makeHistoryState(page: PageId, managerView: ManagerView, utilityView: UtilityView | null = null, utilityEntry = false, historyIndex = 0): Record<string, unknown> {
  const currentState = window.history.state;
  const baseState = currentState && typeof currentState === 'object' && !Array.isArray(currentState)
    ? currentState as Record<string, unknown>
    : {};
  return { ...baseState, [APP_HISTORY_STATE_KEY]: { page, managerView, utilityView, utilityEntry, historyIndex } };
}

function isWithinServiceHours(start: string, end: string, now = new Date()): boolean {
  const localTime = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(now);
  return start <= end ? localTime >= start && localTime <= end : localTime >= start || localTime <= end;
}
const AdminPage = lazy(() => import('./pages/AdminPage'));
const ApprovalStatusPage = lazy(() => import('./pages/ApprovalStatusPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const ManagerPage = lazy(() => import('./pages/ManagerPage'));
const ManagerProfilePage = lazy(() => import('./pages/ManagerProfilePage'));
const ProfileSettingsPage = lazy(() => import('./pages/ProfileSettingsPage'));
const OverviewPage = lazy(() => import('./pages/OverviewPage'));
const RidePage = lazy(() => import('./pages/RidePage'));
const LiveUserPage = lazy(() => import('./features/operations/LiveUserPage'));
const ManagerOperationsPage = lazy(() => import('./features/operations/ManagerOperationsPage'));

const appPageFallback = <div className="page-loading" role="status" aria-live="polite">กำลังโหลดหน้า…</div>;

export default function App() {
  const [publicPath, setPublicPath] = useState(() => window.location.pathname);
  const [user, setUser] = useState<AppUser | null>(() => {
    const restored = readDemoSession();
    if (!restored) return null;
    const name = restored.role === 'Manager'
      ? readManagerProfile(restored.id, restored.name).name
      : restored.role === 'Admin' ? readUserProfile(restored.id).name ?? restored.name : restored.name;
    return { ...restored, name, authSource: 'demo' };
  });
  const [isRestoringAuth, setIsRestoringAuth] = useState(supabaseConfig.mode === 'configured');
  const [managerProfile, setManagerProfile] = useState<ManagerProfile>(() => {
    const restored = readDemoSession();
    return restored?.role === 'Manager'
      ? readManagerProfile(restored.id, restored.name)
      : { name: 'ผู้จัดการระบบ', phone: '', department: 'ระบบบริหารยานพาหนะไฟฟ้า' };
  });
  const [page, setPage] = useState<PageId>(() => {
    const requestedPage = getPageForPath(window.location.pathname);
    if (user && requestedPage && isPageAllowed(user.role, requestedPage)) return requestedPage;
    return user ? getLandingPage(user.role) : 'home';
  });
  const [managerView, setManagerView] = useState<ManagerView>(() => getManagerViewForPath(window.location.pathname));
  const [utilityView, setUtilityView] = useState<UtilityView | null>(() => {
    const requestedView = getUtilityViewFromUrl();
    return user?.authSource === 'demo' && requestedView && ALLOWED_UTILITY_VIEWS[user.role].includes(requestedView) ? requestedView : null;
  });
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
  const [managerReportDate,setManagerReportDate]=useState(bangkokDay);
  const [toast, setToast] = useState('');
  const currentUserRef = useRef(user);
  const currentPageRef = useRef(page);
  const managerViewRef = useRef(managerView);
  const utilityViewRef = useRef(utilityView);
  const historyIndexRef = useRef(0);
  managerViewRef.current = managerView;
  utilityViewRef.current = utilityView;
  const authRequestEpochRef = useRef(new AuthRequestEpoch());
  const [profilePhoto, setProfilePhoto] = useState<string | null>(() => user ? readProfilePhoto(user.id) : null);

  const showToast = useCallback((message: string) => setToast(message), []);
  const myOperations=useMyOperations(user?.authSource==='supabase'?user.id:null,user?.authSource==='supabase',showToast);
  const managerOperations=useOperations(!(user?.authSource==='supabase'&&user.role==='Manager'&&user.accountStatus==='Approved'),managerReportDate,showToast);

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

  useEffect(() => {
    const syncPublicPath = () => setPublicPath(window.location.pathname);
    window.addEventListener('popstate', syncPublicPath);
    return () => window.removeEventListener('popstate', syncPublicPath);
  }, []);

  useEffect(() => {
    if (window.location.pathname === '/Welcome' || (!user && window.location.pathname === '/')) return;
    const authRoute = ['/LoginPage', '/RegisterPage', '/ForgotPassword'].includes(window.location.pathname);
    const currentState = window.history.state as Record<string, unknown> | null;
    if (user && !readAppHistoryState(currentState)) {
      const initialUrl = getUrlForAppState(page, managerView, utilityView);
      window.history.replaceState(makeHistoryState(page, managerView, utilityView, false, 0), '', initialUrl);
      historyIndexRef.current = 0;
    } else if (!user && !currentState?.authPage) {
      const initialUrl = authRoute ? `${window.location.pathname}${window.location.search}${window.location.hash}` : '/LoginPage';
      window.history.replaceState({ [APP_HISTORY_ENTRY_KEY]: true, authPage: 'login' }, '', initialUrl);
    }

    function handlePopState(event: PopStateEvent) {
      if (!currentUserRef.current) {
        if ((event.state as Record<string, unknown> | null)?.[APP_HISTORY_SENTINEL_KEY] === true) {
          const isAuthRoute = ['/LoginPage', '/RegisterPage', '/ForgotPassword'].includes(window.location.pathname);
          const currentUrl = isAuthRoute
            ? `${window.location.pathname}${window.location.search}${window.location.hash}`
            : '/LoginPage';
          window.history.pushState({ [APP_HISTORY_ENTRY_KEY]: true, authPage: 'login' }, '', currentUrl);
        }
        return;
      }
      const appState = readAppHistoryState(event.state);
      if (!appState) {
        const currentPage = currentPageRef.current;
        const currentManagerView = managerViewRef.current;
        const currentUtilityView = utilityViewRef.current;
        window.history.pushState(
          makeHistoryState(currentPage, currentManagerView, currentUtilityView, false, historyIndexRef.current),
          '',
          getUrlForAppState(currentPage, currentManagerView, currentUtilityView),
        );
        return;
      }
      const activeUser = currentUserRef.current;
      const nextPage = isPageAllowed(activeUser.role, appState.page) ? appState.page : getLandingPage(activeUser.role);
      currentPageRef.current = nextPage;
      historyIndexRef.current = appState.historyIndex;
      setPage(nextPage);
      setManagerView(appState.managerView);
      const nextUtilityView = activeUser.authSource === 'demo' && appState.utilityView && ALLOWED_UTILITY_VIEWS[activeUser.role].includes(appState.utilityView)
        ? appState.utilityView
        : null;
      setUtilityView(nextUtilityView);
      const nextUrl = getUrlForAppState(nextPage, appState.managerView, nextUtilityView);
      if (nextPage !== appState.page || `${window.location.pathname}${window.location.search}` !== nextUrl) {
        window.history.replaceState(makeHistoryState(nextPage, appState.managerView, nextUtilityView, appState.utilityEntry, appState.historyIndex), '', nextUrl);
      }
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [user]);

  function navigatePage(
    nextPage: PageId,
    historyMode: 'push' | 'replace' = 'push',
    nextManagerView: ManagerView = managerView,
    nextUrl: string = getPathForAppState(nextPage, nextManagerView),
  ) {
    const isSameView = currentPageRef.current === nextPage && managerView === nextManagerView;
    if (isSameView && historyMode === 'push') return;
    currentPageRef.current = nextPage;
    setPage(nextPage);
    if (managerView !== nextManagerView) setManagerView(nextManagerView);
    setUtilityView(null);
    const nextHistoryIndex = historyMode === 'push' ? historyIndexRef.current + 1 : historyIndexRef.current;
    const state = makeHistoryState(nextPage, nextManagerView, null, false, nextHistoryIndex);
    if (historyMode === 'push') window.history.pushState(state, '', nextUrl);
    else window.history.replaceState(state, '', nextUrl);
    historyIndexRef.current = nextHistoryIndex;
  }

  function navigateManagerView(nextView: ManagerView) {
    if (managerView === nextView) return;
    setManagerView(nextView);
    const nextHistoryIndex = historyIndexRef.current + 1;
    const state = makeHistoryState(currentPageRef.current, nextView, null, false, nextHistoryIndex);
    window.history.pushState(state, '', getPathForAppState(currentPageRef.current, nextView));
    historyIndexRef.current = nextHistoryIndex;
  }

  function handleOpenUtility(nextView: UtilityView) {
    if (!user) return;
    if (!ALLOWED_UTILITY_VIEWS[user.role].includes(nextView)) {
      showToast('บัญชีนี้ไม่มีสิทธิ์เปิดรายการดังกล่าว');
      return;
    }
    if (user.authSource === 'supabase') {
      showToast('เมนูนี้เป็นข้อมูลตัวอย่าง · งานบัญชีจริงอยู่ในหน้าหลักตามบทบาท');
      return;
    }
    setUtilityView(nextView);
    window.history.pushState(
      makeHistoryState(currentPageRef.current, managerView, nextView, true, historyIndexRef.current + 1),
      '',
      getUrlForAppState(currentPageRef.current, managerView, nextView),
    );
    historyIndexRef.current += 1;
  }

  function handleBack(fallbackPage: PageId) {
    if (historyIndexRef.current > 0) {
      window.history.back();
      return;
    }
    navigatePage(fallbackPage, 'replace', fallbackPage === 'manager' ? 'overview' : managerView);
  }

  function handleCloseUtility() {
    const activeState = readAppHistoryState(window.history.state);
    if (activeState?.utilityView && activeState.utilityEntry) {
      window.history.back();
      return;
    }
    setUtilityView(null);
    window.history.replaceState(makeHistoryState(page, managerView, null, false, historyIndexRef.current), '', getPathForAppState(page, managerView));
  }

  useEffect(()=>{
    const account=myOperations.data?.account;
    const active=currentUserRef.current;
    if(!account||!active||active.authSource!=='supabase'||active.id!==account.id)return;
    if(active.role===account.role&&active.accountStatus===account.status&&active.drivingPermission===account.driving_permission&&active.name===account.name&&active.phone===account.phone&&active.accountStatusReason===account.account_status_reason)return;
    const nextUser:AppUser={...active,name:account.name,phone:account.phone,role:account.role,accountStatus:account.status,drivingPermission:account.driving_permission,
      accountStatusReason:account.account_status_reason};
    const reset=shouldResetPageForAuthUpdate(active,nextUser,currentPageRef.current);
    currentUserRef.current=nextUser;setUser(nextUser);
    if(reset)navigatePage(getPageForAuthUpdate(nextUser),'replace',account.role==='Manager'?'overview':managerView);
  },[myOperations.data?.account]);

  useEffect(() => {
    if (!supabase) return undefined;
    let mounted = true;

    function clearCloudIdentity() {
      if (currentUserRef.current?.authSource !== 'supabase') return;
      currentUserRef.current = null;
      setUser(null);
      setProfilePhoto(null);
      navigatePage('home', 'replace', managerView, '/LoginPage');
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
          setProfilePhoto(result.user.authSource === 'demo' ? readProfilePhoto(result.user.id) : null);
          if (result.user.avatarPath) {
            void createSupabaseProfilePhotoUrl(result.user.avatarPath).then((photoUrl) => {
              if (mounted && authRequestEpochRef.current.isCurrent(requestEpoch) && currentUserRef.current?.id === result.user?.id) {
                setProfilePhoto(photoUrl);
              }
            });
          }
          if (shouldResetPage) {
            const requestedPage = getPageForPath(window.location.pathname);
            const nextPage = requestedPage && isPageAllowed(result.user.role, requestedPage)
              ? requestedPage
              : getPageForAuthUpdate(result.user);
            navigatePage(nextPage, 'replace', getManagerViewForPath(window.location.pathname));
          }
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
    navigatePage(getLandingPage(nextUser.role), 'replace', 'overview');
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
    if (user?.authSource === 'supabase') void signOutSupabase();
    clearDemoSession();
    currentUserRef.current = null;
    setUser(null);
    setProfilePhoto(null);
    setManagerProfile({ name: 'ผู้จัดการระบบ', phone: '', department: 'ระบบบริหารยานพาหนะไฟฟ้า' });
    navigatePage('home', 'replace', 'overview', '/LoginPage');
    setUtilityView(null);
    setToast('');
  }

  function handleNavigate(nextPage: PageId) {
    if (!user) return;
    const allowedPage = isPageAllowed(user.role, nextPage) ? nextPage : getLandingPage(user.role);
    navigatePage(allowedPage, 'push', allowedPage === 'manager' ? 'overview' : managerView);
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
    if (user?.authSource === 'supabase') {
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
    navigatePage('home', 'replace', 'overview', '/LoginPage');
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
        navigatePage('manager', 'push', 'ride');
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
    navigatePage(getLandingPage(user.role), 'push', 'overview');
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
    handleCloseUtility();
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
  function openPublicAuth(target: 'login' | 'register') {
    const returnPath = window.location.pathname === '/Welcome' ? '/Welcome' : '/';
    const nextUrl = target === 'register'
      ? `/RegisterPage?returnTo=${encodeURIComponent(returnPath)}`
      : '/LoginPage';
    if (user) {
      window.location.assign(nextUrl);
      return;
    }
    window.history.pushState({ [APP_HISTORY_ENTRY_KEY]: true, authPage: target }, '', nextUrl);
    setPublicPath(target === 'register' ? '/RegisterPage' : '/LoginPage');
  }

  if (publicPath === '/Welcome') return <LandingPage onOpenAuth={openPublicAuth} />;
  if (isRestoringAuth) return <main className="auth-loading" role="status">กำลังตรวจสอบบัญชี…</main>;
  if (!user) return publicPath === '/LoginPage' || publicPath === '/RegisterPage'
    ? <Suspense fallback={<main className="auth-loading" role="status">กำลังเปิดหน้าเข้าสู่ระบบ…</main>}><LoginPage onLogin={handleLogin} onPasswordUpdated={handlePasswordUpdated} notice={toast} /></Suspense>
    : <LandingPage onOpenAuth={openPublicAuth} />;
  if (requiresApprovalGate(user)) return <Suspense fallback={<main className="auth-loading" role="status">กำลังตรวจสอบสิทธิ์บัญชี…</main>}><ApprovalStatusPage user={user} onLogout={handleLogout} operations={myOperations.data} operationsError={myOperations.error} operationsBusy={myOperations.busy} onOperationsRun={myOperations.run} onSessionAction={myOperations.sessionAction} /></Suspense>;

  const breadcrumbLabel = page === 'manager'
    ? managerView === 'overview' ? 'ภาพรวมการปฏิบัติงาน' : 'ขับขี่รถ'
    : utilityView ? ({
      help: 'ช่วยเหลือ', guide: 'คู่มือการใช้งาน', announcements: 'ประกาศ', 'trip-history': 'ประวัติการใช้งาน',
      'issue-report': 'รายงานปัญหา', inspection: 'ตรวจปัญหา', 'audit-log': 'Audit Log', 'privacy-request': 'คำขอข้อมูลส่วนบุคคล',
    } as const)[utilityView] : undefined;
  const breadcrumbParent = page === 'manager' && managerView === 'ride'
    ? { label: 'ภาพรวมการปฏิบัติงาน', onNavigate: () => navigateManagerView('overview') }
    : undefined;

  return (
    <AppShell authSource={user.authSource} page={page} breadcrumbLabel={breadcrumbLabel} breadcrumbParent={breadcrumbParent} user={user} profilePhoto={profilePhoto} onNavigate={handleNavigate} onLogout={handleLogout} onOpenUtility={handleOpenUtility}>
      {utilityView && user.authSource === 'demo' ? <UtilityViewPage view={utilityView} user={user} state={prototypeState} onBack={handleCloseUtility} onSubmitIssue={handleSubmitIssue} onInspectIssue={handleInspectIssue} onSubmitPrivacyRequest={handleSubmitPrivacyRequest} onReviewPrivacyRequest={handleReviewPrivacyRequest} /> : <Suspense fallback={appPageFallback}>
        {page === 'home' && (user.authSource === 'supabase' ? <LiveUserPage user={user} data={myOperations.data} loading={myOperations.loading} error={myOperations.error} busy={myOperations.busy} onRefresh={myOperations.refresh} onRun={myOperations.run} onRequestSession={myOperations.requestSession} onSessionAction={myOperations.sessionAction} /> : <OverviewPage user={user} sessionStatus={sessionStatus} session={ownSession} prototypeState={prototypeState} onStartPause={handleStartPause} onCancelReservation={handleCancelReservation} onOpenUtility={handleOpenUtility} onLock={handleLock} />)}
        {page === 'ride' && (user.authSource === 'supabase' ? <LiveUserPage user={user} data={myOperations.data} loading={myOperations.loading} error={myOperations.error} busy={myOperations.busy} onRefresh={myOperations.refresh} onRun={myOperations.run} onRequestSession={myOperations.requestSession} onSessionAction={myOperations.sessionAction} /> : <RidePage status={sessionStatus} session={ownSession} onPauseResume={handleStartPause} onCancelReservation={handleCancelReservation} onEnd={handleEndSession} onOpenUtility={handleOpenUtility} onLock={handleLock} onReturnToOverview={() => handleBack('home')} />)}
        {page === 'manager' && (user.authSource === 'supabase' ? (managerView === 'ride' ? <LiveUserPage user={user} data={myOperations.data} loading={myOperations.loading} error={myOperations.error} busy={myOperations.busy} onRefresh={myOperations.refresh} onRun={myOperations.run} onRequestSession={myOperations.requestSession} onSessionAction={myOperations.sessionAction} /> : <ManagerOperationsPage view={managerView} onViewChange={navigateManagerView} data={managerOperations.data} loading={managerOperations.loading} error={managerOperations.error} busy={managerOperations.busy} onRefresh={managerOperations.refresh} onRun={managerOperations.run} date={managerReportDate} onDateChange={setManagerReportDate} />) : <ManagerPage view={managerView} onViewChange={navigateManagerView} alerts={alerts} issues={prototypeState.issues} trips={prototypeState.trips} auditLog={prototypeState.auditLog} monitoredSession={prototypeState.session?.status === 'active' ? prototypeState.session : null} ownSession={ownSession} onAcknowledge={acknowledgeAlert} sessionStatus={sessionStatus} onStartPause={handleStartPause} onCancelReservation={handleCancelReservation} onEnd={handleEndSession} onLock={handleLock} onOpenUtility={handleOpenUtility} onShowToast={showToast} />)}
        {page === 'manager-profile' && user.role === 'Manager' && (user.authSource === 'supabase' ? <ProfileSettingsPage user={user} profile={{ name: user.name, phone: user.phone ?? '' }} profilePhoto={profilePhoto} onPhotoSave={handleProfilePhotoSave} onSave={handleUserProfileSave} onCancel={() => handleBack('manager')} canCloseAccount={false} onResetPassword={handleProfilePasswordReset} onCloseAccount={handleProfileCloseAccount} onShowToast={showToast} /> : <ManagerProfilePage user={user} profile={managerProfile} profilePhoto={profilePhoto} onPhotoSave={handleProfilePhotoSave} onSave={handleManagerProfileSave} onCancel={() => handleBack('manager')} canCloseAccount={sessionStatus === 'idle'} onResetPassword={handleProfilePasswordReset} onCloseAccount={handleProfileCloseAccount} onShowToast={showToast} />)}
        {page === 'profile-settings' && user.role !== 'Manager' && <ProfileSettingsPage user={user} profile={user.authSource === 'supabase' ? { name: user.name, phone: user.phone ?? '' } : readUserProfile(user.id)} profilePhoto={profilePhoto} onPhotoSave={handleProfilePhotoSave} onSave={handleUserProfileSave} onCancel={() => handleBack(getLandingPage(user.role))} canCloseAccount={user.authSource === 'demo' && (user.role === 'Admin' || sessionStatus === 'idle')} onResetPassword={handleProfilePasswordReset} onCloseAccount={handleProfileCloseAccount} onShowToast={showToast} />}
        {page === 'admin' && <AdminPage authSource={user.authSource} currentAdminId={user.id} onShowToast={showToast} />}
      </Suspense>}
      {user.authSource === 'supabase' && myOperations.data && <AnnouncementPopup userId={user.id} sessionActive={!!myOperations.data.session && ['Active','Paused','PendingPause','PendingResume','PendingEnd','EndedPendingSync'].includes(myOperations.data.session.status)} onShowToast={showToast} />}
      <div className={`toast${toast ? ' visible' : ''}`} role="status" aria-live="polite">{toast}</div>
      {isPreflightOpen && <PreflightDialog onCancel={() => setIsPreflightOpen(false)} onConfirm={handlePreflightConfirm} />}
      {isEndSessionOpen && <EndSessionDialog onCancel={() => setIsEndSessionOpen(false)} onConfirm={handleConfirmEndSession} />}
    </AppShell>
  );
}

