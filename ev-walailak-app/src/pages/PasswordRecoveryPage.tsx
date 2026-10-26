import { useState, type FormEvent } from 'react';
import { LockKeyhole, ShieldCheck } from 'lucide-react';
import { isValidAuthPassword } from '../auth/passwordPolicy';

interface PasswordRecoveryPageProps {
  onComplete: () => void | Promise<void>;
  onCancel: () => void;
  onSave: (password: string) => Promise<boolean>;
}

export default function PasswordRecoveryPage({ onComplete, onCancel, onSave }: PasswordRecoveryPageProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;
    setError('');
    if (!isValidAuthPassword(password)) {
      setError('รหัสผ่านต้องยาว 9–256 ตัว มีพิมพ์เล็ก พิมพ์ใหญ่ ตัวเลข และอักขระพิเศษ');
      return;
    }
    if (password !== confirmPassword) {
      setError('รหัสผ่านทั้งสองช่องไม่ตรงกัน');
      return;
    }

    setIsSaving(true);
    try {
      if (!await onSave(password)) {
        setError('เปลี่ยนรหัสผ่านไม่สำเร็จ · ลิงก์อาจหมดอายุแล้ว กรุณาขอลิงก์ใหม่');
        return;
      }
      await onComplete();
    } catch {
      setError('เปลี่ยนรหัสผ่านไม่สำเร็จ · ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่');
    } finally {
      setIsSaving(false);
    }
  }

  return (
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
  );
}
