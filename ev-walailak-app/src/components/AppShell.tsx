import type { ReactNode } from 'react';
import { Bike, CircleHelp, LayoutDashboard, LockKeyhole, LogOut, Settings, UserRound, UsersRound } from 'lucide-react';
import { isPageAllowed, type DemoUser } from '../auth/demoAuth';
import type { PageId } from '../types';

const navItems: { id: PageId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'home', label: 'ภาพรวมผู้ใช้', icon: LayoutDashboard },
  { id: 'ride', label: 'ระหว่างใช้งาน', icon: Bike },
  { id: 'manager', label: 'Manager', icon: UsersRound },
  { id: 'admin', label: 'Admin', icon: Settings },
];

interface AppShellProps {
  page: PageId;
  profilePhoto: string | null;
  onNavigate: (page: PageId) => void;
  onLogout: () => void;
  user: DemoUser;
  children: ReactNode;
}

const roleLabels = {
  Student: 'นักศึกษา',
  Employee: 'บุคลากร',
  Manager: 'ผู้จัดการ',
  Admin: 'ผู้ดูแลระบบ',
} as const;

export default function AppShell({ page, profilePhoto, onNavigate, onLogout, user, children }: AppShellProps) {
  const identity = { initial: user.name.slice(0, 1), label: `${user.name} · ${roleLabels[user.role]}` };
  const profilePage: PageId = user.role === 'Manager' ? 'manager-profile' : 'profile-settings';
  const visibleNavItems = navItems.filter(({ id }) => isPageAllowed(user.role, id));

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-inner">
          <a className="brand" href="#home" onClick={(event) => { event.preventDefault(); onNavigate('home'); }}>
            <span className="brand-mark"><Bike size={22} strokeWidth={2.1} /></span>
            <span className="brand-copy"><strong>EV Walailak</strong><small>ระบบรถจักรยานยนต์ไฟฟ้า</small></span>
          </a>

          <nav className="main-nav" aria-label="เมนูหลัก">
            {visibleNavItems.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                className={`nav-item${page === id ? ' active' : ''}`}
                aria-current={page === id ? 'page' : undefined}
                onClick={() => onNavigate(id)}
              >
                <Icon size={17} strokeWidth={2} aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
          </nav>

          <div className="header-actions">
            <button className="icon-button help-button" type="button" aria-label="คู่มือการใช้งาน" title="คู่มือการใช้งาน">
              <CircleHelp size={19} strokeWidth={1.9} />
            </button>
            <button className={`profile-chip profile-chip-button${page === profilePage ? ' active' : ''}`} type="button" aria-label={`เปิดโปรไฟล์ ${identity.label} (${user.email})`} aria-current={page === profilePage ? 'page' : undefined} title="เปิดตั้งค่าโปรไฟล์" onClick={() => onNavigate(profilePage)}>
                <span className="avatar">{profilePhoto ? <img src={profilePhoto} alt="" /> : <UserRound size={17} aria-hidden="true" />}</span>
                <span className="profile-name">{identity.label}</span>
                <span className="profile-initial">{identity.initial}</span>
            </button>
            <button className="icon-button logout-button" type="button" aria-label="ออกจากระบบ" title="ออกจากระบบ" onClick={onLogout}>
              <LogOut size={17} strokeWidth={1.9} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <main className="main-content">
        <div className="prototype-note"><LockKeyhole size={14} aria-hidden="true" /><span>ข้อมูลตัวอย่าง · ยังไม่เชื่อมต่อรถหรือบัญชีจริง</span></div>
        {children}
      </main>
      <footer className="site-footer">
        <div><strong>EV Walailak</strong><span>มหาวิทยาลัยวลัยลักษณ์ · ระบบรถจักรยานยนต์ไฟฟ้าต้นแบบ</span></div>
        <span>หน้าจอนี้ใช้ข้อมูลจำลอง</span>
      </footer>
    </div>
  );
}

