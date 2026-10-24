import { useState, type FormEvent } from 'react';
import { ArrowLeft, BadgeCheck, Building2, Check, Mail, Phone, Save, ShieldCheck, UserRound } from 'lucide-react';
import type { DemoUser } from '../auth/demoAuth';
import type { ManagerProfile } from '../auth/managerProfile';
import PageHeader from '../components/PageHeader';
import ProfilePhotoControl from '../components/ProfilePhotoControl';
import ProfileAccountActions from '../components/ProfileAccountActions';

interface ManagerProfilePageProps {
  user: DemoUser;
  profile: ManagerProfile;
  onSave: (profile: ManagerProfile) => boolean;
  onCancel: () => void;
  profilePhoto: string | null;
  onPhotoSave: (photo: string | null) => boolean;
  canCloseAccount: boolean;
  onResetPassword: () => void;
  onCloseAccount: () => boolean;
  onShowToast: (message: string) => void;
}

export default function ManagerProfilePage({ user, profile, onSave, onCancel, profilePhoto, onPhotoSave, canCloseAccount, onResetPassword, onCloseAccount, onShowToast }: ManagerProfilePageProps) {
  const [form, setForm] = useState(profile);
  const [saved, setSaved] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const profileToSave = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      department: form.department.trim(),
    };
    const didSave = onSave(profileToSave);
    if (didSave) setForm(profileToSave);
    setSaved(didSave);
  }

  return (
    <>
      <PageHeader title="โปรไฟล์ผู้จัดการ" description="จัดการข้อมูลที่ใช้แสดงในบัญชี Manager ของคุณ" badge="Manager" />
      <div className="manager-profile-layout">
        <aside className="panel manager-profile-summary">
          <ProfilePhotoControl photo={profilePhoto} name={form.name} onSave={onPhotoSave} />
          <span className="profile-role"><BadgeCheck size={14} aria-hidden="true" /> ผู้จัดการ</span>
          <h2>{form.name || 'ชื่อผู้จัดการ'}</h2>
          <p>{user.email}</p>
          <div className="profile-summary-divider" />
          <div className="profile-summary-detail"><Building2 size={15} aria-hidden="true" /><span>{form.department || 'ยังไม่ได้ระบุหน่วยงาน'}</span></div>
          <div className="profile-summary-detail"><Phone size={15} aria-hidden="true" /><span>{form.phone || 'ยังไม่ได้ระบุเบอร์โทรศัพท์'}</span></div>
          <div className="callout callout-info profile-local-note"><ShieldCheck size={15} aria-hidden="true" /><p>ข้อมูลและรูปโปรไฟล์เก็บไว้ในเบราว์เซอร์เครื่องนี้ ไม่ได้ส่งไปยังระบบบัญชีจริง</p></div>
        </aside>

        <div className="profile-main-column">
        <section className="panel manager-profile-form-panel">
          <div className="manager-profile-section-heading">
            <span className="profile-section-icon"><UserRound size={18} aria-hidden="true" /></span>
            <div><h2>ข้อมูลส่วนตัว</h2><p>แก้ไขชื่อและข้อมูลติดต่อที่แสดงในระบบ</p></div>
          </div>
          <form className="manager-profile-form" onSubmit={handleSubmit}>
            <label className="profile-field" htmlFor="manager-name">
              <span>ชื่อที่แสดง <em>จำเป็น</em></span>
              <input id="manager-name" name="name" type="text" autoComplete="name" maxLength={80} required value={form.name} onChange={(event) => { setForm({ ...form, name: event.target.value }); setSaved(false); }} />
            </label>
            <label className="profile-field" htmlFor="manager-email">
              <span>อีเมล</span>
              <div className="profile-readonly-field"><Mail size={15} aria-hidden="true" /><input id="manager-email" name="email" type="email" value={user.email} readOnly aria-describedby="manager-email-note" /></div>
              <small id="manager-email-note">อีเมลผูกกับบัญชีทดลอง จึงแก้ไขจากหน้านี้ไม่ได้</small>
            </label>
            <div className="profile-form-grid">
              <label className="profile-field" htmlFor="manager-phone">
                <span>เบอร์โทรศัพท์</span>
                <input id="manager-phone" name="phone" type="tel" autoComplete="tel" maxLength={30} value={form.phone} placeholder="เช่น 0812345678" onChange={(event) => { setForm({ ...form, phone: event.target.value }); setSaved(false); }} />
              </label>
              <label className="profile-field" htmlFor="manager-department">
                <span>หน่วยงาน <em>จำเป็น</em></span>
                <input id="manager-department" name="department" type="text" autoComplete="organization" maxLength={80} required value={form.department} onChange={(event) => { setForm({ ...form, department: event.target.value }); setSaved(false); }} />
              </label>
            </div>
            <div className="profile-field">
              <span>บทบาทในระบบ</span>
              <div className="profile-readonly-field role-readonly"><BadgeCheck size={15} aria-hidden="true" /><span>Manager · ผู้จัดการ</span><small>กำหนดจากสิทธิ์บัญชี</small></div>
            </div>
            {saved && <p className="profile-save-status" role="status"><Check size={15} aria-hidden="true" /> บันทึกข้อมูลในเบราว์เซอร์นี้แล้ว</p>}
            <div className="profile-form-actions">
              <button className="button button-outline" type="button" onClick={onCancel}><ArrowLeft size={15} />กลับหน้าจัดการ</button>
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

