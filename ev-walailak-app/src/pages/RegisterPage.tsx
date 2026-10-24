import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { AlertCircle, BadgeCheck, Bike, Check, Circle, Eye, EyeOff, LockKeyhole, Mail, Phone, ShieldCheck, UserRound, UserRoundPlus, X } from 'lucide-react';
import { getSupabaseAuthErrorMessage, signUpWithSupabase } from '../auth/supabaseAuth';
import { supabaseConfig } from '../auth/supabaseClient';

type ApplicantType = '' | 'Student' | 'Employee';
type FormField = 'firstName' | 'lastName' | 'phone' | 'email' | 'applicantType' | 'password' | 'confirmPassword';
interface RegistrationForm extends Record<Exclude<FormField, 'applicantType'>, string> {
  applicantType: ApplicantType;
}
type RegistrationErrors = Partial<Record<FormField, string>>;
type RegistrationFeedback = { type: 'success' | 'confirmation' | 'error'; title: string; message: string };

interface RegisterPageProps {
  onClose: () => void;
}

const initialForm: RegistrationForm = {
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  applicantType: '',
  password: '',
  confirmPassword: '',
};

const passwordRules = [
  { id: 'length', label: 'ความยาวอย่างน้อย 9 ตัวอักษร', test: (value: string) => value.length >= 9 },
  { id: 'lowercase', label: 'มีตัวพิมพ์เล็กภาษาอังกฤษอย่างน้อย 1 ตัว', test: (value: string) => /[a-z]/.test(value) },
  { id: 'uppercase', label: 'มีตัวพิมพ์ใหญ่ภาษาอังกฤษอย่างน้อย 1 ตัว', test: (value: string) => /[A-Z]/.test(value) },
  { id: 'number', label: 'มีตัวเลขอย่างน้อย 1 ตัว', test: (value: string) => /\d/.test(value) },
  { id: 'symbol', label: 'มีอักขระพิเศษอย่างน้อย 1 ตัว', test: (value: string) => /[\p{P}\p{S}]/u.test(value) },
];

function validateForm(form: RegistrationForm): RegistrationErrors {
  const errors: RegistrationErrors = {};
  if (!form.firstName.trim()) errors.firstName = 'กรุณากรอกชื่อ';
  if (!form.lastName.trim()) errors.lastName = 'กรุณากรอกนามสกุล';
  if (`${form.firstName.trim()} ${form.lastName.trim()}`.length > 80) errors.lastName = 'ชื่อและนามสกุลรวมกันต้องไม่เกิน 80 ตัวอักษร';
  if (!form.phone.trim()) errors.phone = 'กรุณากรอกเบอร์โทรศัพท์';
  else if (form.phone.trim().length > 32) errors.phone = 'เบอร์โทรศัพท์ต้องไม่เกิน 32 ตัวอักษร';
  if (!form.email.trim()) errors.email = 'กรุณากรอกอีเมล';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = 'กรุณาตรวจสอบรูปแบบอีเมล';
  if (!form.applicantType) errors.applicantType = 'กรุณาเลือกประเภทผู้สมัคร';
  if (!passwordRules.every((rule) => rule.test(form.password))) errors.password = 'รหัสผ่านยังไม่ครบตามเงื่อนไข';
  if (!form.confirmPassword) errors.confirmPassword = 'กรุณายืนยันรหัสผ่าน';
  else if (form.confirmPassword !== form.password) errors.confirmPassword = 'รหัสผ่านทั้งสองช่องไม่ตรงกัน';
  return errors;
}

function FormFieldError({ id, message }: { id: string; message?: string }) {
  return message ? <span className="register-field-error" id={`${id}-error`} role="alert">{message}</span> : null;
}

