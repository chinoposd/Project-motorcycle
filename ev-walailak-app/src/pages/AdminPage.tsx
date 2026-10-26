import { useMemo, useState, type FormEvent } from 'react';
import { Archive, Check, Search, ShieldCheck, UserRoundCheck, UserRoundX, Wrench } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import {
  addPrototypeAnnouncement,
  addPrototypeAuditEntry,
  setDemoAccountStatus,
  setDemoDrivingPermission,
  setPrototypeService,
  type PrototypeState,
} from '../data/prototypeState';
import type { AccountRecord, UserStatus, UtilityView } from '../types';
import type { AppUser } from '../auth/supabaseAuth';

interface AdminPageProps {
  state: PrototypeState;
  user: AppUser;
  onUpdate: (update: (current: PrototypeState) => PrototypeState) => boolean;
  onShowToast: (message: string) => void;
  onOpenUtility: (view: UtilityView) => void;
}

const filters: ('ทั้งหมด' | UserStatus)[] = ['ทั้งหมด', 'Pending', 'Approved', 'Rejected', 'Suspended'];
const roles: UserRole[] = ['Student', 'Employee', 'Manager', 'Admin'];
const demoAccounts: ManagedAccount[] = initialAccounts.map((account: AccountRecord) => ({
  id: account.id,
  email: account.email,
  fullName: account.name,
  phone: '',
  department: '',
  requestedRole: account.role === 'Employee' ? 'Employee' : 'Student',
  role: account.role,
  createdAt: '',
  updatedAt: '',
  status: account.status,
  statusReason: '',
  drivingPermission: false,
  inductionConfirmed: false,
}));

