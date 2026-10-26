import { useEffect, useState, type FormEvent } from 'react';
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
import RegisterPage from './RegisterPage';
import PasswordRecoveryPage from './PasswordRecoveryPage';
import {
  authenticateUser,
  DEMO_ROLE_SHORTCUTS,
  getDemoCredentials,
} from '../auth/demoAuth';
<<<<<<< HEAD
import {
  getPasswordResetFeedback,
  getVisiblePasswordResetFeedback,
  type EmailBoundPasswordResetFeedback,
} from '../auth/passwordResetFeedback';
import { normalizeAuthEmail } from '../auth/emailAddress';
import { getSupabaseAuthErrorMessage, sendSupabasePasswordReset, signInWithSupabase } from '../auth/supabaseAuth';
=======
import { signInWithSupabase, type AppUser } from '../auth/supabaseAuth';
>>>>>>> origin/develop
import { supabaseConfig } from '../auth/supabaseClient';
import type { UserRole } from '../types';

interface LoginPageProps {
  onLogin: (user: AppUser) => void;
  onPasswordUpdated: () => void;
  notice?: string;
}

const roleIcons: Record<UserRole, typeof GraduationCap> = {
  Student: GraduationCap,
  Employee: BriefcaseBusiness,
  Manager: UsersRound,
  Admin: Settings,
};

<<<<<<< HEAD
const AUTH_ROUTE_STATE_KEY = '__evWalailakAuthRoute';

function writeAuthRoute(route: 'login' | 'register', mode: 'push' | 'replace', path: string) {
  const currentState = window.history.state;
  const baseState = currentState && typeof currentState === 'object' && !Array.isArray(currentState)
    ? currentState as Record<string, unknown>
    : {};
  const nextState = { ...baseState, [AUTH_ROUTE_STATE_KEY]: route };
  if (mode === 'push') window.history.pushState(nextState, '', path);
  else window.history.replaceState(nextState, '', path);
}

