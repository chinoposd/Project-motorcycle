import type { ReactNode } from 'react';
import { Bike, ChevronRight, CircleHelp, LayoutDashboard, LockKeyhole, LogOut, Settings, UserRound, UsersRound } from 'lucide-react';
import { getLandingPage, isPageAllowed, type DemoUser } from '../auth/demoAuth';
import type { PageId } from '../types';

const navItems: { id: PageId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'home', label: 'ภาพรวมผู้ใช้', icon: LayoutDashboard },
  { id: 'ride', label: 'ระหว่างใช้งาน', icon: Bike },
  { id: 'manager', label: 'Manager', icon: UsersRound },
  { id: 'admin', label: 'Admin', icon: Settings },
];

interface AppShellProps {
  authSource: 'demo' | 'supabase';
  page: PageId;
  breadcrumbLabel?: string;
  breadcrumbParent?: { label: string; onNavigate: () => void };
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

export default function AppShell({ authSource, page, breadcrumbLabel, breadcrumbParent, profilePhoto, onNavigate, onLogout, user, children }: AppShellProps) {
  const identity = { initial: user.name.slice(0, 1), label: `${user.name} · ${roleLabels[user.role]}` };
  const profilePage: PageId = user.role === 'Manager' ? 'manager-profile' : 'profile-settings';
  const visibleNavItems = navItems.filter(({ id }) => isPageAllowed(user.role, id));
  const pageLabels: Record<PageId, string> = {
    home: 'ภาพรวม',
    ride: 'ระหว่างใช้งาน',
    manager: 'Manager',
    'manager-profile': 'โปรไฟล์ผู้จัดการ',
    'profile-settings': 'ตั้งค่าโปรไฟล์',
    admin: 'จัดการระบบ',
  };
  const parentPage: Partial<Record<PageId, PageId>> = {
    ride: user.role === 'Manager' ? 'manager' : 'home',
    'manager-profile': 'manager',
    'profile-settings': getLandingPage(user.role),
  };
  const parent = parentPage[page];
  const parentLabel = breadcrumbParent?.label ?? (parent && parent !== page ? pageLabels[parent] : undefined);
  const navigateToParent = breadcrumbParent?.onNavigate ?? (parent && parent !== page ? () => onNavigate(parent) : undefined);
  const currentLabel = breadcrumbLabel ?? pageLabels[page];

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
        <nav className="breadcrumbs" aria-label="เส้นทางนำทาง">
          <ol>
            {parentLabel && navigateToParent && (
              <li>
                <button className="breadcrumb-link" type="button" onClick={navigateToParent}>{parentLabel}</button>
                <ChevronRight className="breadcrumb-separator" size={13} aria-hidden="true" />
              </li>
            )}
            <li><span className="breadcrumb-current" aria-current="page">{currentLabel}</span></li>
          </ol>
        </nav>
        <div className="prototype-note"><LockKeyhole size={14} aria-hidden="true" /><span>{authSource === 'supabase' ? 'ข้อมูลรถและ Session เป็นข้อมูลตัวอย่าง · บัญชีเชื่อมต่อ Supabase' : 'ข้อมูลตัวอย่าง · ยังไม่เชื่อมต่อรถหรือบัญชีจริง'}</span></div>
        {children}
      </main>
      <footer className="site-footer">
        <div><strong>EV Walailak</strong><span>มหาวิทยาลัยวลัยลักษณ์ · ระบบรถจักรยานยนต์ไฟฟ้าต้นแบบ</span></div>
        <span>หน้าจอนี้ใช้ข้อมูลจำลอง</span>
      </footer>
    </div>
  );
}

