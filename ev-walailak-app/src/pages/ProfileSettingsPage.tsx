import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, BadgeCheck, Check, CircleAlert, Mail, Phone, Save, ShieldCheck, UserRound } from 'lucide-react';
import type { AppUser } from '../auth/supabaseAuth';
import type { UserProfile } from '../auth/userProfile';
import type { UserRole } from '../types';
import PageHeader from '../components/PageHeader';
import ProfilePhotoControl from '../components/ProfilePhotoControl';
import ProfileAccountActions from '../components/ProfileAccountActions';
import { loadMyDataSubjectRequests, submitDataSubjectRequest, type UserPrivacyRequest } from '../auth/adminPortal';

interface ProfileSettingsPageProps {
  user: AppUser;
  profile: UserProfile;
  onSave: (profile: UserProfile) => boolean | Promise<boolean>;
  onCancel: () => void;
  canCloseAccount: boolean;
  onResetPassword: () => void | Promise<void>;
  onCloseAccount: () => boolean;
  onShowToast: (message: string) => void;
  profilePhoto: string | null;
  onPhotoSave: (photo: string | null) => boolean | Promise<boolean>;
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
  const [isSaving, setIsSaving] = useState(false);
  const [privacyType, setPrivacyType] = useState<'access' | 'correction' | 'deletion'>('access');
  const [privacyDetails, setPrivacyDetails] = useState('');
  const [privacyRequests, setPrivacyRequests] = useState<UserPrivacyRequest[]>([]);
  const [privacyError, setPrivacyError] = useState('');
  const [privacySubmitting, setPrivacySubmitting] = useState(false);
  const roleLabel = roleLabels[user.role];

  useEffect(() => {
    if (user.authSource !== 'supabase') return;
    void loadMyDataSubjectRequests().then((result) => {
      if (result.error !== null) setPrivacyError(result.error);
      else if (result.data !== null) setPrivacyRequests(result.data);
    });
  }, [user.authSource]);

  async function handlePrivacyRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (privacySubmitting || user.authSource !== 'supabase') return;
    setPrivacySubmitting(true); setPrivacyError('');
    const result = await submitDataSubjectRequest(privacyType, privacyDetails);
    if (result.error) setPrivacyError(result.error);
    else {
      setPrivacyDetails('');
      const refreshed = await loadMyDataSubjectRequests();
      if (refreshed.error !== null) setPrivacyError(refreshed.error);
      else if (refreshed.data !== null) setPrivacyRequests(refreshed.data);
    }
    setPrivacySubmitting(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;
    const profileToSave = {
      phone: form.phone.trim(),
      ...(user.role === 'Admin' ? { name: form.name.trim() } : {}),
    };
    setIsSaving(true);
    setSaved(false);
    try {
      const didSave = await onSave(profileToSave);
      if (didSave) setForm({ ...profileToSave, name: profileToSave.name ?? form.name });
      setSaved(didSave);
    } finally {
      setIsSaving(false);
    }
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
          <div className="callout callout-info profile-local-note"><ShieldCheck size={15} aria-hidden="true" /><p>{user.authSource === 'supabase' ? 'ข้อมูลโปรไฟล์และรูปบันทึกในบัญชี Supabase ของคุณ โดยแก้ไขได้เฉพาะข้อมูลส่วนตัว' : 'ข้อมูลและรูปโปรไฟล์เก็บไว้ในเบราว์เซอร์เครื่องนี้'}</p></div>
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
                <small>{user.authSource === 'supabase' ? 'ชื่อจะแสดงในบัญชีของคุณหลังบันทึก' : 'การเปลี่ยนชื่อจะบันทึก Audit Log ในข้อมูลตัวอย่าง'}</small>
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
            {saved && <p className="profile-save-status" role="status"><Check size={15} aria-hidden="true" /> {user.authSource === 'supabase' ? 'บันทึกข้อมูลโปรไฟล์แล้ว' : 'บันทึกข้อมูลในเบราว์เซอร์นี้แล้ว'}</p>}
            <div className="profile-form-actions">
              <button className="button button-outline" type="button" disabled={isSaving} onClick={onCancel}><ArrowLeft size={15} />กลับหน้าหลัก</button>
              <button className="button button-primary" type="submit" disabled={isSaving}><Save size={15} />{isSaving ? 'กำลังบันทึก…' : 'บันทึกข้อมูล'}</button>
            </div>
          </form>
        </section>
      <ProfileAccountActions isRealAccount={user.authSource === 'supabase'} canCloseAccount={canCloseAccount} onResetPassword={onResetPassword} onCloseAccount={onCloseAccount} onShowToast={onShowToast} />
      {user.authSource === 'supabase' && <section className="panel profile-privacy-panel"><div className="manager-profile-section-heading"><span className="profile-section-icon"><ShieldCheck size={18} /></span><div><h2>คำขอใช้สิทธิข้อมูลส่วนบุคคล</h2><p>แยกจากการปิดบัญชี · Admin จะตรวจสอบและพิจารณาตามนโยบายโครงการ</p></div></div>
        <form className="admin-portal-form" onSubmit={(event) => void handlePrivacyRequest(event)}><label><span>ประเภทคำขอ</span><select value={privacyType} onChange={(event) => setPrivacyType(event.target.value as typeof privacyType)} disabled={privacySubmitting}><option value="access">ขอเข้าถึงข้อมูล</option><option value="correction">ขอแก้ไขข้อมูล</option><option value="deletion">ขอลบข้อมูล</option></select></label><label><span>รายละเอียด</span><textarea minLength={5} maxLength={2000} rows={3} required value={privacyDetails} onChange={(event) => setPrivacyDetails(event.target.value)} placeholder="ระบุข้อมูลหรือเหตุผลที่ต้องการให้พิจารณา" disabled={privacySubmitting} /></label>{privacyError && <p className="admin-feedback error"><CircleAlert size={15} />{privacyError}</p>}<button className="button button-primary" type="submit" disabled={privacySubmitting}><Save size={15} />{privacySubmitting ? 'กำลังส่ง…' : 'ส่งคำขอให้ Admin'}</button></form>
        <div className="user-privacy-request-list">{privacyRequests.map((request) => <article key={request.id}><strong>{request.request_type === 'access' ? 'เข้าถึงข้อมูล' : request.request_type === 'correction' ? 'แก้ไขข้อมูล' : 'ลบข้อมูล'} · {request.status}</strong><p>{request.details}</p><small>{new Date(request.created_at).toLocaleString('th-TH')}{request.admin_note ? ` · หมายเหตุ Admin: ${request.admin_note}` : ''}</small></article>)}{privacyRequests.length === 0 && <p className="muted">ยังไม่มีคำขอ</p>}</div>
      </section>}
        </div>
      </div>
    </>
  );
}
