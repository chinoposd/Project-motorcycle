import { useCallback, useEffect, useState } from 'react';
import { clearDemoSession, getLandingPage, isPageAllowed, readDemoSession, writeDemoSession, type DemoUser } from './auth/demoAuth';
import AppShell from './components/AppShell';
import AdminPage from './pages/AdminPage';
import LoginPage from './pages/LoginPage';
import ManagerPage from './pages/ManagerPage';
import OverviewPage from './pages/OverviewPage';
import RegisterPage from './pages/RegisterPage';
import RidePage from './pages/RidePage';
import { initialAlerts } from './data/mockData';
import type { AlertRecord, ManagerView, PageId, SessionStatus } from './types';

export default function App() {
  const [user, setUser] = useState<DemoUser | null>(() => readDemoSession());
  const [page, setPage] = useState<PageId>(() => user ? getLandingPage(user.role) : 'home');
  const [pageBeforeRegister, setPageBeforeRegister] = useState<PageId>('home');
  const [loginRegisterOpen, setLoginRegisterOpen] = useState(false);
  const [managerView, setManagerView] = useState<ManagerView>('overview');
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('active');
  const [alerts, setAlerts] = useState<AlertRecord[]>(() => initialAlerts.map((item) => ({ ...item })));
  const [toast, setToast] = useState('');

  const showToast = useCallback((message: string) => setToast(message), []);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(''), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  function handleLogin(nextUser: DemoUser) {
    writeDemoSession(nextUser);
    setUser(nextUser);
    setPage(getLandingPage(nextUser.role));
    setSessionStatus('active');
    setToast('');
  }

  function handleLogout() {
    clearDemoSession();
    setUser(null);
    setPage('home');
    setManagerView('overview');
    setSessionStatus('idle');
    setToast('');
  }

  function handleNavigate(nextPage: PageId) {
    if (!user) return;
    if (nextPage === 'register') {
      setPageBeforeRegister(page);
      setPage('register');
      return;
    }
    setPage(isPageAllowed(user.role, nextPage) ? nextPage : getLandingPage(user.role));
  }

  function closeRegister() {
    setPage(pageBeforeRegister);
    setLoginRegisterOpen(false);
  }

  function handleStartPause() {
    if (sessionStatus === 'active') {
      setSessionStatus('paused');
      showToast('Session ตัวอย่างเข้าสู่สถานะ Pause · ไม่มีคำสั่งส่งถึงรถ');
    } else {
      setSessionStatus('active');
      if (sessionStatus === 'idle') setPage('ride');
      showToast('เปลี่ยนเป็น Active Session ตัวอย่าง · ไม่มีคำสั่งส่งถึงรถ');
    }
  }

  function handleLock() {
    if (sessionStatus === 'active') {
      showToast('ต้องยืนยันว่ารถหยุดนิ่งก่อนสั่ง Lock');
      return;
    }
    setSessionStatus('paused');
    showToast('สาธิต Pause / Lock ภายใน Session เดิม · ไม่มีคำสั่งถึงรถ');
  }

  function handleEndSession() {
    setSessionStatus('idle');
    setPage('home');
    showToast('Session ตัวอย่างสิ้นสุดแล้ว · ระบบจริงต้องยืนยันจุดคืนรถและสถานะรถ');
  }

  function acknowledgeAlert(id: string) {
    setAlerts((previous) => previous.map((item) => item.id === id && item.state === 'unread'
      ? { ...item, state: 'acknowledged' }
      : item));
    showToast('บันทึกการรับทราบ Alert แล้ว · ข้อมูลตัวอย่าง');
  }

  if (!user) {
    return (
      <>
        <LoginPage onLogin={handleLogin} onRegister={() => setLoginRegisterOpen(true)} />
        {loginRegisterOpen && <RegisterPage onClose={closeRegister} />}
      </>
    );
  }

  const visiblePage = page === 'register' ? pageBeforeRegister : page;

  return (
    <AppShell page={visiblePage} user={user} onNavigate={handleNavigate} onLogout={handleLogout}>
      {visiblePage === 'home' && <OverviewPage sessionStatus={sessionStatus} onStartPause={handleStartPause} onLock={handleLock} onShowToast={showToast} />}
      {visiblePage === 'ride' && <RidePage status={sessionStatus} onPauseResume={handleStartPause} onEnd={handleEndSession} onShowToast={showToast} />}
      {visiblePage === 'manager' && <ManagerPage view={managerView} onViewChange={setManagerView} alerts={alerts} onAcknowledge={acknowledgeAlert} sessionStatus={sessionStatus} onStartPause={handleStartPause} onLock={handleLock} onShowToast={showToast} />}
      {visiblePage === 'admin' && <AdminPage onShowToast={showToast} />}
      {page === 'register' && <RegisterPage onClose={closeRegister} />}
      <div className={`toast${toast ? ' visible' : ''}`} role="status" aria-live="polite">{toast}</div>
    </AppShell>
  );
}
