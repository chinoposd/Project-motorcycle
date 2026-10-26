<<<<<<< HEAD
import { useState, type FormEvent } from 'react';
import { LockKeyhole, ShieldCheck } from 'lucide-react';
import { isValidAuthPassword } from '../auth/passwordPolicy';
=======
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, BadgeCheck, Bike, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { isDemoAccountEmail } from '../auth/demoAuth';
import { sendPasswordResetEmail, updateSupabasePassword } from '../auth/supabaseAuth';
import { supabaseConfig } from '../auth/supabaseClient';
>>>>>>> origin/develop

interface PasswordRecoveryPageProps {
  mode: 'request' | 'update';
  onClose: () => void;
  onPasswordUpdated: () => void;
}

const passwordRules = [
  (value: string) => value.length >= 9,
  (value: string) => /[a-z]/.test(value),
  (value: string) => /[A-Z]/.test(value),
  (value: string) => /\d/.test(value),
  (value: string) => /[\p{P}\p{S}]/u.test(value),
];

export default function PasswordRecoveryPage({ mode, onClose, onPasswordUpdated }: PasswordRecoveryPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    dialogRef.current?.querySelector<HTMLElement>('input')?.focus({ preventScroll: true });
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
<<<<<<< HEAD
    if (!isValidAuthPassword(password)) {
      setError('รหัสผ่านต้องยาว 9–256 ตัว มีพิมพ์เล็ก พิมพ์ใหญ่ ตัวเลข และอักขระพิเศษ');
      return;
    }
    if (password !== confirmPassword) {
      setError('รหัสผ่านทั้งสองช่องไม่ตรงกัน');
      return;
    }

    setIsSaving(true);
=======
    setMessage('');
    setIsSubmitting(true);
>>>>>>> origin/develop
    try {
      if (mode === 'request') {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
          setError('กรุณากรอกอีเมลให้ถูกต้อง');
          return;
        }
        if (isDemoAccountEmail(email)) {
          setMessage('บัญชีทดลองไม่มีการส่งอีเมลกู้รหัสผ่าน · ใช้รหัสผ่านเดิมของบัญชีทดลอง');
          return;
        }
        if (supabaseConfig.mode !== 'configured') {
          setMessage('ยังไม่ได้เชื่อม Supabase Auth · ไม่มีการส่งอีเมลจริง');
          return;
        }
        const result = await sendPasswordResetEmail(email);
        if (result) {
          setError(result === 'invalid-registration' ? 'กรุณาตรวจสอบอีเมล' : 'ส่งคำขอไม่สำเร็จ · ตรวจสอบการเชื่อมต่อ Supabase แล้วลองอีกครั้ง');
          return;
        }
        setMessage('ส่งคำขอแล้ว · หากอีเมลนี้มีบัญชีในระบบ จะได้รับลิงก์สำหรับตั้งรหัสผ่านใหม่');
        return;
      }

      if (!passwordRules.every((rule) => rule(password))) {
        setError('รหัสผ่านต้องครบทั้ง 9 ตัวอักษร ตัวพิมพ์เล็ก/ใหญ่ ตัวเลข และอักขระพิเศษ');
        return;
      }
      if (password !== confirmPassword) {
        setError('รหัสผ่านทั้งสองช่องไม่ตรงกัน');
        return;
      }
      const result = await updateSupabasePassword(password);
      if (result) {
        setError('เปลี่ยนรหัสผ่านไม่สำเร็จ · ลิงก์อาจหมดอายุ กรุณาขอลิงก์ใหม่');
        return;
      }
      setMessage('เปลี่ยนรหัสผ่านสำเร็จแล้ว · กลับไปเข้าสู่ระบบด้วยรหัสผ่านใหม่');
      onPasswordUpdated();
    } catch {
      setError(mode === 'request' ? 'ส่งอีเมลไม่สำเร็จ · ตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง' : 'เปลี่ยนรหัสผ่านไม่สำเร็จ · กรุณาขอลิงก์ใหม่');
    } finally {
      setIsSubmitting(false);
    }
  }

  const isUpdate = mode === 'update';
  return (
<<<<<<< HEAD
    <main className="login-main">
      <section className="login-card" aria-labelledby="password-recovery-title">
        <header className="login-heading">
          <span className="profile-section-icon"><ShieldCheck size={20} aria-hidden="true" /></span>
          <h1 id="password-recovery-title">ตั้งรหัสผ่านใหม่</h1>
          <p>กำหนดรหัสผ่านใหม่สำหรับบัญชี Supabase ของคุณ</p>
        </header>
        <form className="login-form" onSubmit={(event) => { void handleSubmit(event); }}>
          <label className="login-field" htmlFor="recovery-password">
            <span>รหัสผ่านใหม่</span>
            <span className="login-input-wrap"><input id="recovery-password" type="password" autoComplete="new-password" maxLength={256} required value={password} onChange={(event) => setPassword(event.target.value)} /></span>
          </label>
          <label className="login-field" htmlFor="recovery-confirm-password">
            <span>ยืนยันรหัสผ่านใหม่</span>
            <span className="login-input-wrap"><input id="recovery-confirm-password" type="password" autoComplete="new-password" maxLength={256} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></span>
          </label>
          {error && <p className="login-error" role="alert"><LockKeyhole size={14} aria-hidden="true" /> {error}</p>}
          <button className="login-submit" type="submit" disabled={isSaving}>{isSaving ? 'กำลังบันทึก…' : 'บันทึกรหัสผ่านใหม่'}</button>
          <button className="login-register-button" type="button" disabled={isSaving} onClick={onCancel}>ยกเลิกและกลับไปเข้าสู่ระบบ</button>
        </form>
      </section>
    </main>
=======
    <div className="recovery-page">
      <main className="recovery-form-column">
        <section aria-labelledby="recovery-title" className="recovery-form-content" ref={dialogRef}>
          <button aria-label="กลับไปหน้าเข้าสู่ระบบ" className="recovery-back-button" onClick={onClose} type="button"><ArrowLeft size={16} />กลับไปเข้าสู่ระบบ</button>
          <div className="recovery-kicker"><Bike size={15} />EV Walailak · บัญชีผู้ใช้</div>
          <h1 id="recovery-title">{isUpdate ? 'ตั้งรหัสผ่านใหม่' : 'ลืมรหัสผ่าน'}</h1>
          <p className="recovery-description">{isUpdate ? 'ตั้งรหัสผ่านใหม่สำหรับบัญชี Supabase ของคุณ' : 'กรอกอีเมลบัญชีจริงเพื่อรับลิงก์ตั้งรหัสผ่านใหม่'}</p>
          {message ? <div className="recovery-feedback success" role="status"><BadgeCheck size={19} /><p>{message}</p></div> : (
            <form className="recovery-form" onSubmit={handleSubmit}>
              {isUpdate ? <>
                <label className="register-field" htmlFor="recovery-new-password"><span>รหัสผ่านใหม่</span><span className="register-input-wrap"><LockKeyhole size={17} /><input autoComplete="new-password" id="recovery-new-password" maxLength={256} onChange={(event) => setPassword(event.target.value)} placeholder="สร้างรหัสผ่านใหม่" required type={showPassword ? 'text' : 'password'} value={password} /><button aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'} className="register-password-toggle" onClick={() => setShowPassword((shown) => !shown)} type="button">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label>
                <label className="register-field" htmlFor="recovery-confirm-password"><span>ยืนยันรหัสผ่านใหม่</span><span className="register-input-wrap"><LockKeyhole size={17} /><input autoComplete="new-password" id="recovery-confirm-password" maxLength={256} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="กรอกรหัสผ่านอีกครั้ง" required type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} /><button aria-label={showConfirmPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'} className="register-password-toggle" onClick={() => setShowConfirmPassword((shown) => !shown)} type="button">{showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label>
              </> : <label className="register-field" htmlFor="recovery-email"><span>อีเมล</span><span className="register-input-wrap"><Mail size={17} /><input autoComplete="email" disabled={isSubmitting} id="recovery-email" onChange={(event) => { setEmail(event.target.value); setError(''); setMessage(''); }} placeholder="name@wu.ac.th" required type="email" value={email} /></span></label>}
              {error && <p className="recovery-error" role="alert">{error}</p>}
              <button className="button button-primary full-width" disabled={isSubmitting} type="submit">{isSubmitting ? 'กำลังดำเนินการ…' : isUpdate ? 'บันทึกรหัสผ่านใหม่' : 'ส่งลิงก์กู้รหัสผ่าน'}</button>
            </form>
          )}
          {error && message && <p className="recovery-error" role="alert">{error}</p>}
          {message && <button className="button button-outline full-width recovery-done" onClick={onClose} type="button">กลับไปเข้าสู่ระบบ</button>}
          <p className="recovery-note"><ShieldCheck size={14} />บัญชีทดลองไม่ส่งอีเมล · การกู้บัญชีจริงต้องเชื่อม Supabase Auth</p>
        </section>
      </main>
      <aside className="recovery-info-panel"><div className="recovery-info-content"><div className="register-info-kicker"><Bike size={15} />EV Walailak · Electric Motorcycle</div><h2>{isUpdate ? 'รักษาบัญชีของคุณให้ปลอดภัย' : 'กู้คืนบัญชีอย่างปลอดภัย'}</h2><p>ใช้ลิงก์ที่ส่งไปยังอีเมลบัญชีจริงเพื่อตั้งรหัสผ่านใหม่</p><div className="recovery-illustration"><img src="/assets/ev-01-motorcycle.png" alt="รถจักรยานยนต์ไฟฟ้าต้นแบบ EV-01" /></div><div className="register-info-note"><span className="register-info-icon"><ShieldCheck size={17} /></span><p>ลิงก์ใช้ได้ตามอายุที่กำหนดโดย Supabase Auth · หากหมดอายุให้ขอลิงก์ใหม่</p></div><div className="register-info-note"><span className="register-info-icon"><Mail size={17} /></span><p>ไม่พบอีเมลหรือบัญชีทดลอง จะไม่มีการเปิดเผยว่ามีบัญชีอยู่หรือไม่</p></div></div></aside>
    </div>
>>>>>>> origin/develop
  );
}