export default function RegisterPage({ onClose }: RegisterPageProps) {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState<RegistrationErrors>({});
  const [feedback, setFeedback] = useState<RegistrationFeedback | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const dialog = dialogRef.current;
    document.body.style.overflow = 'hidden';
    dialog?.querySelector<HTMLInputElement>('#register-first-name')?.focus({ preventScroll: true });
    dialog?.querySelector<HTMLElement>('.register-form-column')?.scrollTo({ top: 0, left: 0 });
    dialog?.closest<HTMLElement>('.register-backdrop')?.scrollTo({ top: 0, left: 0 });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
      if (event.key !== 'Tab' || !dialog) return;

      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
      ));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [onClose]);

  function handleChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = event.currentTarget;
    const nextForm = { ...form, [name]: value } as RegistrationForm;
    setForm(nextForm);
    setFeedback(null);
    if (Object.keys(errors).length > 0) setErrors(validateForm(nextForm));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateForm(form);
    setErrors(nextErrors);
    setFeedback(null);
    if (Object.keys(nextErrors).length > 0) {
      const firstInvalidField = Object.keys(nextErrors)[0] as FormField;
      const fieldIds: Record<FormField, string> = {
        firstName: 'register-first-name',
        lastName: 'register-last-name',
        phone: 'register-phone',
        email: 'register-email',
        applicantType: 'register-applicant-type',
        password: 'register-password',
        confirmPassword: 'register-confirm-password',
      };
      window.requestAnimationFrame(() => {
        const field = dialogRef.current?.querySelector<HTMLElement>(`#${fieldIds[firstInvalidField]}`);
        field?.focus({ preventScroll: true });
        field?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await signUpWithSupabase({
        name: `${form.firstName.trim()} ${form.lastName.trim()}`,
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
        requestedRole: form.applicantType as 'Student' | 'Employee',
      });

      if (result.error) {
        setFeedback({ type: 'error', title: 'สมัครสมาชิกไม่สำเร็จ', message: getSupabaseAuthErrorMessage(result.error) });
      } else if (result.confirmationRequired) {
        setFeedback({
          type: 'confirmation',
          title: 'สร้างบัญชีแล้ว · กรุณายืนยันอีเมล',
          message: `ส่งลิงก์ยืนยันไปที่ ${form.email.trim()} แล้ว ตรวจกล่องจดหมายและ Spam จากนั้นกลับมาเข้าสู่ระบบ บัญชีจะรอผู้ดูแลอนุมัติ`,
        });
      } else if (result.user) {
        setFeedback({
          type: 'success',
          title: 'สมัครสมาชิกสำเร็จ',
          message: 'บัญชีเข้าสู่ระบบแล้วและอยู่ระหว่างรอผู้ดูแลอนุมัติ',
        });
      } else {
        setFeedback({ type: 'error', title: 'สมัครสมาชิกไม่สำเร็จ', message: getSupabaseAuthErrorMessage('request-failed') });
      }
    } catch {
      setFeedback({ type: 'error', title: 'สมัครสมาชิกไม่สำเร็จ', message: getSupabaseAuthErrorMessage('request-failed') });
    } finally {
      setIsSubmitting(false);
    }
  }

  const confirmMismatch = Boolean(form.confirmPassword) && form.password !== form.confirmPassword;

  return (
    <div className="register-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section
        aria-describedby="register-description"
        aria-labelledby="register-title"
        aria-modal="true"
        className="register-dialog"
        onMouseDown={(event) => event.stopPropagation()}
        ref={dialogRef}
        role="dialog"
      >
        <div className="register-form-column">
          <div className="register-form-content">
              <button aria-label="ปิดหน้าสมัครสมาชิก" className="register-mobile-close" onClick={onClose} type="button"><X size={20} aria-hidden="true" /></button>
            <div className="register-kicker"><UserRoundPlus size={15} aria-hidden="true" /><span>สร้างบัญชีผู้ใช้ใหม่ · New Account</span></div>
            <h1 id="register-title">สมัครสมาชิก</h1>
            <p className="register-description" id="register-description">กรอกข้อมูลเพื่อสมัครใช้งานระบบรถจักรยานยนต์ไฟฟ้า</p>

            <form aria-busy={isSubmitting} className="register-form" noValidate onSubmit={handleSubmit}>
              <div className="register-field-grid">
                <label className="register-field" htmlFor="register-first-name">
                  <span>ชื่อ <b>*</b></span>
                  <span className="register-input-wrap"><UserRound size={17} aria-hidden="true" /><input autoComplete="given-name" disabled={isSubmitting} id="register-first-name" maxLength={80} name="firstName" onChange={handleChange} placeholder="ชื่อ" required value={form.firstName} aria-invalid={Boolean(errors.firstName)} aria-describedby={errors.firstName ? 'register-first-name-error' : undefined} /></span>
                  <FormFieldError id="register-first-name" message={errors.firstName} />
                </label>
                <label className="register-field" htmlFor="register-last-name">
                  <span>นามสกุล <b>*</b></span>
                  <span className="register-input-wrap"><UserRound size={17} aria-hidden="true" /><input autoComplete="family-name" disabled={isSubmitting} id="register-last-name" maxLength={80} name="lastName" onChange={handleChange} placeholder="นามสกุล" required value={form.lastName} aria-invalid={Boolean(errors.lastName)} aria-describedby={errors.lastName ? 'register-last-name-error' : undefined} /></span>
                  <FormFieldError id="register-last-name" message={errors.lastName} />
                </label>
              </div>

              <label className="register-field" htmlFor="register-email">
                <span>อีเมล <b>*</b></span>
                <span className="register-input-wrap"><Mail size={17} aria-hidden="true" /><input autoComplete="email" disabled={isSubmitting} id="register-email" maxLength={320} name="email" onChange={handleChange} placeholder="name@example.com" required type="email" value={form.email} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'register-email-error' : undefined} /></span>
                <FormFieldError id="register-email" message={errors.email} />
              </label>

              <label className="register-field" htmlFor="register-phone">
                <span>เบอร์โทรศัพท์ <b>*</b></span>
                <span className="register-input-wrap"><Phone size={17} aria-hidden="true" /><input autoComplete="tel" disabled={isSubmitting} id="register-phone" maxLength={32} name="phone" onChange={handleChange} placeholder="0xx-xxx-xxxx" required type="tel" value={form.phone} aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? 'register-phone-error' : 'register-phone-hint'} /></span>
                <small id="register-phone-hint">ใช้สำหรับติดต่อเกี่ยวกับบัญชีและการใช้งาน</small>
                <FormFieldError id="register-phone" message={errors.phone} />
              </label>

              <label className="register-field" htmlFor="register-applicant-type">
                <span>ประเภทผู้สมัคร <b>*</b></span>
                <select disabled={isSubmitting} id="register-applicant-type" name="applicantType" onChange={handleChange} required value={form.applicantType} aria-invalid={Boolean(errors.applicantType)} aria-describedby={errors.applicantType ? 'register-applicant-type-error' : undefined}>
                  <option value="" disabled>เลือกประเภทผู้สมัคร</option>
                  <option value="Student">นักศึกษา · Student</option>
                  <option value="Employee">บุคลากร · Employee</option>
                </select>
                <FormFieldError id="register-applicant-type" message={errors.applicantType} />
              </label>

              <div className="register-field-grid">
                <label className="register-field" htmlFor="register-password">
                  <span>รหัสผ่าน <b>*</b></span>
                  <span className="register-input-wrap"><LockKeyhole size={17} aria-hidden="true" /><input autoComplete="new-password" disabled={isSubmitting} id="register-password" maxLength={256} name="password" onChange={handleChange} placeholder="สร้างรหัสผ่าน" required type={showPassword ? 'text' : 'password'} value={form.password} aria-invalid={Boolean(errors.password)} aria-describedby="register-password-rules" />
                    <button aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'} className="register-password-toggle" disabled={isSubmitting} onClick={() => setShowPassword((shown) => !shown)} type="button">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
                  </span>
                </label>
                <label className="register-field" htmlFor="register-confirm-password">
                  <span>ยืนยันรหัสผ่าน <b>*</b></span>
                  <span className="register-input-wrap"><LockKeyhole size={17} aria-hidden="true" /><input autoComplete="new-password" disabled={isSubmitting} id="register-confirm-password" maxLength={256} name="confirmPassword" onChange={handleChange} placeholder="กรอกรหัสผ่านอีกครั้ง" required type={showConfirmPassword ? 'text' : 'password'} value={form.confirmPassword} aria-invalid={Boolean(errors.confirmPassword || confirmMismatch)} aria-describedby={errors.confirmPassword ? 'register-confirm-password-error' : undefined} />
                    <button aria-label={showConfirmPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'} className="register-password-toggle" disabled={isSubmitting} onClick={() => setShowConfirmPassword((shown) => !shown)} type="button">{showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
                  </span>
                  <FormFieldError id="register-confirm-password" message={errors.confirmPassword} />
                </label>
              </div>

              <ul aria-label="เงื่อนไขรหัสผ่าน" className="register-password-rules" id="register-password-rules" aria-live="polite">
                {passwordRules.map((rule) => {
                  const passed = rule.test(form.password);
                  return <li className={passed ? 'passed' : ''} key={rule.id}>{passed ? <Check size={14} aria-hidden="true" /> : <Circle size={14} aria-hidden="true" />}<span>{rule.label}</span></li>;
                })}
              </ul>
              <FormFieldError id="register-password" message={errors.password} />
              {confirmMismatch && !errors.confirmPassword && <span className="register-field-error" role="status">รหัสผ่านทั้งสองช่องไม่ตรงกัน</span>}

              {feedback && (
                <div className={`register-feedback register-feedback-${feedback.type}`} role={feedback.type === 'error' ? 'alert' : 'status'}>
                  {feedback.type === 'error' ? <AlertCircle size={19} aria-hidden="true" /> : <BadgeCheck size={19} aria-hidden="true" />}
                  <div>
                    <strong>{feedback.title}</strong>
                    <span>{feedback.message}</span>
                  </div>
                </div>
              )}

              <div className="register-actions">
                <button className="button button-outline register-cancel" onClick={onClose} type="button">ยกเลิก</button>
                <button className="button button-primary register-submit" disabled={isSubmitting} type="submit">{isSubmitting ? 'กำลังสร้างบัญชี…' : 'สมัครสมาชิก'}</button>
              </div>
              <p className="register-privacy-note"><LockKeyhole size={13} aria-hidden="true" />{supabaseConfig.mode === 'configured' ? 'ข้อมูลจะถูกส่งไปยัง Supabase เพื่อสร้างบัญชีและโปรไฟล์ที่รออนุมัติ' : 'ต้องตั้งค่า Supabase ก่อน จึงจะส่งข้อมูลเพื่อสร้างบัญชีได้'}</p>
            </form>
          </div>
        </div>

        <aside className="register-info-panel">
          <button aria-label="ปิดหน้าสมัครสมาชิก" className="register-close" onClick={onClose} type="button"><X size={20} aria-hidden="true" /></button>
          <div className="register-info-content">
            <div className="register-info-kicker"><Bike size={15} aria-hidden="true" /><span>EV Walailak · Electric Motorcycle</span></div>
            <h2>เริ่มต้นการเดินทางอย่างปลอดภัย</h2>
            <p>ระบบรถจักรยานยนต์ไฟฟ้าพร้อมข้อมูลและแนวทางการใช้งานสำหรับนักศึกษาและบุคลากร</p>
            <div className="register-illustration" aria-hidden="true">
              <span className="register-orbit orbit-one" />
              <span className="register-orbit orbit-two" />
              <img src="/assets/ev-01-motorcycle.png" alt="" />
              <span className="register-float-badge"><ShieldCheck size={15} /> มอเตอร์ไซค์ไฟฟ้า EV-01</span>
            </div>
            <div className="register-info-note">
              <span className="register-info-icon"><BadgeCheck size={17} aria-hidden="true" /></span>
              <p>หลังส่งคำสมัคร บัญชีจริงจะรอผู้ดูแลตรวจสอบและอนุมัติก่อนใช้งาน</p>
            </div>
            <div className="register-info-note">
              <span className="register-info-icon"><Mail size={17} aria-hidden="true" /></span>
              <p>หากระบบส่งอีเมลยืนยัน โปรดยืนยันก่อนเข้าสู่ระบบ</p>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
