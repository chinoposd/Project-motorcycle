import { useCallback, useEffect, useState } from 'react';
import { clearDemoSession, closeDemoAccount, getLandingPage, isPageAllowed, readDemoSession, writeDemoSession, type DemoUser } from './auth/demoAuth';
import { readManagerProfile, writeManagerProfile, type ManagerProfile } from './auth/managerProfile';
import { readUserProfile, writeUserProfile } from './auth/userProfile';
import { readProfilePhoto, writeProfilePhoto } from './auth/profilePhoto';
import AppShell from './components/AppShell';
import AdminPage from './pages/AdminPage';
import LoginPage from './pages/LoginPage';
import ManagerPage from './pages/ManagerPage';
import ManagerProfilePage from './pages/ManagerProfilePage';
import ProfileSettingsPage from './pages/ProfileSettingsPage';
import OverviewPage from './pages/OverviewPage';
import RidePage from './pages/RidePage';
import { initialAlerts } from './data/mockData';
import type { AlertRecord, ManagerView, PageId, SessionStatus } from './types';

export default function App() {
  const [user, setUser] = useState<DemoUser | null>(() => {
    const restored = readDemoSession();
    if (!restored) return null;
    if (restored.role === 'Manager') return { ...restored, name: readManagerProfile(restored.id, restored.name).name };
    if (restored.role === 'Admin') return { ...restored, name: readUserProfile(restored.id).name ?? restored.name };
    return restored;
  });
  const [managerProfile, setManagerProfile] = useState<ManagerProfile>(() => {
    const restored = readDemoSession();
    return restored?.role === 'Manager'
      ? readManagerProfile(restored.id, restored.name)
      : { name: 'ผู้จัดการระบบ', phone: '', department: 'ระบบบริหารยานพาหนะไฟฟ้า' };
  });
  const [page, setPage] = useState<PageId>(() => user ? getLandingPage(user.role) : 'home');
  const [managerView, setManagerView] = useState<ManagerView>('overview');
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('active');
  const [alerts, setAlerts] = useState<AlertRecord[]>(() => initialAlerts.map((item) => ({ ...item })));
  const [toast, setToast] = useState('');
  const [profilePhoto, setProfilePhoto] = useState<string | null>(() => user ? readProfilePhoto(user.id) : null);

  const showToast = useCallback((message: string) => setToast(message), []);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(''), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  function handleLogin(nextUser: DemoUser) {
    writeDemoSession(nextUser);
    const nextProfile = nextUser.role === 'Manager'
      ? readManagerProfile(nextUser.id, nextUser.name)
      : managerProfile;
    setManagerProfile(nextProfile);
    const userProfile = nextUser.role === 'Admin' ? readUserProfile(nextUser.id) : null;
    setUser(nextUser.role === 'Manager'
      ? { ...nextUser, name: nextProfile.name }
      : nextUser.role === 'Admin' ? { ...nextUser, name: userProfile?.name ?? nextUser.name } : nextUser);
    setProfilePhoto(readProfilePhoto(nextUser.id));
    setPage(getLandingPage(nextUser.role));
    setSessionStatus('active');
    setToast('');
  }

  function handleLogout() {
    clearDemoSession();
    setUser(null);
    setProfilePhoto(null);
    setManagerProfile({ name: 'ผู้จัดการระบบ', phone: '', department: 'ระบบบริหารยานพาหนะไฟฟ้า' });
    setPage('home');
    setManagerView('overview');
    setSessionStatus('idle');
    setToast('');
  }

  function handleNavigate(nextPage: PageId) {
    if (!user) return;
    setPage(isPageAllowed(user.role, nextPage) ? nextPage : getLandingPage(user.role));
  }

  function handleManagerProfileSave(profile: ManagerProfile): boolean {
    if (!user || user.role !== 'Manager' || !writeManagerProfile(user.id, profile)) {
      showToast('บันทึกไม่สำเร็จ · เบราว์เซอร์อาจปิดการจัดเก็บข้อมูล');
      return false;
    }
    const normalizedProfile = readManagerProfile(user.id, user.name);
    setManagerProfile(normalizedProfile);
    setUser({ ...user, name: normalizedProfile.name });
    showToast('บันทึกโปรไฟล์ Manager ในเบราว์เซอร์นี้แล้ว');
    return true;
  }

  function handleUserProfileSave(profile: { name?: string; phone: string }): boolean {
    if (!user || user.role === 'Manager' || !writeUserProfile(user.id, profile, user.role === 'Admin' ? user.name : undefined)) {
      showToast('บันทึกไม่สำเร็จ · เบราว์เซอร์อาจปิดการจัดเก็บข้อมูล');
      return false;
    }
    if (user.role === 'Admin' && profile.name) {
      setUser({ ...user, name: profile.name.trim() });
      showToast('บันทึกข้อมูลโปรไฟล์และ Audit Log ในเบราว์เซอร์นี้แล้ว');
    } else showToast('บันทึกเบอร์โทรศัพท์ในเบราว์เซอร์นี้แล้ว');
    return true;
  }

  function handleProfilePhotoSave(photo: string | null): boolean {
    if (!user || !writeProfilePhoto(user.id, photo)) {
      showToast('บันทึกรูปไม่สำเร็จ · พื้นที่จัดเก็บในเบราว์เซอร์อาจไม่เพียงพอ');
      return false;
    }
    setProfilePhoto(photo);
    showToast(photo ? 'บันทึกรูปโปรไฟล์ในเบราว์เซอร์นี้แล้ว' : 'ลบรูปโปรไฟล์แล้ว');
    return true;
  }

  function handleProfilePasswordReset() {
    showToast('บัญชีตัวอย่างยังไม่เชื่อม Supabase Auth · ยังไม่ได้ส่งอีเมล');
  }

  function handleProfileCloseAccount(): boolean {
    if (!user || (user.role !== 'Admin' && sessionStatus !== 'idle') || !closeDemoAccount(user.id)) {
      showToast('ปิดบัญชีไม่ได้ · ยังมี Session ค้างหรือจัดเก็บข้อมูลไม่สำเร็จ');
      return false;
    }
    clearDemoSession();
    setUser(null);
    setPage('home');
    setSessionStatus('idle');
    setToast('ปิดบัญชีตัวอย่างแล้ว · ประวัติเดิมไม่ได้ถูกลบ');
    return true;
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

  if (!user) return <LoginPage onLogin={handleLogin} notice={toast} />;

  return (
    <AppShell page={page} user={user} profilePhoto={profilePhoto} onNavigate={handleNavigate} onLogout={handleLogout}>
      {page === 'home' && <OverviewPage sessionStatus={sessionStatus} onStartPause={handleStartPause} onLock={handleLock} onShowToast={showToast} />}
      {page === 'ride' && <RidePage status={sessionStatus} onPauseResume={handleStartPause} onEnd={handleEndSession} onShowToast={showToast} />}
      {page === 'manager' && <ManagerPage view={managerView} onViewChange={setManagerView} alerts={alerts} onAcknowledge={acknowledgeAlert} sessionStatus={sessionStatus} onStartPause={handleStartPause} onLock={handleLock} onShowToast={showToast} />}
      {page === 'manager-profile' && user.role === 'Manager' && <ManagerProfilePage user={user} profile={managerProfile} profilePhoto={profilePhoto} onPhotoSave={handleProfilePhotoSave} onSave={handleManagerProfileSave} onCancel={() => handleNavigate('manager')} canCloseAccount={sessionStatus === 'idle'} onResetPassword={handleProfilePasswordReset} onCloseAccount={handleProfileCloseAccount} onShowToast={showToast} />}
      {page === 'profile-settings' && user.role !== 'Manager' && <ProfileSettingsPage user={user} profile={readUserProfile(user.id)} profilePhoto={profilePhoto} onPhotoSave={handleProfilePhotoSave} onSave={handleUserProfileSave} onCancel={() => handleNavigate(getLandingPage(user.role))} canCloseAccount={user.role === 'Admin' || sessionStatus === 'idle'} onResetPassword={handleProfilePasswordReset} onCloseAccount={handleProfileCloseAccount} onShowToast={showToast} />}
      {page === 'admin' && <AdminPage onShowToast={showToast} />}
      <div className={`toast${toast ? ' visible' : ''}`} role="status" aria-live="polite">{toast}</div>
    </AppShell>
  );
}

