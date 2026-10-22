import { useState, type FormEvent } from 'react';
import {
  Bike,
  BriefcaseBusiness,
  Eye,
  EyeOff,
  GraduationCap,
  LockKeyhole,
  Settings,
  UsersRound,
} from 'lucide-react';
import {
  authenticateDemoUser,
  DEMO_ROLE_SHORTCUTS,
  getDemoCredentials,
  type DemoUser,
} from '../auth/demoAuth';
import type { UserRole } from '../types';

interface LoginPageProps {
  onLogin: (user: DemoUser) => void;
}

const roleIcons: Record<UserRole, typeof GraduationCap> = {
  Student: GraduationCap,
  Employee: BriefcaseBusiness,
  Manager: UsersRound,
  Admin: Settings,
};

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);

  function handleShortcut(role: UserRole) {
    const credentials = getDemoCredentials(role);
    setEmail(credentials.email);
    setPassword(credentials.password);
    setSelectedRole(role);
    setError('');
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const user = authenticateDemoUser(email, password);
    if (!user) {
      setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
      return;
    }
    onLogin(user);
  }

  function handleEmailChange(value: string) {
    setEmail(value);
    setSelectedRole(null);
    setError('');
  }

  function handlePasswordChange(value: string) {
    setPassword(value);
    setSelectedRole(null);
    setError('');
  }

  return (
    <div className="login-screen">
      <aside className="login-visual" aria-label="EV Walailak">
        <div className="login-brand">
          <span className="login-brand-mark"><Bike size={24} strokeWidth={2} aria-hidden="true" /></span>
          <span className="login-brand-copy">
            <strong>EV Walailak</strong>
            <small>ระบบรถจักรยานยนต์ไฟฟ้า</small>
          </span>
        </div>
        <img className="login-motorcycle" src="/assets/ev-01-motorcycle-login.png" alt="รถจักรยานยนต์ไฟฟ้าต้นแบบ EV-01" />
      </aside>

      <main className="login-main">
        <section className="login-card" aria-labelledby="login-heading">
          <header className="login-heading">
            <h1 id="login-heading">เข้าสู่ระบบ</h1>
            <p>ลงชื่อเข้าใช้เพื่อใช้งานระบบรถจักรยานยนต์ไฟฟ้า</p>
          </header>

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <label className="login-field" htmlFor="login-email">
              <span>อีเมล</span>
              <span className="login-input-wrap">
                <input
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  id="login-email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(event) => handleEmailChange(event.target.value)}
                  placeholder="name@wu.ac.th"
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? 'login-error' : undefined}
                  required
                />
              </span>
            </label>

            <label className="login-field" htmlFor="login-password">
              <span>รหัสผ่าน</span>
              <span className="login-input-wrap password-input-wrap">
                <input
                  autoComplete="current-password"
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => handlePasswordChange(event.target.value)}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? 'login-error' : undefined}
                  required
                />
                <button
                  className="login-password-toggle"
                  type="button"
                  aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((visible) => !visible)}
                >
                  {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                </button>
              </span>
            </label>

            {error ? <p className="login-error" id="login-error" role="alert">{error}</p> : null}

            <button className="login-submit" type="submit">เข้าสู่ระบบ</button>
          </form>

          <section className="demo-accounts" aria-labelledby="demo-accounts-heading">
            <div className="login-divider" aria-hidden="true" />
            <h2 id="demo-accounts-heading">บัญชีทดลอง</h2>
            <div className="demo-shortcuts">
              {DEMO_ROLE_SHORTCUTS.map(({ role, label }) => {
                const Icon = roleIcons[role];
                return (
                  <button
                    className={`demo-shortcut${selectedRole === role ? ' selected' : ''}`}
                    type="button"
                    key={role}
                    aria-pressed={selectedRole === role}
                    onClick={() => handleShortcut(role)}
                  >
                    <Icon size={19} strokeWidth={1.9} aria-hidden="true" />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <p className="login-disclosure"><LockKeyhole size={14} aria-hidden="true" /><span>ข้อมูลบัญชีนี้เป็นข้อมูลจำลอง ไม่ใช่ระบบยืนยันตัวตนจริง</span></p>
        </section>
      </main>
    </div>
  );
}
