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
import AppShell from './components/AppShell';
import AnnouncementPopup from './components/AnnouncementPopup';
import { initialAlerts } from './data/mockData';
import {bangkokDay} from './features/operations/client';
import {useMyOperations} from './features/operations/useMyOperations';
import {useOperations} from './features/operations/useOperations';
import type { AlertRecord, ManagerView, PageId, SessionStatus } from './types';

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
const LiveUserPage = lazy(() => import('./features/operations/LiveUserPage'));
const ManagerOperationsPage = lazy(() => import('./features/operations/ManagerOperationsPage'));

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
  const [page, setPage] = useState<PageId>(() => {
    const requestedPage = getPageForPath(window.location.pathname);
    if (user && requestedPage && isPageAllowed(user.role, requestedPage)) return requestedPage;
    return user ? getLandingPage(user.role) : 'home';
  });
  const [managerView, setManagerView] = useState<ManagerView>(() => getManagerViewForPath(window.location.pathname));
  const [managerReportDate,setManagerReportDate]=useState(bangkokDay);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('active');
  const [alerts, setAlerts] = useState<AlertRecord[]>(() => initialAlerts.map((item) => ({ ...item })));
  const [toast, setToast] = useState('');
  const currentUserRef = useRef(user);
  const currentPageRef = useRef(page);
  const authRequestEpochRef = useRef(new AuthRequestEpoch());
  const [profilePhoto, setProfilePhoto] = useState<string | null>(() => user ? readProfilePhoto(user.id) : null);

  const showToast = useCallback((message: string) => setToast(message), []);
  const myOperations=useMyOperations(user?.authSource==='supabase'?user.id:null,user?.authSource==='supabase',showToast);
  const managerOperations=useOperations(!(user?.authSource==='supabase'&&user.role==='Manager'&&user.accountStatus==='Approved'),managerReportDate,showToast);

  useEffect(() => {
    const initialUrl = user ? getPathForAppState(page, managerView) : window.location.href;
    window.history.replaceState(makeHistoryState(page, managerView), '', initialUrl);

    function handlePopState(event: PopStateEvent) {
      const appState = readAppHistoryState(event.state);
      if (!appState) return;

      const activeUser = currentUserRef.current;
      const nextPage = !activeUser
        ? 'home'
        : isPageAllowed(activeUser.role, appState.page)
          ? appState.page
          : getLandingPage(activeUser.role);
      const nextManagerView = appState.managerView;

      currentPageRef.current = nextPage;
      setPage(nextPage);
      setManagerView(nextManagerView);
      const nextUrl = activeUser ? getPathForAppState(nextPage, nextManagerView) : '/LoginPage';
      if (nextPage !== appState.page || window.location.pathname !== nextUrl) {
        window.history.replaceState(makeHistoryState(nextPage, nextManagerView), '', nextUrl);
      }
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

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
    const state = makeHistoryState(nextPage, nextManagerView);
    if (historyMode === 'push') window.history.pushState(state, '', nextUrl);
    else window.history.replaceState(state, '', nextUrl);
  }

  function navigateManagerView(nextView: ManagerView) {
    if (managerView === nextView) return;
    setManagerView(nextView);
    const state = makeHistoryState(currentPageRef.current, nextView);
    window.history.pushState(state, '', getPathForAppState(currentPageRef.current, nextView));
  }

  useEffect(()=>{
    const account=myOperations.data?.account;
    const active=currentUserRef.current;
    if(!account||!active||active.authSource!=='supabase'||active.id!==account.id)return;
    if(active.role===account.role&&active.accountStatus===account.status&&active.drivingPermission===account.driving_permission&&active.name===account.name&&active.phone===account.phone)return;
    const nextUser:AppUser={...active,name:account.name,phone:account.phone,role:account.role,accountStatus:account.status,drivingPermission:account.driving_permission,
      accountStatusReason:account.status==='Approved'||account.status==='Pending'?'':active.accountStatusReason};
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
      setSessionStatus('idle');
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
            setSessionStatus('idle');
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
      if (event === 'PASSWORD_RECOVERY') setIsPasswordRecovery(true);
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
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(''), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  function handleLogin(nextUser: DemoUser) {
    authRequestEpochRef.current.invalidate();
    void signOutSupabase();
    writeDemoSession(nextUser);
    const demoUser: AppUser = { ...nextUser, authSource: 'demo' };
    const nextProfile = nextUser.role === 'Manager'
      ? readManagerProfile(nextUser.id, nextUser.name)
      : managerProfile;
    setManagerProfile(nextProfile);
    const userProfile = nextUser.role === 'Admin' ? readUserProfile(nextUser.id) : null;
    const authenticatedUser = nextUser.role === 'Manager'
      ? { ...demoUser, name: nextProfile.name }
      : nextUser.role === 'Admin' ? { ...demoUser, name: userProfile?.name ?? nextUser.name } : demoUser;
    currentUserRef.current = authenticatedUser;
    setUser(authenticatedUser);
    setProfilePhoto(readProfilePhoto(nextUser.id));
    navigatePage(getLandingPage(nextUser.role), 'replace');
    setSessionStatus('active');
    setToast('');
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
    navigatePage('home', 'replace', 'overview', '/LoginPage');
    setSessionStatus('idle');
    setToast('');
  }

  function handleNavigate(nextPage: PageId) {
    if (!user) return;
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

  async function handleProfilePasswordReset() {
    if (!user || user.authSource !== 'supabase') return;
    let result;
    try {
      result = await sendSupabasePasswordReset(user.email);
    } catch {
      showToast('ส่งลิงก์ไม่สำเร็จ · ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่');
      return;
    }
    showToast(result.ok
      ? 'ส่งลิงก์รีเซ็ตรหัสผ่านไปยังอีเมลบัญชีแล้ว'
      : 'ส่งลิงก์ไม่สำเร็จ · ตรวจสอบการตั้งค่า Auth และ Redirect URLs ใน Supabase');
  }

  async function handlePasswordRecoveryComplete() {
    setIsPasswordRecovery(false);
    await signOutSupabase();
    currentUserRef.current = null;
    setUser(null);
    setProfilePhoto(null);
    setSessionStatus('idle');
    navigatePage('home', 'replace', managerView, '/LoginPage');
    setToast('เปลี่ยนรหัสผ่านแล้ว · เข้าสู่ระบบด้วยรหัสผ่านใหม่ได้เลย');
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
    setSessionStatus('idle');
    setToast('ปิดบัญชีตัวอย่างแล้ว · ประวัติเดิมไม่ได้ถูกลบ');
    return true;
  }

  function handleStartPause() {
    if (user?.authSource === 'supabase') {
      showToast(user.drivingPermission
        ? 'บัญชีนี้ยังไม่เชื่อมคำสั่งกับรถจริง · ไม่มีการเริ่ม Session'
        : 'บัญชีนี้ยังไม่มี Driving Permission · ไม่มีการส่งคำสั่งถึงรถ');
      return;
    }
    if (sessionStatus === 'active') {
      setSessionStatus('paused');
      showToast('Session ตัวอย่างเข้าสู่สถานะ Pause · ไม่มีคำสั่งส่งถึงรถ');
    } else {
      setSessionStatus('active');
      if (sessionStatus === 'idle') navigatePage('ride');
      showToast('เปลี่ยนเป็น Active Session ตัวอย่าง · ไม่มีคำสั่งส่งถึงรถ');
    }
  }

  function handleLock() {
    if (user?.authSource === 'supabase') {
      showToast('บัญชีจริงยังไม่เชื่อมระบบสั่ง Lock รถ · ไม่มีคำสั่งส่งถึงรถ');
      return;
    }
    if (sessionStatus === 'active') {
      showToast('ต้องยืนยันว่ารถหยุดนิ่งก่อนสั่ง Lock');
      return;
    }
    setSessionStatus('paused');
    showToast('สาธิต Pause / Lock ภายใน Session เดิม · ไม่มีคำสั่งถึงรถ');
  }

  function handleEndSession() {
    if (user?.authSource === 'supabase') {
      showToast('บัญชีจริงยังไม่เชื่อมระบบ Session รถ · ไม่มีการจบ Session จริง');
      return;
    }
    setSessionStatus('idle');
    navigatePage('home', 'replace');
    showToast('Session ตัวอย่างสิ้นสุดแล้ว · ระบบจริงต้องยืนยันจุดคืนรถและสถานะรถ');
  }

  function acknowledgeAlert(id: string) {
    setAlerts((previous) => previous.map((item) => item.id === id && item.state === 'unread'
      ? { ...item, state: 'acknowledged' }
      : item));
    showToast('บันทึกการรับทราบ Alert แล้ว · ข้อมูลตัวอย่าง');
  }

  if (isRestoringAuth) return <main className="auth-loading" role="status">กำลังตรวจสอบบัญชี…</main>;
  if (isPasswordRecovery) return (
    <Suspense fallback={<main className="auth-loading" role="status">กำลังเปิดหน้าเปลี่ยนรหัสผ่าน…</main>}>
      <PasswordRecoveryPage onSave={async (password) => (await updateSupabasePassword(password)).ok} onComplete={handlePasswordRecoveryComplete} onCancel={handleLogout} />
    </Suspense>
  );
  if (!user) return (
    <Suspense fallback={<main className="auth-loading" role="status">กำลังเปิดหน้าเข้าสู่ระบบ…</main>}>
      <LoginPage onLogin={handleLogin} notice={toast} />
    </Suspense>
  );
  if (requiresApprovalGate(user)) return (
    <Suspense fallback={<main className="auth-loading" role="status">กำลังตรวจสอบสิทธิ์บัญชี…</main>}>
      <ApprovalStatusPage user={user} onLogout={handleLogout} operations={myOperations.data} operationsError={myOperations.error} operationsBusy={myOperations.busy} onOperationsRun={myOperations.run} onSessionAction={myOperations.sessionAction} />
    </Suspense>
  );

  return (
    <AppShell authSource={user.authSource} page={page} breadcrumbLabel={page === 'manager' ? (managerView === 'overview' ? 'ภาพรวมการปฏิบัติงาน' : 'ขับขี่รถ') : undefined} breadcrumbParent={page === 'manager' && managerView === 'ride' ? { label: 'ภาพรวมการปฏิบัติงาน', onNavigate: () => navigateManagerView('overview') } : undefined} user={user} profilePhoto={profilePhoto} onNavigate={handleNavigate} onLogout={handleLogout}>
      <Suspense fallback={appPageFallback}>
        {page === 'home' && (user.authSource==='supabase'?<LiveUserPage user={user} data={myOperations.data} loading={myOperations.loading} error={myOperations.error} busy={myOperations.busy} onRefresh={myOperations.refresh} onRun={myOperations.run} onRequestSession={myOperations.requestSession} onSessionAction={myOperations.sessionAction}/>:<OverviewPage sessionStatus={sessionStatus} onStartPause={handleStartPause} onLock={handleLock} onShowToast={showToast} authSource="demo" />)}
        {page === 'ride' && (user.authSource==='supabase'?<LiveUserPage user={user} data={myOperations.data} loading={myOperations.loading} error={myOperations.error} busy={myOperations.busy} onRefresh={myOperations.refresh} onRun={myOperations.run} onRequestSession={myOperations.requestSession} onSessionAction={myOperations.sessionAction}/>:<RidePage status={sessionStatus} onPauseResume={handleStartPause} onEnd={handleEndSession} onShowToast={showToast} />)}
        {page === 'manager' && (user.authSource==='supabase'?(managerView==='ride'?<LiveUserPage user={user} data={myOperations.data} loading={myOperations.loading} error={myOperations.error} busy={myOperations.busy} onRefresh={myOperations.refresh} onRun={myOperations.run} onRequestSession={myOperations.requestSession} onSessionAction={myOperations.sessionAction}/>:<ManagerOperationsPage view={managerView} onViewChange={navigateManagerView} data={managerOperations.data} loading={managerOperations.loading} error={managerOperations.error} busy={managerOperations.busy} onRefresh={managerOperations.refresh} onRun={managerOperations.run} date={managerReportDate} onDateChange={setManagerReportDate}/>):<ManagerPage view={managerView} onViewChange={navigateManagerView} alerts={alerts} onAcknowledge={acknowledgeAlert} sessionStatus={sessionStatus} onStartPause={handleStartPause} onLock={handleLock} onShowToast={showToast} />)}
        {page === 'manager-profile' && user.role === 'Manager' && (user.authSource==='supabase'?<ProfileSettingsPage user={user} profile={{name:user.name,phone:user.phone??''}} profilePhoto={profilePhoto} onPhotoSave={handleProfilePhotoSave} onSave={handleUserProfileSave} onCancel={() => handleNavigate('manager')} canCloseAccount={false} onResetPassword={handleProfilePasswordReset} onCloseAccount={handleProfileCloseAccount} onShowToast={showToast}/>:<ManagerProfilePage user={user} profile={managerProfile} profilePhoto={profilePhoto} onPhotoSave={handleProfilePhotoSave} onSave={handleManagerProfileSave} onCancel={() => handleNavigate('manager')} canCloseAccount={sessionStatus === 'idle'} onResetPassword={handleProfilePasswordReset} onCloseAccount={handleProfileCloseAccount} onShowToast={showToast} />)}
        {page === 'profile-settings' && user.role !== 'Manager' && <ProfileSettingsPage user={user} profile={user.authSource === 'supabase' ? { name: user.name, phone: user.phone ?? '' } : readUserProfile(user.id)} profilePhoto={profilePhoto} onPhotoSave={handleProfilePhotoSave} onSave={handleUserProfileSave} onCancel={() => handleNavigate(getLandingPage(user.role))} canCloseAccount={user.authSource === 'demo' && (user.role === 'Admin' || sessionStatus === 'idle')} onResetPassword={handleProfilePasswordReset} onCloseAccount={handleProfileCloseAccount} onShowToast={showToast} />}
        {page === 'admin' && <AdminPage authSource={user.authSource} currentAdminId={user.id} onShowToast={showToast} />}
      </Suspense>
      {user.authSource === 'supabase' && myOperations.data && <AnnouncementPopup userId={user.id} sessionActive={!!myOperations.data.session&&['Active','Paused','PendingPause','PendingResume','PendingEnd','EndedPendingSync'].includes(myOperations.data.session.status)} onShowToast={showToast} />}
      <div className={`toast${toast ? ' visible' : ''}`} role="status" aria-live="polite">{toast}</div>
    </AppShell>
  );
}

