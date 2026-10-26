import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Activity, AlertTriangle, Archive, BadgeCheck, Bell, Check, Clock3, FileClock, LoaderCircle, Megaphone, Save, ShieldCheck, UserRoundCheck } from 'lucide-react';
import { loadAdminPortal, runAdminPortalAction, type AdminPortalSnapshot, type AnnouncementRole, type PortalAnnouncement, type PortalSettings, type PrivacyRequest } from '../auth/adminPortal';

interface AdminPortalPanelsProps { isDemo: boolean; pendingAccountCount?: number | null; onShowToast: (message: string) => void; }
const weekdays = [
  { value: 1, label: 'จันทร์' }, { value: 2, label: 'อังคาร' }, { value: 3, label: 'พุธ' },
  { value: 4, label: 'พฤหัสบดี' }, { value: 5, label: 'ศุกร์' }, { value: 6, label: 'เสาร์' }, { value: 0, label: 'อาทิตย์' },
];
const announcementRoles: AnnouncementRole[] = ['Student', 'Employee', 'Manager', 'Admin'];
function localDateTime(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
const demoSnapshot: AdminPortalSnapshot = {
  pending_accounts: 1,
  permission_accounts: [
    { id: 'demo-student', name: 'นักศึกษาตัวอย่าง', email: 'student@example.com', role: 'Student', induction_confirmed: false, driving_permission: false },
    { id: 'demo-employee', name: 'บุคลากรตัวอย่าง', email: 'employee@example.com', role: 'Employee', induction_confirmed: true, driving_permission: true },
  ],
  settings: { session_start: null, session_end: null, allowed_weekdays: null, cancellation_limit: null, cancellation_cooldown_hours: null, no_show_limit: null, no_show_cooldown_hours: null, effective_from: '' },
  announcements: [], privacy_requests: [],
  service: { manual_out_of_service: false, safety_block_active: false, final_confirmation_required: false, service_reason: '', updated_at: '' },
  audit: [], cancellation_events_available: false, no_show_events_available: false,
};
const unavailableSnapshot: AdminPortalSnapshot = {
  ...demoSnapshot,
  pending_accounts: 0,
  permission_accounts: [],
  settings: { ...demoSnapshot.settings },
};

export default function AdminPortalPanels({ isDemo, pendingAccountCount = null, onShowToast }: AdminPortalPanelsProps) {
  const [loadedSnapshot, setLoadedSnapshot] = useState<AdminPortalSnapshot | null>(isDemo ? demoSnapshot : null);
  const [loading, setLoading] = useState(!isDemo);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [settingsForm, setSettingsForm] = useState<PortalSettings>(isDemo ? demoSnapshot.settings : unavailableSnapshot.settings);
  const [permissionId, setPermissionId] = useState('');
  const [inductionConfirmed, setInductionConfirmed] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementBody, setAnnouncementBody] = useState('');
  const [announcementRolesForm, setAnnouncementRolesForm] = useState<AnnouncementRole[]>([...announcementRoles]);
  const [announcementImportant, setAnnouncementImportant] = useState(false);
  const [announcementPublished, setAnnouncementPublished] = useState(true);
  const [announcementStart, setAnnouncementStart] = useState('');
  const [announcementEnd, setAnnouncementEnd] = useState('');
  const [editingAnnouncement, setEditingAnnouncement] = useState<PortalAnnouncement | null>(null);
  const [privacyNotes, setPrivacyNotes] = useState<Record<string, string>>({});
  const [serviceReason, setServiceReason] = useState('');
  const snapshot = loadedSnapshot ?? unavailableSnapshot;
  const unavailable = !isDemo && loadedSnapshot === null;
  const formDisabled = busy || loading || isDemo || unavailable;

  const refresh = useCallback(async () => {
    if (isDemo) { setLoadedSnapshot(demoSnapshot); setSettingsForm(demoSnapshot.settings); return; }
    setLoading(true); setError('');
    const result = await loadAdminPortal();
    if (result.error !== null) { setError(result.error); setLoadedSnapshot(null); setSettingsForm(unavailableSnapshot.settings); }
    else if (result.data !== null) { setLoadedSnapshot(result.data); setSettingsForm(result.data.settings); }
    setLoading(false);
  }, [isDemo]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function perform(action: Parameters<typeof runAdminPortalAction>[0], payload: Record<string, unknown>, success: string) {
    if (isDemo || unavailable) { onShowToast(isDemo ? 'โหมดตัวอย่าง · ไม่มีการบันทึกข้อมูลจริง' : 'ยังเชื่อมเครื่องมือ Admin กับ Supabase ไม่ได้'); return false; }
    setBusy(true);
    const result = await runAdminPortalAction(action, payload);
    setBusy(false);
    if (result.error) { setError(result.error); return false; }
    onShowToast(success);
    await refresh();
    return true;
  }

  const openPrivacyRequests = useMemo(() => snapshot.privacy_requests.filter((request) => request.status === 'Pending' || request.status === 'InReview'), [snapshot.privacy_requests]);

  function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const hasDays = (settingsForm.allowed_weekdays?.length ?? 0) > 0;
    const hasStart = Boolean(settingsForm.session_start);
    const hasEnd = Boolean(settingsForm.session_end);
    if ((hasDays || hasStart || hasEnd) && !(hasDays && hasStart && hasEnd)) {
      onShowToast('กำหนดวัน เวลาเริ่ม และเวลาสิ้นสุดให้ครบ หรือเว้นว่างทั้งหมด');
      return;
    }
    if (hasStart && hasEnd && settingsForm.session_start! >= settingsForm.session_end!) {
      onShowToast('เวลาสิ้นสุดต้องหลังเวลาเริ่ม');
      return;
    }
    if ((settingsForm.cancellation_limit === null) !== (settingsForm.cancellation_cooldown_hours === null)
      || (settingsForm.no_show_limit === null) !== (settingsForm.no_show_cooldown_hours === null)) {
      onShowToast('กรอกจำนวนครั้งและ Cooldown เป็นคู่ เมื่อได้ค่าจาก Pilot แล้ว');
      return;
    }
    void perform('update_settings', {
      session_start: settingsForm.session_start ?? '', session_end: settingsForm.session_end ?? '',
      allowed_weekdays: settingsForm.allowed_weekdays ?? [],
      cancellation_limit: settingsForm.cancellation_limit ?? '', cancellation_cooldown_hours: settingsForm.cancellation_cooldown_hours ?? '',
      no_show_limit: settingsForm.no_show_limit ?? '', no_show_cooldown_hours: settingsForm.no_show_cooldown_hours ?? '',
    }, 'บันทึกเวลาและเกณฑ์การประเมินแล้ว');
  }

  async function saveAnnouncement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!announcementTitle.trim() || !announcementBody.trim()) return;
    if (announcementRolesForm.length === 0) { onShowToast('เลือกกลุ่มผู้รับประกาศอย่างน้อยหนึ่งกลุ่ม'); return; }
    if (announcementEnd && new Date(announcementEnd) <= new Date(announcementStart || Date.now())) { onShowToast('เวลาสิ้นสุดต้องหลังเวลาเผยแพร่'); return; }
    const success = await perform('save_announcement', {
      ...(editingAnnouncement ? { id: editingAnnouncement.id } : {}),
      title: announcementTitle, body: announcementBody, published: announcementPublished,
      important: announcementImportant, audience_roles: announcementRolesForm,
      starts_at: announcementStart ? new Date(announcementStart).toISOString() : '',
      ends_at: announcementEnd ? new Date(announcementEnd).toISOString() : '',
    }, announcementPublished ? 'บันทึกการเผยแพร่ประกาศแล้ว' : 'บันทึกร่างประกาศแล้ว');
    if (success) resetAnnouncementForm();
  }

  function editAnnouncement(item: PortalAnnouncement) {
    setEditingAnnouncement(item); setAnnouncementTitle(item.title); setAnnouncementBody(item.body);
    setAnnouncementRolesForm(item.audience_roles); setAnnouncementImportant(item.important);
    setAnnouncementPublished(item.published); setAnnouncementStart(localDateTime(item.starts_at)); setAnnouncementEnd(localDateTime(item.ends_at));
  }

  function resetAnnouncementForm() {
    setEditingAnnouncement(null); setAnnouncementTitle(''); setAnnouncementBody('');
    setAnnouncementRolesForm([...announcementRoles]); setAnnouncementImportant(false);
    setAnnouncementPublished(true); setAnnouncementStart(''); setAnnouncementEnd('');
  }

  function toggleAnnouncement(item: PortalAnnouncement) {
    void perform('save_announcement', {
      id: item.id, title: item.title, body: item.body, published: !item.published,
      important: item.important, audience_roles: item.audience_roles,
      starts_at: item.starts_at ?? '', ends_at: item.ends_at ?? '',
      reason: item.published ? 'ถอนประกาศ' : 'เผยแพร่ประกาศ',
    }, item.published ? 'ถอนประกาศแล้ว' : 'เผยแพร่ประกาศแล้ว');
  }

  function requestPermission(id: string, previouslyConfirmed = false) {
    if (!previouslyConfirmed && !inductionConfirmed) { onShowToast('ยืนยันก่อนว่าทีมงานตรวจแล้วว่าผู้ใช้ผ่านการแนะนำ'); return; }
    void perform('set_driving_permission', { id, enabled: true, induction_confirmed: true, reason: 'ยืนยันการผ่านการแนะนำโดยทีมงาน' }, 'เปิด Driving Permission แล้ว');
    setPermissionId(''); setInductionConfirmed(false);
  }

  function reviewPrivacy(request: PrivacyRequest, status: 'InReview' | 'Completed' | 'Rejected') {
    const note = privacyNotes[request.id] ?? '';
    if (status !== 'InReview' && !note.trim()) { onShowToast('กรุณาบันทึกหมายเหตุการพิจารณาก่อนปิดคำขอ'); return; }
    void perform('review_privacy_request', { id: request.id, status, admin_note: note }, 'อัปเดตคำขอข้อมูลส่วนบุคคลแล้ว');
  }

  const permissionPending = snapshot.permission_accounts.filter((account) => !account.driving_permission).length;
  const summaryCards = [
    { label: 'บัญชีรอตรวจ', value: pendingAccountCount ?? (unavailable ? '—' : snapshot.pending_accounts), icon: <UserRoundCheck size={17} /> },
    { label: 'รอยืนยันสิทธิ์ขับ', value: unavailable ? '—' : permissionPending, icon: <ShieldCheck size={17} /> },
    { label: 'คำขอข้อมูลที่เปิดอยู่', value: unavailable ? '—' : openPrivacyRequests.length, icon: <FileClock size={17} /> },
  ];

  return <div className="admin-portal-content">
    <nav className="admin-section-nav" aria-label="ส่วนงาน Admin">
      <a href="#admin-accounts">บัญชีทั้งหมด</a><a href="#admin-dashboard">Dashboard</a><a href="#admin-driving-permission">Driving Permission</a>
      <a href="#admin-session-settings">เวลาเริ่ม Session</a><a href="#admin-threshold-settings">เกณฑ์ Cancellation / No-show</a>
      <a href="#admin-privacy-requests">คำขอข้อมูลส่วนบุคคล</a><a href="#admin-announcements">ประกาศ</a>
      <a href="#admin-audit-log">Audit Log</a><a href="#admin-service-control">สถานะบริการ</a>
    </nav>
    {loading && <div className="admin-feedback info" role="status"><LoaderCircle className="admin-spinner" size={16} /><span>กำลังโหลดข้อมูล Admin…</span></div>}
    {error && <div className="admin-feedback error" role="alert"><AlertTriangle size={16} /><span>{error} · แสดงโครงหน้า Admin เพื่อดูรายการงาน แต่ยังบันทึกไม่ได้</span><button className="text-button" type="button" onClick={() => void refresh()}>โหลดใหม่</button></div>}
    {isDemo && <div className="admin-feedback info"><ShieldCheck size={16} /><span>แสดงข้อมูลจำลอง · การเปลี่ยนแปลงไม่ถูกบันทึก</span></div>}
    <section className="admin-summary-grid" id="admin-dashboard" aria-label="สรุป Dashboard Admin">
      {summaryCards.map((card) => <article className="panel admin-summary-card" key={card.label}><span className="admin-summary-icon">{card.icon}</span><div><span>{card.label}</span><strong>{card.value}</strong></div></article>)}
    </section>
    <section className="panel admin-alert-panel"><div className="heading-with-icon"><Bell size={17} /><h2>คำเตือน Cancellation / No-show</h2></div>
      {unavailable ? <p className="muted">ยังโหลดเกณฑ์และข้อมูลเหตุการณ์ไม่ได้ · ติดตั้ง migration ก่อนตรวจคำเตือน</p> : !snapshot.cancellation_events_available || !snapshot.no_show_events_available
        ? <p className="muted">ยังไม่มีแหล่งข้อมูลเหตุการณ์ Cancellation / No-show สำหรับคำนวณคำเตือน · ไม่ใช้ค่าประมาณแทนข้อมูลจริง</p>
        : <p className="muted">เชื่อมข้อมูลเหตุการณ์แล้ว</p>}
      <span className="panel-kicker">การประเมินใช้เฉพาะเหตุการณ์หลังเวลาเริ่มมีผลของเกณฑ์</span>
    </section>

    <section className="panel admin-permission-panel" id="admin-driving-permission">
      <div className="panel-heading"><div className="heading-with-icon"><ShieldCheck size={17} /><h2>Driving Permission</h2></div><span className="panel-kicker">แยกจากอนุมัติบัญชี</span></div>
      <p className="muted">ต้องยืนยันจากทีมงานว่าผู้ใช้ผ่านการแนะนำก่อนเปิดสิทธิ์ขับขี่</p>
      {snapshot.permission_accounts.length === 0 ? <div className="admin-list-state">{unavailable ? 'ยังโหลดบัญชี Approved ไม่ได้' : 'ไม่มีบัญชี Approved ที่รอจัดการสิทธิ์'}</div> : <div className="table-scroll"><table className="data-table"><thead><tr><th>ชื่อ / อีเมล</th><th>บทบาท</th><th>สถานะการแนะนำ</th><th>การดำเนินการ</th></tr></thead><tbody>
        {snapshot.permission_accounts.map((account) => <tr key={account.id}><td><strong>{account.name}</strong><span className="table-subtext">{account.email}</span></td><td>{account.role}</td><td>{account.induction_confirmed ? 'ยืนยันผ่านแล้ว' : 'ยังไม่ยืนยัน'}</td><td>
          {account.driving_permission ? <button className="button button-small button-outline" type="button" disabled={formDisabled} onClick={() => { if (window.confirm('ยืนยันปิด Driving Permission ของบัญชีนี้?')) void perform('set_driving_permission', { id: account.id, enabled: false, reason: 'Admin ปิดสิทธิ์ขับขี่' }, 'ปิด Driving Permission แล้ว'); }}>ปิดสิทธิ์</button> : <div className="admin-inline-action"><label><input type="checkbox" checked={account.induction_confirmed || (permissionId === account.id && inductionConfirmed)} onChange={(event) => { setPermissionId(account.id); setInductionConfirmed(event.target.checked); }} disabled={formDisabled || account.induction_confirmed} /> {account.induction_confirmed ? 'ทีมงานยืนยันการแนะนำแล้ว' : 'ยืนยันว่าผ่านการแนะนำแล้ว'}</label><button className="button button-small button-primary" type="button" disabled={formDisabled || (!account.induction_confirmed && (permissionId !== account.id || !inductionConfirmed))} onClick={() => requestPermission(account.id, account.induction_confirmed)}>ให้สิทธิ์ขับ</button></div>}
        </td></tr>)}
      </tbody></table></div>}
    </section>

    <section className="panel admin-settings-panel" id="admin-session-settings">
      <div className="panel-heading"><div className="heading-with-icon"><Clock3 size={17} /><h2>เวลาขอเริ่ม Session และเกณฑ์ Pilot</h2></div><span className="panel-kicker">Manager ได้รับการยกเว้น</span></div>
      <p className="muted">การตั้งค่านี้บันทึกในระบบเว็บเท่านั้น จนกว่าจะเชื่อมตัวตรวจสิทธิ์ตอนเริ่ม Session และข้อมูลเหตุการณ์จริงจากรถ</p>
      <form className="admin-portal-form" onSubmit={saveSettings}>
        <div className="admin-form-section"><h3>วันและเวลาเริ่ม Session ของ Student / Employee</h3><p className="muted">เวลาไทย · ยังไม่กำหนดค่าเริ่มต้นตาม C-110 · Manager ยกเว้น และ Session ที่เริ่มถูกต้องแล้วไม่ถูกตัดเมื่อเลยเวลา</p><div className="admin-weekdays" role="group" aria-label="วันที่อนุญาตให้ขอเริ่ม Session">{weekdays.map((day) => <label key={day.value}><input type="checkbox" checked={settingsForm.allowed_weekdays?.includes(day.value) ?? false} onChange={(event) => setSettingsForm({ ...settingsForm, allowed_weekdays: event.target.checked ? [...(settingsForm.allowed_weekdays ?? []), day.value].sort() : (settingsForm.allowed_weekdays ?? []).filter((value) => value !== day.value) })} disabled={formDisabled} />{day.label}</label>)}</div><div className="time-range"><label><span>เริ่มเวลา</span><input type="time" value={settingsForm.session_start ?? ''} onChange={(event) => setSettingsForm({ ...settingsForm, session_start: event.target.value || null })} disabled={formDisabled} /></label><label><span>สิ้นสุดเวลา</span><input type="time" value={settingsForm.session_end ?? ''} onChange={(event) => setSettingsForm({ ...settingsForm, session_end: event.target.value || null })} disabled={formDisabled} /></label></div></div>
        <div className="admin-form-section" id="admin-threshold-settings"><h3>ค่าที่รอผล Pilot</h3><p className="muted">เว้นว่างไว้จนกว่าจะได้ตัวเลขจาก Pilot · ค่าใหม่มีผลต่อการประเมินหลังบันทึกเท่านั้น</p><div className="admin-threshold-grid">
          {([['cancellation_limit','จำนวน Cancellation'],['cancellation_cooldown_hours','Cooldown Cancellation (ชั่วโมง)'],['no_show_limit','จำนวน No-show'],['no_show_cooldown_hours','Cooldown No-show (ชั่วโมง)']] as const).map(([key,label]) => <label key={key}><span>{label}</span><input type="number" min="1" step="1" placeholder="รอผล Pilot" value={settingsForm[key] ?? ''} onChange={(event) => setSettingsForm({ ...settingsForm, [key]: event.target.value === '' ? null : Number(event.target.value) })} disabled={formDisabled} /></label>)}
        </div></div>
        <button className="button button-primary" type="submit" disabled={formDisabled}><Save size={15} />บันทึกการตั้งค่า</button>
        {snapshot.settings.effective_from && <small>มีผลตั้งแต่ {new Date(snapshot.settings.effective_from).toLocaleString('th-TH')}</small>}
      </form>
    </section>

    <div className="admin-secondary-grid">
      <section className="panel admin-announcements-panel" id="admin-announcements">
        <div className="panel-heading"><div className="heading-with-icon"><Megaphone size={17} /><h2>ประกาศโครงการ</h2></div><span className="panel-kicker">เผยแพร่บนหน้าเว็บ</span></div>
        <form className="admin-portal-form" onSubmit={(event) => void saveAnnouncement(event)}>
          <label><span>หัวข้อ</span><input maxLength={120} value={announcementTitle} onChange={(event) => setAnnouncementTitle(event.target.value)} required disabled={formDisabled} /></label>
          <label><span>รายละเอียด</span><textarea maxLength={2000} rows={3} value={announcementBody} onChange={(event) => setAnnouncementBody(event.target.value)} required disabled={formDisabled} /></label>
          <fieldset className="admin-audience"><legend>กลุ่มผู้รับประกาศ</legend><div className="admin-audience-options">{announcementRoles.map((role) => <label key={role}><input type="checkbox" checked={announcementRolesForm.includes(role)} onChange={(event) => setAnnouncementRolesForm(event.target.checked ? [...announcementRolesForm, role] : announcementRolesForm.filter((item) => item !== role))} disabled={formDisabled} />{role}</label>)}</div></fieldset>
          <label className="admin-check-row"><input type="checkbox" checked={announcementImportant} onChange={(event) => setAnnouncementImportant(event.target.checked)} disabled={formDisabled} />ประกาศสำคัญ · แสดงครั้งเดียวหลังเข้าสู่ระบบ</label>
          <div className="time-range"><label><span>เริ่มเผยแพร่ (เว้นว่าง = ทันที)</span><input type="datetime-local" value={announcementStart} onChange={(event) => setAnnouncementStart(event.target.value)} disabled={formDisabled} /></label><label><span>สิ้นสุด (ไม่บังคับ)</span><input type="datetime-local" value={announcementEnd} onChange={(event) => setAnnouncementEnd(event.target.value)} disabled={formDisabled} /></label></div>
          <label className="admin-check-row"><input type="checkbox" checked={announcementPublished} onChange={(event) => setAnnouncementPublished(event.target.checked)} disabled={formDisabled} />เผยแพร่ (ปิดเพื่อเก็บเป็นร่าง)</label>
          <div className="button-row"><button className="button button-primary" type="submit" disabled={formDisabled}><Check size={15} />{editingAnnouncement ? 'บันทึกประกาศ' : announcementPublished ? 'เผยแพร่ประกาศ' : 'บันทึกร่าง'}</button>{editingAnnouncement && <button className="button button-outline" type="button" onClick={resetAnnouncementForm}>ยกเลิกแก้ไข</button>}</div>
        </form>
        <div className="admin-announcement-list">{snapshot.announcements.map((item) => <article key={item.id}><div><strong>{item.title}</strong><p>{item.body}</p><small>{item.published ? item.starts_at && new Date(item.starts_at) > new Date() ? 'รอเวลาเผยแพร่' : 'เผยแพร่' : 'ฉบับร่าง'} · ผู้รับ: {item.audience_roles.join(', ')}{item.important ? ' · สำคัญ' : ''}{item.published_at ? ` · เริ่ม ${new Date(item.published_at).toLocaleString('th-TH')}` : ''}</small></div><div className="admin-announcement-actions"><button className="text-button" type="button" onClick={() => editAnnouncement(item)} disabled={formDisabled}>แก้ไข</button><button className="text-button" type="button" disabled={formDisabled} onClick={() => toggleAnnouncement(item)}>{item.published ? 'ถอนประกาศ' : 'เผยแพร่'}</button></div></article>)}{snapshot.announcements.length === 0 && <p className="muted">{unavailable ? 'ยังโหลดประกาศไม่ได้' : 'ยังไม่มีประกาศ'}</p>}</div>
      </section>

      <section className="panel admin-privacy-panel" id="admin-privacy-requests">
        <div className="panel-heading"><div className="heading-with-icon"><Archive size={17} /><h2>คำขอข้อมูลส่วนบุคคล</h2></div><span className="panel-kicker">{openPrivacyRequests.length} รายการรอดำเนินการ</span></div>
        <p className="muted">พิจารณาคำขอเข้าถึง / แก้ไข / ลบ แยกจากการปิดบัญชี · การทำรายการนี้ไม่ลบข้อมูลอัตโนมัติ · เมื่อสิ้นสุดโครงการต้องลบหรือทำข้อมูลระบุตัวบุคคลให้ไม่เชื่อมโยงกลับได้ภายใน 30 วัน โดยคำนึงถึงหน้าที่ตามกฎหมาย</p>
        {snapshot.privacy_requests.map((request) => <article className="admin-request-card" key={request.id}><div className="admin-request-heading"><strong>{request.requester_name || request.requester_email}</strong><span>{request.request_type === 'access' ? 'เข้าถึง' : request.request_type === 'correction' ? 'แก้ไข' : 'ลบข้อมูล'} · {request.status}</span></div><p>{request.details}</p><small>{new Date(request.created_at).toLocaleString('th-TH')}</small>{request.status === 'Pending' || request.status === 'InReview' ? <><textarea rows={2} placeholder="บันทึกผล/ขั้นตอนตามนโยบายโครงการ" value={privacyNotes[request.id] ?? ''} onChange={(event) => setPrivacyNotes({ ...privacyNotes, [request.id]: event.target.value })} disabled={formDisabled} /><div className="button-row"><button className="button button-outline button-small" type="button" onClick={() => reviewPrivacy(request,'InReview')} disabled={formDisabled}>รับเรื่อง</button><button className="button button-primary button-small" type="button" onClick={() => reviewPrivacy(request,'Completed')} disabled={formDisabled}>ปิดคำขอ</button><button className="button button-danger button-small" type="button" onClick={() => reviewPrivacy(request,'Rejected')} disabled={formDisabled}>ปฏิเสธ</button></div></> : <p className="admin-review-note">ผลพิจารณา: {request.admin_note}</p>}</article>)}
        {snapshot.privacy_requests.length === 0 && <div className="admin-list-state">{unavailable ? 'ยังโหลดคำขอข้อมูลส่วนบุคคลไม่ได้' : 'ไม่มีคำขอข้อมูลส่วนบุคคล'}</div>}
      </section>
    </div>

    <section className="panel admin-service-panel" id="admin-service-control">
      <div className="panel-heading"><div className="heading-with-icon"><Activity size={17} /><h2>สถานะการให้บริการรถ</h2></div><span className="panel-kicker">การบันทึกผ่านเว็บ · ไม่ใช่สถานะสดจากรถ</span></div>
      <div className="admin-service-status">{unavailable ? <span className="account-status pending">ยังไม่ทราบสถานะบริการ</span> : <><span className={`account-status ${snapshot.service.manual_out_of_service || snapshot.service.safety_block_active || snapshot.service.final_confirmation_required ? 'suspended' : 'approved'}`}>{snapshot.service.manual_out_of_service || snapshot.service.safety_block_active || snapshot.service.final_confirmation_required ? 'หยุด / รอยืนยันเปิด' : 'พร้อมให้บริการ'}</span><span>หยุดโดย Admin: {snapshot.service.manual_out_of_service ? 'ใช่' : 'ไม่'} · Safety Block: {snapshot.service.safety_block_active ? 'ยังทำงาน' : 'ปลดแล้ว'}</span></>}</div>
      <label className="admin-reason-field"><span>เหตุผล / บันทึกการตรวจรถ</span><input value={serviceReason} onChange={(event) => setServiceReason(event.target.value)} maxLength={1000} placeholder="ระบุเหตุผลที่ตรวจสอบได้" disabled={formDisabled} /></label>
      <div className="button-row admin-service-actions"><button className="button button-danger" type="button" disabled={formDisabled || snapshot.service.manual_out_of_service || !serviceReason.trim()} onClick={() => void perform('set_manual_service_stop',{enabled:true,reason:serviceReason},'บันทึกหยุดให้บริการแล้ว')}>หยุดให้บริการ</button><button className="button button-outline" type="button" disabled={formDisabled || !snapshot.service.manual_out_of_service || !serviceReason.trim()} onClick={() => void perform('set_manual_service_stop',{enabled:false,reason:serviceReason},'ยกเลิก Manual OUT_OF_SERVICE แล้ว')}>ยกเลิก Manual OUT_OF_SERVICE</button><button className="button button-outline" type="button" disabled={formDisabled || snapshot.service.safety_block_active || !serviceReason.trim()} onClick={() => void perform('set_safety_block',{enabled:true,reason:serviceReason},'บันทึก Safety Block แล้ว')}>บันทึก Safety Block</button><button className="button button-outline" type="button" disabled={formDisabled || !snapshot.service.safety_block_active || !serviceReason.trim()} onClick={() => void perform('set_safety_block',{enabled:false,reason:serviceReason},'บันทึกการตรวจและปลด Safety Block แล้ว')}>ยืนยันตรวจรถและปลด Safety Block</button><button className="button button-primary" type="button" disabled={formDisabled || snapshot.service.manual_out_of_service || snapshot.service.safety_block_active || !snapshot.service.final_confirmation_required || !serviceReason.trim()} onClick={() => void perform('confirm_service_reopen',{reason:serviceReason},'ยืนยันเปิดบริการขั้นสุดท้ายแล้ว')}>ยืนยันเปิดบริการขั้นสุดท้าย</button></div>
      {(snapshot.service.manual_out_of_service || snapshot.service.safety_block_active) && <div className="callout callout-info"><AlertTriangle size={15} /><p>ยังเปิดบริการไม่ได้จนกว่าจะปลดทั้ง Manual OUT_OF_SERVICE และ Safety Block; เมื่อปลดแล้ว Admin ต้องยืนยันเปิดบริการขั้นสุดท้ายอีกครั้ง (C-125)</p></div>}
    </section>

    <section className="panel admin-audit-panel" id="admin-audit-log"><div className="panel-heading"><div className="heading-with-icon"><FileClock size={17} /><h2>Audit Log</h2></div><span className="panel-kicker">แสดง 100 รายการล่าสุด</span></div>
      {snapshot.audit.length === 0 ? <div className="admin-list-state">{unavailable ? 'ยังโหลด Audit Log ไม่ได้' : 'ยังไม่มีประวัติ Admin'}</div> : <div className="table-scroll"><table className="data-table"><thead><tr><th>เวลา</th><th>ผู้ดำเนินการ</th><th>รายการ</th><th>เป้าหมาย</th><th>เหตุผล / รายละเอียด</th></tr></thead><tbody>{snapshot.audit.map((item) => <tr key={item.id}><td>{new Date(item.created_at).toLocaleString('th-TH')}</td><td>{item.actor || 'Admin'}</td><td>{item.action}</td><td>{item.target_type} · {item.target_id}</td><td>{item.reason || '—'}<details className="admin-audit-details"><summary>ดูค่าก่อน / หลัง</summary><small>ก่อน: {JSON.stringify(item.before_value ?? {})}</small><small>หลัง: {JSON.stringify(item.after_value ?? {})}</small></details></td></tr>)}</tbody></table></div>}
      <small><BadgeCheck size={13} /> บันทึกใหม่จะเพิ่มท้ายประวัติและไม่มีคำสั่งแก้ไข/ลบจากหน้าเว็บ</small>
    </section>
  </div>;
}
