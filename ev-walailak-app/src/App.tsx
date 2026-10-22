import { useCallback, useEffect, useState } from 'react';
import AppShell from './components/AppShell';
import AdminPage from './pages/AdminPage';
import ManagerPage from './pages/ManagerPage';
import OverviewPage from './pages/OverviewPage';
import RegisterPage from './pages/RegisterPage';
import RidePage from './pages/RidePage';
import { initialAlerts } from './data/mockData';
import type { AlertRecord, ManagerView, PageId, SessionStatus } from './types';

export default function App() {
  const [page, setPage] = useState<PageId>('home');
  const [pageBeforeRegister, setPageBeforeRegister] = useState<PageId>('home');
  const [managerView, setManagerView] = useState<ManagerView>('overview');
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('active');
  const [alerts, setAlerts] = useState<AlertRecord[]>(() => initialAlerts.map((item) => ({ ...item })));
  const [toast, setToast] = useState('');

  const showToast = useCallback((message: string) => setToast(message), []);

  const navigateTo = useCallback((nextPage: PageId) => {
    if (nextPage === 'register') {
      if (page !== 'register') setPageBeforeRegister(page);
      setPage('register');
      return;
    }
    setPage(nextPage);
  }, [page]);

  const closeRegistration = useCallback(() => {
    setPage(pageBeforeRegister === 'register' ? 'home' : pageBeforeRegister);
  }, [pageBeforeRegister]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(''), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

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

  return (
    <AppShell page={page === 'register' ? pageBeforeRegister : page} onNavigate={navigateTo}>
      {(page === 'home' || page === 'register') && <OverviewPage sessionStatus={sessionStatus} onStartPause={handleStartPause} onLock={handleLock} onShowToast={showToast} />}
      {page === 'ride' && <RidePage status={sessionStatus} onPauseResume={handleStartPause} onEnd={handleEndSession} onShowToast={showToast} />}
      {page === 'manager' && <ManagerPage view={managerView} onViewChange={setManagerView} alerts={alerts} onAcknowledge={acknowledgeAlert} sessionStatus={sessionStatus} onStartPause={handleStartPause} onLock={handleLock} onShowToast={showToast} />}
      {page === 'admin' && <AdminPage onShowToast={showToast} />}
      {page === 'register' && <RegisterPage onClose={closeRegistration} />}
      <div className={`toast${toast ? ' visible' : ''}`} role="status" aria-live="polite">{toast}</div>
    </AppShell>
  );
}