export default function AdminPage({ state, user, onUpdate, onShowToast, onOpenUtility }: AdminPageProps) {
  const [filter, setFilter] = useState<(typeof filters)[number]>('ทั้งหมด');
  const [query, setQuery] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<AccountRecord | null>(null);
  const [reason, setReason] = useState('');
  const [serviceDraft, setServiceDraft] = useState(state.service);
  const [serviceReason, setServiceReason] = useState('');
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementDetail, setAnnouncementDetail] = useState('');

  const visibleAccounts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('th');
    return state.accounts.filter((account) => (filter === 'ทั้งหมด' || account.status === filter)
      && (!normalizedQuery || (account.name + ' ' + account.email).toLocaleLowerCase('th').includes(normalizedQuery)));
  }, [state.accounts, filter, query]);

  function changeAccountStatus(accountId: string, status: UserStatus) {
    const explanation = reason.trim();
    if ((status === 'Rejected' || status === 'Suspended') && explanation.length < 5) {
      onShowToast('กรอกเหตุผลอย่างน้อย 5 ตัวอักษรก่อนปฏิเสธหรือระงับ');
      return;
    }
    const saved = onUpdate((current) => {
      const updated = setDemoAccountStatus(current, accountId, status);
      return addPrototypeAuditEntry(updated, { id: user.id, name: user.name }, 'เปลี่ยนสถานะบัญชีตัวอย่าง', accountId, explanation || 'อนุมัติบัญชีตัวอย่าง');
    });
    const next = state.accounts.find((account) => account.id === accountId);
    if (next) setSelectedAccount({ ...next, status });
    setReason('');
    onShowToast(saved ? 'บันทึกสถานะบัญชีตัวอย่างและ Audit Log แล้ว · ไม่เปลี่ยนบัญชี Supabase จริง' : 'เปลี่ยนข้อมูลในหน้าจอแล้ว · เบราว์เซอร์บันทึกไม่ได้');
  }

  function changeDrivingPermission(checked: boolean) {
    if (!selectedAccount) return;
    const explanation = reason.trim();
    if (explanation.length < 5) {
      onShowToast('กรอกเหตุผลอย่างน้อย 5 ตัวอักษรก่อนเปลี่ยน Driving Permission');
      return;
    }
    const saved = onUpdate((current) => {
      const updated = setDemoDrivingPermission(current, selectedAccount.id, checked);
      return addPrototypeAuditEntry(updated, { id: user.id, name: user.name }, checked ? 'ให้ Driving Permission ตัวอย่าง' : 'ถอน Driving Permission ตัวอย่าง', selectedAccount.id, explanation);
    });
    setSelectedAccount({ ...selectedAccount, drivingPermission: checked });
    setReason('');
    onShowToast(saved ? 'บันทึก Driving Permission แยกจากสถานะบัญชีแล้ว' : 'เปลี่ยนข้อมูลในหน้าจอแล้ว · เบราว์เซอร์บันทึกไม่ได้');
  }

  function saveService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (serviceReason.trim().length < 5) {
      onShowToast('กรอกเหตุผลอย่างน้อย 5 ตัวอักษรก่อนบันทึกเวลาให้บริการ');
      return;
    }
    const saved = onUpdate((current) => {
      const changed = setPrototypeService(current, { ...serviceDraft, serviceReason: serviceReason.trim() });
      return addPrototypeAuditEntry(changed, { id: user.id, name: user.name }, 'บันทึกเวลา/สถานะให้บริการตัวอย่าง', 'EV-01', serviceReason);
    });
    onShowToast(saved ? 'บันทึกเวลาการให้บริการในข้อมูลตัวอย่างแล้ว' : 'เปลี่ยนข้อมูลในหน้าจอแล้ว · เบราว์เซอร์บันทึกไม่ได้');
  }

  function setManualOutOfService(manualOutOfService: boolean) {
    if (serviceReason.trim().length < 5) {
      onShowToast('กรอกเหตุผลอย่างน้อย 5 ตัวอักษรก่อนเปลี่ยนสถานะรถ');
      return;
    }
    const service = { ...state.service, manualOutOfService, serviceReason: serviceReason.trim() };
    const saved = onUpdate((current) => {
      const changed = setPrototypeService(current, service);
      return addPrototypeAuditEntry(changed, { id: user.id, name: user.name }, manualOutOfService ? 'หยุดรถตัวอย่างด้วยเหตุผล Admin' : 'เปิดสถานะบริการรถตัวอย่าง', 'EV-01', serviceReason);
    });
    setServiceDraft(service);
    onShowToast(saved ? 'บันทึกสถานะบริการตัวอย่างแล้ว' : 'เปลี่ยนข้อมูลในหน้าจอแล้ว · เบราว์เซอร์บันทึกไม่ได้');
  }

  function publishAnnouncement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!announcementTitle.trim() || !announcementDetail.trim()) return;
    const saved = onUpdate((current) => {
      const changed = addPrototypeAnnouncement(current, announcementTitle, announcementDetail);
      return addPrototypeAuditEntry(changed, { id: user.id, name: user.name }, 'เพิ่มประกาศตัวอย่าง', announcementTitle, 'แสดงในเบราว์เซอร์นี้เท่านั้น');
    });
    setAnnouncementTitle('');
    setAnnouncementDetail('');
    onShowToast(saved ? 'เพิ่มประกาศตัวอย่างแล้ว' : 'เพิ่มประกาศเฉพาะในหน้าจอ · เบราว์เซอร์บันทึกไม่ได้');
  }

  return (
    <>
      <PageHeader title="จัดการระบบ" description="บัญชีตัวอย่าง · การให้บริการ · ประกาศ · Audit Log" badge="Admin" />
      <div className="dashboard-grid admin-grid">
        <section className="panel admin-users-panel">
          <div className="panel-heading"><div><h2>จัดการบัญชีตัวอย่าง</h2><p className="muted">ข้อมูลชุดนี้ไม่แก้บัญชีหรือสิทธิ์ Supabase จริง</p></div><span className="panel-kicker">{state.accounts.length} รายการ</span></div>
          <div className="account-toolbar"><div className="account-filters" role="tablist" aria-label="กรองบัญชีผู้ใช้">{filters.map((item) => <button key={item} type="button" role="tab" aria-selected={filter === item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item}</button>)}</div><label className="search-field"><Search size={15} aria-hidden="true" /><input type="search" placeholder="ค้นหาชื่อหรืออีเมล" value={query} onChange={(event) => setQuery(event.target.value)} /></label></div>
          <div className="table-scroll"><table className="data-table account-table"><thead><tr><th>ชื่อ / อีเมล</th><th>บทบาท</th><th>สถานะบัญชี</th><th>Driving Permission</th><th aria-label="การดำเนินการ" /></tr></thead><tbody>{visibleAccounts.map((account) => <tr key={account.id}><td><strong>{account.name}</strong><span className="table-subtext">{account.email}</span></td><td>{account.role}</td><td><span className={'account-status ' + account.status.toLowerCase()}>{account.status}</span></td><td>{account.drivingPermission ? 'มีสิทธิ์' : 'ไม่มีสิทธิ์'}</td><td><button className="button button-small button-outline" type="button" onClick={() => { setSelectedAccount(account); setReason(''); }}>{account.status === 'Pending' ? 'ตรวจสอบ' : 'ดูบัญชี'}</button></td></tr>)}</tbody></table>{visibleAccounts.length === 0 && <div className="empty-row">ไม่พบบัญชีที่ตรงกับการค้นหา</div>}</div>
          {selectedAccount && <div className="selected-account"><div className="selected-head"><div><span className="panel-kicker">บัญชีตัวอย่าง · ไม่ใช่บัญชี Supabase</span><strong>{selectedAccount.name}</strong><span>{selectedAccount.email} · {selectedAccount.role}</span></div><button type="button" className="text-button" onClick={() => setSelectedAccount(null)}>ปิด</button></div><label className="admin-reason-field">เหตุผล / หมายเหตุ<textarea maxLength={300} rows={2} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="กรอกเหตุผลสำหรับการเปลี่ยนแปลง" /></label><div className="selected-actions"><button className="button button-primary" type="button" onClick={() => changeAccountStatus(selectedAccount.id, 'Approved')}><UserRoundCheck size={15} />อนุมัติ</button><button className="button button-danger" type="button" onClick={() => changeAccountStatus(selectedAccount.id, 'Rejected')}><UserRoundX size={15} />ปฏิเสธ</button><button className="button button-outline" type="button" onClick={() => changeAccountStatus(selectedAccount.id, 'Suspended')}>ระงับ</button><label className="checkbox-row"><input checked={selectedAccount.drivingPermission} onChange={(event) => changeDrivingPermission(event.target.checked)} type="checkbox" />ให้ Driving Permission แยกจากสถานะบัญชี</label></div></div>}
        </section>

        <aside className="side-column">
          <section className="panel service-settings-panel"><div className="panel-heading"><div><div className="heading-with-icon"><ShieldCheck size={17} /><h2>เวลาขอเริ่ม Session</h2></div><p className="muted">Student / Employee · Manager ได้รับการยกเว้น</p></div></div><form className="admin-settings-form" onSubmit={saveService}><div className="time-range"><label><span>เริ่มเวลา</span><input type="time" value={serviceDraft.startTime} onChange={(event) => setServiceDraft((current) => ({ ...current, startTime: event.target.value }))} /></label><label><span>สิ้นสุดเวลา</span><input type="time" value={serviceDraft.endTime} onChange={(event) => setServiceDraft((current) => ({ ...current, endTime: event.target.value }))} /></label></div><label className="service-select"><span>สถานะการให้บริการ</span><select value={serviceDraft.serviceOpen ? 'open' : 'closed'} onChange={(event) => setServiceDraft((current) => ({ ...current, serviceOpen: event.target.value === 'open' }))}><option value="open">เปิดให้บริการ</option><option value="closed">หยุดให้บริการ</option></select></label><label className="admin-reason-field">เหตุผลที่บันทึก<textarea maxLength={300} required rows={2} value={serviceReason} onChange={(event) => setServiceReason(event.target.value)} placeholder="เช่น ปรับเวลาบริการตามประกาศ" /></label><button className="button button-primary full-width" type="submit"><Check size={16} />บันทึกการตั้งค่า</button></form><div className="callout callout-info">ค่าที่แสดงเป็นข้อมูลตัวอย่าง · ไม่มีผลกับรถจริง</div><div className="admin-service-actions"><button className="button button-outline full-width" type="button" disabled={state.service.manualOutOfService} onClick={() => setManualOutOfService(true)}>หยุดรถชั่วคราว (Admin)</button><button className="button button-outline full-width" type="button" disabled={!state.service.manualOutOfService} onClick={() => setManualOutOfService(false)}>เปิดสถานะรถอีกครั้ง</button></div></section>
          <section className="panel admin-tools-panel"><div className="panel-heading"><div className="heading-with-icon"><Archive size={17} /><h2>การดูแลระบบ</h2></div></div><button className="button button-outline full-width" type="button" onClick={() => onOpenUtility('audit-log')}>ดู Audit Log</button><button className="button button-outline full-width" type="button" onClick={() => onOpenUtility('inspection')}><Wrench size={15} />ตรวจปัญหา / Safety Block</button><button className="button button-outline full-width" type="button" onClick={() => onOpenUtility('privacy-request')}>คำขอใช้สิทธิข้อมูลส่วนบุคคล</button><form className="utility-form admin-announcement-form" onSubmit={publishAnnouncement}><h3>เพิ่มประกาศตัวอย่าง</h3><label>หัวข้อ<input maxLength={100} required value={announcementTitle} onChange={(event) => setAnnouncementTitle(event.target.value)} /></label><label>รายละเอียด<textarea maxLength={500} required rows={3} value={announcementDetail} onChange={(event) => setAnnouncementDetail(event.target.value)} /></label><button className="button button-outline full-width" type="submit">บันทึกประกาศ</button></form><p className="muted">ประกาศและคำขอเป็นข้อมูลในเบราว์เซอร์นี้ ไม่ได้ส่งไปยังระบบจริง</p></section>
          <section className="permission-note"><div className="heading-with-icon"><ShieldCheck size={17} /><h2>ขอบเขตสิทธิ์ผู้ดูแล</h2></div><p>การเปลี่ยนบัญชีตัวอย่าง, Driving Permission และการเปิดบริการไม่เปลี่ยนบัญชี Supabase จริง ไม่ส่งคำสั่งไปยังรถ</p></section>
        </aside>
      </div>
      <AdminPortalPanels isDemo={isDemo} pendingAccountCount={!isDemo && listState === 'ready' ? pendingCount : null} onShowToast={onShowToast} />
    </>
  );
}