export default function LoginPage({ onLogin, notice = '' }: LoginPageProps) {
  const [isRegisterOpen, setIsRegisterOpen] = useState(() => window.location.pathname === '/RegisterPage');
  const [isForgotPassword, setIsForgotPassword] = useState(false);
=======
export default function LoginPage({ onLogin, onPasswordUpdated, notice = '' }: LoginPageProps) {
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isRecoveryOpen, setIsRecoveryOpen] = useState(() => window.location.pathname === '/ForgotPassword');
>>>>>>> origin/develop
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [passwordResetFeedback, setPasswordResetFeedback] = useState<EmailBoundPasswordResetFeedback | null>(null);

  useEffect(() => {
    function syncRecoveryRoute() {
      setIsRecoveryOpen(window.location.pathname === '/ForgotPassword');
    }
    window.addEventListener('popstate', syncRecoveryRoute);
    return () => window.removeEventListener('popstate', syncRecoveryRoute);
  }, []);

  function openRecoveryPage() {
    window.history.pushState({ authPage: 'forgot-password' }, '', '/ForgotPassword');
    setIsRecoveryOpen(true);
    setError('');
<<<<<<< HEAD
    setIsForgotPassword(false);
    setPasswordResetFeedback(null);
    if (window.location.pathname !== '/RegisterPage') {
      writeAuthRoute('register', 'push', `/RegisterPage${window.location.search}${window.location.hash}`);
    }
    setIsRegisterOpen(true);
=======
>>>>>>> origin/develop
  }

  function returnToLoginPage() {
    if (window.location.pathname === '/ForgotPassword') {
      window.history.replaceState({}, '', `/LoginPage${window.location.search}${window.location.hash}`);
    }
    setIsRecoveryOpen(false);
  }

  function handleShortcut(role: UserRole) {
    const credentials = getDemoCredentials(role);
    setEmail(credentials.email);
    setPassword(credentials.password);
    setSelectedRole(role);
    setError('');
  }

  async function handlePasswordReset() {
    const requestedEmail = normalizeAuthEmail(email);
    setPasswordResetFeedback(null);
    setIsSubmitting(true);
    try {
      const result = await sendSupabasePasswordReset(email);
      setPasswordResetFeedback({ requestedEmail, feedback: getPasswordResetFeedback(result) });
    } catch {
      setPasswordResetFeedback({
        requestedEmail,
        feedback: getPasswordResetFeedback({ ok: false, reason: 'request-failed' }),
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  function openForgotPassword() {
    setError('');
    setPasswordResetFeedback(null);
    setSelectedRole(null);
    setIsForgotPassword(true);
  }

  function backToLogin() {
    setIsForgotPassword(false);
    setPasswordResetFeedback(null);
    setError('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    if (isForgotPassword) {
      await handlePasswordReset();
      return;
    }
    setError('');
    setIsSubmitting(true);
    try {
      const demoUser = await authenticateUser(email, password);
      if (demoUser) {
        onLogin({ ...demoUser, authSource: 'demo' });
        return;
      }
      if (supabaseConfig.mode === 'configured') {
        const result = await signInWithSupabase(email, password);
        if (result.user) {
          onLogin(result.user);
          return;
        }
        setError(result.error === 'email-unverified' ? 'กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ'
          : result.error === 'request-failed' ? 'เชื่อมต่อระบบบัญชีไม่สำเร็จ · ตรวจเครือข่ายแล้วลองใหม่'
            : 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
        return;
      }
      setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    } catch {
      setError('เข้าสู่ระบบไม่สำเร็จ · ตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleEmailChange(value: string) {
    setEmail(value);
    setPasswordResetFeedback(null);
    setSelectedRole(null);
    setError('');
  }

  function handlePasswordChange(value: string) {
    setPassword(value);
    setSelectedRole(null);
    setError('');
  }

<<<<<<< HEAD
  const visiblePasswordResetFeedback = getVisiblePasswordResetFeedback(passwordResetFeedback, email);
=======
  if (isRecoveryOpen) {
    return <PasswordRecoveryPage mode="request" onClose={returnToLoginPage} onPasswordUpdated={onPasswordUpdated} />;
  }
>>>>>>> origin/develop

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
            <h1 id="login-heading">{isForgotPassword ? 'ลืมรหัสผ่าน?' : 'เข้าสู่ระบบ'}</h1>
            <p>{isForgotPassword ? 'กรอกอีเมลที่ใช้สมัครสมาชิกเพื่อรับลิงก์ตั้งรหัสผ่านใหม่' : 'ลงชื่อเข้าใช้เพื่อใช้งานระบบรถจักรยานยนต์ไฟฟ้า'}</p>
          </header>
          {!isForgotPassword && notice && <p className="login-notice" role="status">{notice}</p>}

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <label className="login-field" htmlFor="login-email">
              <span>อีเมล</span>
              <span className="login-input-wrap">
                <input
                  autoComplete={isForgotPassword ? 'email' : 'username'}
                  autoCapitalize="none"
                  autoCorrect="off"
                  id="login-email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(event) => handleEmailChange(event.target.value)}
                  disabled={isForgotPassword && isSubmitting}
                  placeholder="name@wu.ac.th"
                  aria-invalid={error || visiblePasswordResetFeedback?.message === 'กรุณากรอกอีเมลให้ถูกต้อง' ? true : undefined}
                  aria-describedby={error ? 'login-error' : visiblePasswordResetFeedback ? 'password-reset-feedback' : undefined}
                  required
                />
              </span>
            </label>

            {!isForgotPassword && <>
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
                    placeholder="xxxxxxxx"
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
            </>}

            <button className="login-forgot-button" type="button" onClick={openRecoveryPage}>ลืมรหัสผ่าน?</button>

            {error ? <p className="login-error" id="login-error" role="alert">{error}</p> : null}

            {isForgotPassword && visiblePasswordResetFeedback && (
              <p
                className={`login-reset-feedback ${visiblePasswordResetFeedback.tone}`}
                id="password-reset-feedback"
                role={visiblePasswordResetFeedback.tone === 'success' ? 'status' : 'alert'}
              >
                {visiblePasswordResetFeedback.message}
              </p>
            )}

            {!isForgotPassword && (
              <button className="login-forgot-button" type="button" onClick={openForgotPassword}>
                ลืมรหัสผ่าน?
              </button>
            )}

            <button className="login-submit" type="submit" disabled={isSubmitting}>
              {isSubmitting ? (isForgotPassword ? 'กำลังส่งคำขอ…' : 'กำลังตรวจสอบ…') : (isForgotPassword ? 'ส่งลิงก์รีเซ็ตรหัสผ่าน' : 'เข้าสู่ระบบ')}
            </button>
          </form>

<<<<<<< HEAD
          {isForgotPassword ? (
            <button className="login-register-button" type="button" disabled={isSubmitting} onClick={backToLogin}>
              กลับไปเข้าสู่ระบบ
            </button>
          ) : <>
            <button
              className="login-register-button"
              type="button"
              onClick={openRegister}
            >
              <UserPlus size={17} aria-hidden="true" />
              <span>ยังไม่มีบัญชีใช่ไหม? สมัครสมาชิก</span>
            </button>
=======
          <button
            className="login-register-button"
            type="button"
            onClick={() => {
              setIsRegisterOpen(true);
              setError('');
            }}
          >
            <UserPlus size={17} aria-hidden="true" />
            <span>ยังไม่มีบัญชีใช่ไหม? สมัครสมาชิก</span>
          </button>
>>>>>>> origin/develop

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

            <p className="login-disclosure"><LockKeyhole size={14} aria-hidden="true" /><span>บัญชีทดลองบันทึกเฉพาะเบราว์เซอร์นี้ · ไม่ใช่ระบบยืนยันตัวตนจริง</span></p>
          </>}
        </section>
      </main>
      {isRegisterOpen && <RegisterPage onClose={() => setIsRegisterOpen(false)} onLogin={onLogin} />}
    </div>
  );
}

