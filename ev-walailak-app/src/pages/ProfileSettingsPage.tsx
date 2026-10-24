import { useState, type FormEvent } from 'react';
import { ArrowLeft, BadgeCheck, Check, Mail, Phone, Save, ShieldCheck, UserRound } from 'lucide-react';
import type { DemoUser } from '../auth/demoAuth';
import type { UserProfile } from '../auth/userProfile';
import type { UserRole } from '../types';
import PageHeader from '../components/PageHeader';
import ProfilePhotoControl from '../components/ProfilePhotoControl';
import ProfileAccountActions from '../components/ProfileAccountActions';

interface ProfileSettingsPageProps {
  user: DemoUser;
  profile: UserProfile;
  onSave: (profile: UserProfile) => boolean;
  onCancel: () => void;
  canCloseAccount: boolean;
  onResetPassword: () => void;
  onCloseAccount: () => boolean;
  onShowToast: (message: string) => void;
  profilePhoto: string | null;
  onPhotoSave: (photo: string | null) => boolean;
}

const roleLabels: Record<UserRole, string> = {
  Student: 'นักศึกษา',
  Employee: 'บุคลากร',
  Manager: 'ผู้จัดการ',
  Admin: 'ผู้ดูแลระบบ',
};

export default function ProfileSettingsPage({ user, profile, onSave, onCancel, canCloseAccount, onResetPassword, onCloseAccount, onShowToast, profilePhoto, onPhotoSave }: ProfileSettingsPageProps) {
  const [form, setForm] = useState<{ name: string; phone: string }>({ ...profile, name: profile.name ?? user.name });
  const [saved, setSaved] = useState(false);
  const roleLabel = roleLabels[user.role];

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const profileToSave = {
      phone: form.phone.trim(),
      ...(user.role === 'Admin' ? { name: form.name.trim() } : {}),
    };
    const didSave = onSave(profileToSave);
    if (didSave) setForm({ ...profileToSave, name: profileToSave.name ?? form.name });
    setSaved(didSave);
  }

  return (
    <>
      <PageHeader title="ตั้งค่าโปรไฟล์" description={`จัดการข้อมูลติดต่อในบัญชี${roleLabel}ของคุณ`} badge={user.role} />
      <div className="manager-profile-layout">
        <aside className="panel manager-profile-summary">
          <ProfilePhotoControl photo={profilePhoto} name={form.name} onSave={onPhotoSave} />
          <span className="profile-role"><BadgeCheck size={14} aria-hidden="true" /> {roleLabel}</span>
          <h2>{form.name || 'ชื่อผู้ใช้'}</h2>
          <p>{user.email}</p>
          <div className="profile-summary-divider" />
          <div className="profile-summary-detail"><Phone size={15} aria-hidden="true" /><span>{form.phone || 'ยังไม่ได้ระบุเบอร์โทรศัพท์'}</span></div>
          <div className="callout callout-info profile-local-note"><ShieldCheck size={15} aria-hidden="true" /><p>ข้อมูลและรูปโปรไฟล์เก็บไว้ในเบราว์เซอร์เครื่องนี้ ไม่ได้ส่งไปยังระบบบัญชีจริง</p></div>
        </aside>

        <div className="profile-main-column">
        <section className="panel manager-profile-form-panel">
          <div className="manager-profile-section-heading">
            <span className="profile-section-icon"><UserRound size={18} aria-hidden="true" /></span>
            <div><h2>ข้อมูลบัญชี</h2><p>แก้ไขเบอร์โทรศัพท์ที่ใช้ติดต่อเกี่ยวกับบัญชี</p></div>
          </div>
          <form className="manager-profile-form" onSubmit={handleSubmit}>
            {user.role === 'Admin' ? (
              <label className="profile-field" htmlFor="profile-name">
                <span>ชื่อ–นามสกุล</span>
                <input id="profile-name" name="name" type="text" autoComplete="name" maxLength={80} required value={form.name} onChange={(event) => { setForm({ ...form, name: event.target.value }); setSaved(false); }} />
                <small>การเปลี่ยนชื่อจะบันทึก Audit Log ในข้อมูลตัวอย่าง</small>
              </label>
            ) : (
              <div className="profile-field">
                <span>ชื่อ–นามสกุล</span>
                <div className="profile-readonly-field"><UserRound size={15} aria-hidden="true" /><span>{user.name}</span></div>
                <small>หากต้องการแก้ไข กรุณาติดต่อ Admin</small>
              </div>
            )}
            <div className="profile-field">
              <span>อีเมล</span>
              <div className="profile-readonly-field"><Mail size={15} aria-hidden="true" /><input aria-describedby="profile-email-note" name="email" type="email" value={user.email} readOnly /></div>
              <small id="profile-email-note">ไม่สามารถแก้ไขอีเมลได้ หากเข้าใช้อีเมลไม่ได้ กรุณากู้คืนผ่านผู้ให้บริการอีเมล</small>
            </div>
            <label className="profile-field" htmlFor="profile-phone">
              <span>เบอร์โทรศัพท์</span>
              <input id="profile-phone" name="phone" type="tel" autoComplete="tel" maxLength={30} value={form.phone} placeholder="เช่น 0812345678" onChange={(event) => { setForm({ ...form, phone: event.target.value }); setSaved(false); }} />
            </label>
            <div className="profile-field">
              <span>บทบาทในระบบ</span>
              <div className="profile-readonly-field role-readonly"><BadgeCheck size={15} aria-hidden="true" /><span>{user.role} · {roleLabel}</span><small>กำหนดจากสิทธิ์บัญชี</small></div>
            </div>
            {saved && <p className="profile-save-status" role="status"><Check size={15} aria-hidden="true" /> บันทึกข้อมูลในเบราว์เซอร์นี้แล้ว</p>}
            <div className="profile-form-actions">
              <button className="button button-outline" type="button" onClick={onCancel}><ArrowLeft size={15} />กลับหน้าหลัก</button>
              <button className="button button-primary" type="submit"><Save size={15} />บันทึกข้อมูล</button>
            </div>
          </form>
        </section>
      <ProfileAccountActions canCloseAccount={canCloseAccount} onResetPassword={onResetPassword} onCloseAccount={onCloseAccount} onShowToast={onShowToast} />
        </div>
      </div>
    </>
  );
}
