import { useState, type FormEvent } from 'react';
import {
  Bike,
  BriefcaseBusiness,
  Eye,
  EyeOff,
  GraduationCap,
  LockKeyhole,
  Settings,
  UserPlus,
  UsersRound,
} from 'lucide-react';
import {
  authenticateUser,
  DEMO_ROLE_SHORTCUTS,
  getDemoCredentials,
  registerDemoUser,
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
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleShortcut(role: UserRole) {
    const credentials = getDemoCredentials(role);
    setEmail(credentials.email);
    setPassword(credentials.password);
    setSelectedRole(role);
    setError('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      if (isRegistering) {
        if (password !== confirmPassword) {
          setError('กรุณากรอกรหัสผ่านให้ตรงกัน');
          return;
        }
        const result = await registerDemoUser(name, email, password);
        if (result.error || !result.user) {
          const messages = {
            'invalid-input': 'กรุณากรอกชื่อ อีเมลที่ถูกต้อง และรหัสผ่านอย่างน้อย 8 ตัวอักษร',
            'email-in-use': 'อีเมลนี้มีบัญชีอยู่แล้ว กรุณาเข้าสู่ระบบแทน',
            'storage-unavailable': 'เบราว์เซอร์ไม่สามารถบันทึกบัญชีได้ กรุณาตรวจสอบการตั้งค่าพื้นที่จัดเก็บ',
            'crypto-unavailable': 'เบราว์เซอร์นี้ไม่รองรับการสร้างบัญชีทดลอง',
          } as const;
          setError(messages[result.error ?? 'storage-unavailable']);
          return;
        }
        onLogin(result.user);
        return;
      }

      const user = await authenticateUser(email, password);
      if (!user) {
        setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
        return;
      }
      onLogin(user);
    } finally {
      setIsSubmitting(false);
    }
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
            <h1 id="login-heading">{isRegistering ? 'สมัครบัญชีทดลอง' : 'เข้าสู่ระบบ'}</h1>
            <p>{isRegistering ? 'สร้างบัญชีสำหรับทดลองใช้งานในเบราว์เซอร์นี้' : 'ลงชื่อเข้าใช้เพื่อใช้งานระบบรถจักรยานยนต์ไฟฟ้า'}</p>
          </header>

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            {isRegistering ? (
              <label className="login-field" htmlFor="register-name">
                <span>ชื่อที่แสดง</span>
                <span className="login-input-wrap">
                  <input
                    autoComplete="name"
                    id="register-name"
                    name="name"
                    type="text"
                    value={name}
                    onChange={(event) => { setName(event.target.value); setError(''); }}
                    maxLength={80}
                    required
                  />
                </span>
              </label>
            ) : null}

            <label className="login-field" htmlFor="login-email">
              <span>{isRegistering ? 'อีเมล (ใช้เป็น username)' : 'อีเมล'}</span>
              <span className="login-input-wrap">
                <input
                  autoComplete={isRegistering ? 'email' : 'username'}
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
                  autoComplete={isRegistering ? 'new-password' : 'current-password'}
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => handlePasswordChange(event.target.value)}
                  minLength={isRegistering ? 8 : undefined}
                  maxLength={256}
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

            {isRegistering ? (
              <label className="login-field" htmlFor="register-confirm-password">
                <span>ยืนยันรหัสผ่าน</span>
                <span className="login-input-wrap">
                  <input
                    autoComplete="new-password"
                    id="register-confirm-password"
                    name="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => { setConfirmPassword(event.target.value); setError(''); }}
                    maxLength={256}
                    required
                  />
                </span>
              </label>
            ) : null}

            {error ? <p className="login-error" id="login-error" role="alert">{error}</p> : null}

            <button className="login-submit" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'กำลังตรวจสอบ…' : isRegistering ? 'สร้างบัญชีและเข้าสู่ระบบ' : 'เข้าสู่ระบบ'}
            </button>
          </form>

          <button
            className="login-register-button"
            type="button"
            onClick={() => {
              setIsRegistering((registering) => !registering);
              setError('');
              setPassword('');
              setConfirmPassword('');
            }}
          >
            <UserPlus size={17} aria-hidden="true" />
            <span>{isRegistering ? 'มีบัญชีแล้ว? กลับไปเข้าสู่ระบบ' : 'ยังไม่มีบัญชีใช่ไหม? สมัครสมาชิก'}</span>
          </button>

          {!isRegistering ? (
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
          ) : null}

          <p className="login-disclosure"><LockKeyhole size={14} aria-hidden="true" /><span>บัญชีทดลองบันทึกเฉพาะเบราว์เซอร์นี้ · ไม่ใช่ระบบยืนยันตัวตนจริง</span></p>
        </section>
      </main>
    </div>
  );
}

