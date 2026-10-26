import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BadgeCheck, Check, CircleAlert, LoaderCircle, RefreshCw, Search, ShieldCheck, UserRoundCheck, UserRoundX } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { initialAccounts } from '../data/mockData';
import AdminWorkspace from '../features/operations/AdminWorkspace';
import type { ApplicantRole, ReviewDecision } from '../auth/adminAccountReview';
import { reviewPendingAdminAccount } from '../auth/adminAccountReview';
import { listAllAdminAccounts, updateAdminAccount, type AccountAction, type ManagedAccount } from '../auth/adminAccounts';
import AdminPortalPanels from './AdminPortalPanels';
import type { AccountRecord, UserRole, UserStatus } from '../types';

interface AdminPageProps {
  authSource: 'demo' | 'supabase';
  currentAdminId: string;
  onShowToast: (message: string) => void;
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

export default function AdminPage({ authSource, currentAdminId, onShowToast }: AdminPageProps) {
  const isDemo = authSource === 'demo';
  const [managedAccounts, setManagedAccounts] = useState<ManagedAccount[]>([]);
  const [listState, setListState] = useState<'loading' | 'ready' | 'error'>(isDemo ? 'ready' : 'loading');
  const [listError, setListError] = useState('');
  const [filter, setFilter] = useState<(typeof filters)[number]>('ทั้งหมด');
  const [query, setQuery] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<ManagedAccount | null>(null);
  const [verifiedRole, setVerifiedRole] = useState<ApplicantRole>('Student');
  const [affiliationVerified, setAffiliationVerified] = useState(false);
  const [decision, setDecision] = useState<ReviewDecision | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [accountAction, setAccountAction] = useState<AccountAction | 'promote_manager' | null>(null);
  const [actionValue, setActionValue] = useState('');
  const [actionReason, setActionReason] = useState('');
  const [inductionConfirmed, setInductionConfirmed] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [adminRevision,setAdminRevision]=useState(0);
  const reviewDialogRef = useRef<HTMLDialogElement>(null);

  const loadAccounts = useCallback(async () => {
    setListState('loading');
    setListError('');
    const result = await listAllAdminAccounts();
    if (result.error !== null) {
      setManagedAccounts([]);
      setSelectedAccount(null);
      setListState('error');
      setListError(result.error);
      return;
    }
    setManagedAccounts(result.data);
    setSelectedAccount((previous) => previous ? result.data.find((account) => account.id === previous.id) ?? null : null);
    setListState('ready');
  }, []);

  useEffect(() => {
    if (isDemo) {
      setManagedAccounts([]);
      setListState('ready');
      setListError('');
      return;
    }
    setManagedAccounts([]);
    setSelectedAccount(null);
    void loadAccounts();
  }, [isDemo, loadAccounts, currentAdminId]);

  useEffect(() => {
    if (selectedAccount) return;
    setVerifiedRole('Student');
    setAffiliationVerified(false);
    setDecision(null);
    setRejectionReason('');
    setReviewError('');
    setAccountAction(null);
    setActionValue('');
    setActionReason('');
    setInductionConfirmed(false);
  }, [selectedAccount]);

  useEffect(() => {
    const dialog = reviewDialogRef.current;
    if (!dialog) return;
    if (selectedAccount && !dialog.open) dialog.showModal();
    if (!selectedAccount && dialog.open) dialog.close();
  }, [selectedAccount]);

  const accounts = useMemo<ManagedAccount[]>(() => isDemo
    ? demoAccounts
    : managedAccounts, [isDemo, managedAccounts]);

  const pendingCount = accounts.filter((account) => account.status === 'Pending').length;

  const visibleAccounts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('th');
    return accounts.filter((account) => (filter === 'ทั้งหมด' || account.status === filter)
      && (!normalizedQuery
        || (account.fullName + ' ' + account.email + ' ' + account.phone + ' ' + account.department)
          .toLocaleLowerCase('th').includes(normalizedQuery)));
  }, [accounts, filter, query]);

  function selectAccount(account: ManagedAccount) {
    setSelectedAccount(account);
    setVerifiedRole(account.requestedRole === 'Employee' ? 'Employee' : 'Student');
    setAffiliationVerified(false);
    setDecision(null);
    setRejectionReason('');
    setReviewError('');
    setSuccessMessage('');
    setAccountAction(null);
    setActionValue('');
    setActionReason('');
    setInductionConfirmed(false);
  }

  async function submitReview() {
    if (!selectedAccount || isDemo || !decision || !affiliationVerified || submitting) return;
    if (decision === 'Rejected' && !rejectionReason.trim()) {
      setReviewError('กรุณาระบุเหตุผลก่อนปฏิเสธบัญชี');
      return;
    }
    setSubmitting(true);
    setReviewError('');
    setSuccessMessage('');
    const result = await reviewPendingAdminAccount({
      accountId: selectedAccount.id,
      decision,
      verifiedRole: decision === 'Approved' ? verifiedRole : null,
      affiliationVerified,
      reason: decision === 'Rejected' ? rejectionReason.trim() : '',
    });
    setSubmitting(false);
    if (result.error !== null) {
      setReviewError(result.error);
      return;
    }

    setSelectedAccount(null);
    setSuccessMessage(result.data.status === 'Approved'
      ? 'อนุมัติบัญชีเป็น ' + result.data.role + ' แล้ว · สิทธิ์ขับขี่ยังคงสถานะเดิม'
      : 'ปฏิเสธบัญชีแล้ว · บันทึกเหตุผลการตรวจสอบเรียบร้อย');
    void loadAccounts();
    setAdminRevision(value=>value+1);
  }

  async function submitAccountAction() {
    if (!selectedAccount || !accountAction || isDemo || submitting) return;
    const promotingManager = accountAction === 'promote_manager';
    if (actionReason.trim().length < 5) { setReviewError('กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร'); return; }
    if (promotingManager && (selectedAccount.status !== 'Approved'
      || (selectedAccount.role !== 'Student' && selectedAccount.role !== 'Employee')
      || selectedAccount.id === currentAdminId)) {
      setReviewError('แต่งตั้ง Manager ได้เฉพาะบัญชี Student หรือ Employee ที่อนุมัติแล้ว'); return;
    }
    if (accountAction === 'rename' && (!actionValue.trim() || actionValue.trim() === selectedAccount.fullName)) {
      setReviewError('ระบุชื่อใหม่ที่ต่างจากชื่อเดิม'); return;
    }
    if (accountAction === 'change_role' && actionValue === selectedAccount.role) {
      setReviewError('เลือกบทบาทใหม่ที่ต่างจากเดิม'); return;
    }
    if (accountAction === 'grant_driving' && !inductionConfirmed) {
      setReviewError('ต้องยืนยันว่าทีมงานตรวจการผ่านการแนะนำแล้ว'); return;
    }
    if ((accountAction === 'suspend' || promotingManager || (accountAction === 'change_role' && (actionValue === 'Admin' || actionValue === 'Manager')))
      && !window.confirm(accountAction === 'suspend'
        ? 'ยืนยันระงับบัญชีนี้และปิด Driving Permission?'
        : promotingManager || actionValue === 'Manager'
          ? 'ยืนยันแต่งตั้งบัญชีนี้เป็น Manager? Driving Permission จะปิดและต้องตรวจเปิดใหม่แยกต่างหาก'
          : 'ยืนยันเปลี่ยนเป็น Admin? บัญชี Admin ใช้ขับรถไม่ได้')) return;
    setSubmitting(true); setReviewError(''); setSuccessMessage('');
    const result = await updateAdminAccount({ accountId: selectedAccount.id, action: promotingManager ? 'change_role' : accountAction,
      value: promotingManager ? 'Manager' : accountAction === 'grant_driving' ? 'induction_confirmed' : actionValue, reason: actionReason });
    setSubmitting(false);
    if (result.error) { setReviewError(result.error); return; }
    setSelectedAccount(null);
    setSuccessMessage(accountAction === 'grant_driving' ? 'ยืนยันการแนะนำและเปิด Driving Permission แล้ว · บันทึก Audit Log แล้ว'
      : accountAction === 'revoke_driving' ? 'ปิด Driving Permission และบันทึก Audit Log แล้ว'
      : promotingManager || accountAction === 'change_role' && actionValue === 'Manager' ? 'แต่งตั้ง Manager แล้ว · บันทึก Audit Log แล้ว · Driving Permission ต้องตรวจและเปิดใหม่แยกต่างหาก'
      : 'บันทึกการจัดการบัญชีและ Audit Log แล้ว · Driving Permission ต้องตรวจแยกเมื่อบทบาทหรือสถานะเปลี่ยน');
    void loadAccounts();
    setAdminRevision(value=>value+1);
  }

  return (
    <>
      <PageHeader title="จัดการระบบ" description="บัญชีทั้งหมดและเครื่องมือผู้ดูแล" badge="Admin" />
      <AdminWorkspace isDemo={isDemo} onShowToast={onShowToast} onChanged={()=>{void loadAccounts();setAdminRevision(value=>value+1);}} accounts={<div className="dashboard-grid admin-grid">
        <section className="panel admin-users-panel" id="admin-accounts">
          <div className="panel-heading">
            <div>
              <h2>บัญชีทั้งหมด</h2>
              <p className="muted">{isDemo ? 'ข้อมูลตัวอย่าง · อ่านได้อย่างเดียว' : 'ค้นหาชื่อหรืออีเมล · กรองสถานะ · แต่งตั้ง Manager จากบัญชีที่อนุมัติแล้ว'}</p>
            </div>
            <span className="panel-kicker">{isDemo ? 'ข้อมูลตัวอย่าง' : listState === 'ready' ? `${accounts.length} บัญชี · ${pendingCount} รอตรวจ` : 'กำลังอ่านบัญชี'}</span>
          </div>

          {isDemo && <div className="admin-feedback info"><ShieldCheck size={17} /><span>โหมดตัวอย่าง · รายการนี้ไม่ใช่บัญชีจริงและไม่สามารถบันทึกผลการตรวจสอบได้</span></div>}
          {!isDemo && successMessage && <div className="admin-feedback success" role="status"><BadgeCheck size={17} /><span>{successMessage}</span></div>}

          <div className={'account-toolbar ' + (isDemo ? 'demo-account-toolbar' : 'live-account-toolbar')}>
            <div className="account-filters" role="tablist" aria-label="กรองบัญชีผู้ใช้">{filters.map((item) => <button key={item} type="button" role="tab" aria-selected={filter === item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item} <span>{item === 'ทั้งหมด' ? accounts.length : accounts.filter((account) => account.status === item).length}</span></button>)}</div>
            <label className="search-field"><Search size={15} aria-hidden="true" /><input type="search" placeholder="ค้นหาชื่อ อีเมล หรือหน่วยงาน" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
            {!isDemo && <button className="button button-small button-outline" type="button" onClick={() => void loadAccounts()} disabled={listState === 'loading'}><RefreshCw size={14} />โหลดใหม่</button>}
          </div>

          {!isDemo && listState === 'loading' && <div className="admin-list-state" role="status"><LoaderCircle size={19} className="admin-spinner" />กำลังโหลดบัญชีจาก Supabase…</div>}
          {!isDemo && listState === 'error' && <div className="admin-feedback error" role="alert"><CircleAlert size={18} /><span>{listError}<button type="button" className="text-button" onClick={() => void loadAccounts()}>ลองอีกครั้ง</button></span></div>}
          {!isDemo && listState === 'ready' && accounts.length === 0 && <div className="admin-list-state"><BadgeCheck size={19} />ยังไม่มีบัญชีผู้ใช้</div>}

          {(isDemo || listState === 'ready') && (
            <div className="table-scroll">
              <table className="data-table account-table">
                <thead><tr><th>ชื่อ / อีเมล</th><th>บทบาทปัจจุบัน</th><th>สถานะบัญชี</th><th>สิทธิ์ขับ</th><th aria-label="การดำเนินการ" /></tr></thead>
                <tbody>{visibleAccounts.map((account) => (
                  <tr key={account.id}>
                    <td><strong>{account.fullName || 'ไม่ระบุชื่อ'}</strong><span className="table-subtext">{account.email || 'ไม่พบอีเมล'}</span></td>
                    <td>{account.role}</td>
                    <td><span className={'account-status ' + account.status.toLowerCase()}>{account.status}</span></td>
                    <td>{account.role === 'Admin' ? 'ไม่ใช่ผู้ขับ' : account.drivingPermission && account.status === 'Approved' ? 'เปิดแล้ว' : '—'}</td>
                    <td><button className="button button-small button-outline" type="button" onClick={() => selectAccount(account)}>{isDemo ? 'ดูตัวอย่าง' : account.status === 'Pending' ? 'ตรวจสอบ' : 'รายละเอียด'}</button></td>
                  </tr>
                ))}</tbody>
              </table>
              {visibleAccounts.length === 0 && accounts.length > 0 && <div className="empty-row">ไม่พบบัญชีที่ตรงกับการค้นหา/สถานะ</div>}
            </div>
          )}

          <dialog
            ref={reviewDialogRef}
            className="admin-review-dialog"
            aria-labelledby={selectedAccount ? 'admin-review-title' : undefined}
            onClose={() => setSelectedAccount(null)}
          >
            {selectedAccount && <div className="selected-account admin-review-dialog-content">
              <div className="selected-head">
                <div>
                  <span className="panel-kicker">{isDemo ? 'บัญชีตัวอย่าง · อ่านได้อย่างเดียว' : selectedAccount.status === 'Pending' ? 'กำลังตรวจสอบบัญชี Pending' : `บัญชี ${selectedAccount.status}`}</span>
                  <strong id="admin-review-title">{selectedAccount.fullName || 'ไม่ระบุชื่อ'}</strong>
                  <span>{selectedAccount.email || 'ไม่พบอีเมล'}</span>
                </div>
                <button type="button" className="text-button" aria-label="ปิดหน้าต่างตรวจสอบ" onClick={() => setSelectedAccount(null)}>ปิด</button>
              </div>
              <dl className="admin-account-details">
                <div><dt>เบอร์โทรศัพท์</dt><dd>{selectedAccount.phone || 'ไม่ระบุ'}</dd></div>
                <div><dt>หน่วยงาน</dt><dd>{selectedAccount.department || 'ไม่ระบุ'}</dd></div>
                <div><dt>{isDemo ? 'บทบาทตัวอย่าง' : 'ประเภทที่สมัคร'}</dt><dd>{selectedAccount.requestedRole}</dd></div>
                <div><dt>บทบาทปัจจุบัน</dt><dd>{selectedAccount.role}</dd></div>
                <div><dt>สถานะ</dt><dd>{selectedAccount.status}</dd></div>
                <div><dt>สิทธิ์ขับขี่</dt><dd>{selectedAccount.role === 'Admin' ? 'บัญชี Admin ไม่ใช้ขับรถ' : selectedAccount.drivingPermission && selectedAccount.status === 'Approved' ? 'เปิดแล้ว' : 'ไม่ได้รับสิทธิ์'}</dd></div>
                {selectedAccount.statusReason && <div><dt>เหตุผลสถานะ</dt><dd>{selectedAccount.statusReason}</dd></div>}
                <div><dt>วันที่สมัคร</dt><dd>{selectedAccount.createdAt ? new Date(selectedAccount.createdAt).toLocaleString('th-TH') : 'ไม่มีข้อมูล'}</dd></div>
              </dl>

              {!isDemo && selectedAccount.status === 'Pending' ? (
                <div className="admin-review-form">
                  <label className="admin-review-field"><span>บทบาทหลังตรวจสอบ</span><select value={verifiedRole} onChange={(event) => setVerifiedRole(event.target.value as ApplicantRole)} disabled={submitting}><option value="Student">นักศึกษา · Student</option><option value="Employee">บุคลากร · Employee</option></select></label>
                  <label className="admin-affiliation-check"><input type="checkbox" checked={affiliationVerified} onChange={(event) => setAffiliationVerified(event.target.checked)} disabled={submitting} /><span>ตรวจสอบความเกี่ยวข้องกับมหาวิทยาลัยแล้ว (ตรวจสอบนอกระบบ)</span></label>
                  <div className="admin-decision-options" role="group" aria-label="ผลการตรวจสอบ">
                    <button type="button" className={'button ' + (decision === 'Approved' ? 'button-primary' : 'button-outline')} onClick={() => { setDecision('Approved'); setReviewError(''); }} disabled={submitting}><UserRoundCheck size={15} />อนุมัติบัญชี</button>
                    <button type="button" className={'button ' + (decision === 'Rejected' ? 'button-danger' : 'button-outline')} onClick={() => { setDecision('Rejected'); setReviewError(''); }} disabled={submitting}><UserRoundX size={15} />ปฏิเสธบัญชี</button>
                  </div>
                  {decision === 'Rejected' && <label className="admin-review-field"><span>เหตุผลที่ปฏิเสธ <b>*</b></span><textarea value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} maxLength={1000} rows={3} disabled={submitting} placeholder="บันทึกเหตุผลสำหรับประวัติการตรวจสอบ" /></label>}
                  {reviewError && <div className="admin-feedback error" role="alert"><CircleAlert size={17} /><span>{reviewError}</span></div>}
                  {decision && <button className="button button-primary full-width" type="button" onClick={() => void submitReview()} disabled={submitting || !affiliationVerified || (decision === 'Rejected' && !rejectionReason.trim())}>{submitting ? <><LoaderCircle size={16} className="admin-spinner" />กำลังบันทึก…</> : decision === 'Approved' ? <><Check size={16} />ยืนยันอนุมัติ</> : <><UserRoundX size={16} />ยืนยันปฏิเสธ</>}</button>}
                  <p className="admin-driving-note"><ShieldCheck size={14} />การอนุมัติบัญชีไม่เปิดสิทธิ์ขับขี่</p>
                </div>
              ) : isDemo ? <div className="callout callout-info">บัญชีตัวอย่างนี้อ่านได้อย่างเดียว ไม่มีการเปลี่ยนสถานะจริง</div> : (
                <div className="admin-review-form">
                  <p className="muted">การแก้ชื่อ บทบาท หรือสถานะต้องบันทึกเหตุผลและ Audit Log · ไม่เปลี่ยนอีเมล</p>
                  <div className="button-row admin-account-action-choices">
                    <button className="button button-outline button-small" type="button" onClick={() => { setAccountAction('rename'); setActionValue(selectedAccount.fullName); setActionReason(''); setReviewError(''); }}>แก้ชื่อ</button>
                    {selectedAccount.status === 'Approved' && (selectedAccount.role === 'Student' || selectedAccount.role === 'Employee') && selectedAccount.id !== currentAdminId && <button className="button button-primary button-small" type="button" onClick={() => { setAccountAction('promote_manager'); setActionValue(''); setActionReason(''); setReviewError(''); }}>แต่งตั้ง Manager</button>}
                    {(selectedAccount.status === 'Approved' || selectedAccount.status === 'Suspended') && selectedAccount.id !== currentAdminId && <button className="button button-outline button-small" type="button" onClick={() => { setAccountAction('change_role'); setActionValue(selectedAccount.role); setActionReason(''); setReviewError(''); }}>เปลี่ยนบทบาท</button>}
                    {selectedAccount.status === 'Approved' && selectedAccount.id !== currentAdminId && <button className="button button-danger button-small" type="button" onClick={() => { setAccountAction('suspend'); setActionValue(''); setActionReason(''); setReviewError(''); }}>ระงับบัญชี</button>}
                    {selectedAccount.status === 'Suspended' && selectedAccount.id !== currentAdminId && <button className="button button-outline button-small" type="button" onClick={() => { setAccountAction('restore'); setActionValue(''); setActionReason(''); setReviewError(''); }}>คืนสถานะ Approved</button>}
                    {selectedAccount.status === 'Approved' && selectedAccount.role !== 'Admin' && !selectedAccount.drivingPermission && <button className="button button-outline button-small" type="button" onClick={() => { setAccountAction('grant_driving'); setActionValue(''); setActionReason(''); setInductionConfirmed(false); setReviewError(''); }}>ให้สิทธิ์ขับ</button>}
                    {selectedAccount.status === 'Approved' && selectedAccount.role !== 'Admin' && selectedAccount.drivingPermission && <button className="button button-outline button-small" type="button" onClick={() => { setAccountAction('revoke_driving'); setActionValue(''); setActionReason(''); setReviewError(''); }}>ปิดสิทธิ์ขับ</button>}
                  </div>
                  {selectedAccount.id === currentAdminId && <small className="muted">บัญชี Admin ปัจจุบันเปลี่ยนบทบาทหรือสถานะตนเองไม่ได้</small>}
                  {accountAction && <div className="admin-account-action-form">
                    <strong>{accountAction === 'rename' ? 'แก้ชื่อ–นามสกุล' : accountAction === 'promote_manager' ? 'แต่งตั้งเป็น Manager' : accountAction === 'change_role' ? 'เปลี่ยนบทบาท' : accountAction === 'suspend' ? 'ระงับบัญชี' : accountAction === 'restore' ? 'คืนสถานะบัญชี' : accountAction === 'grant_driving' ? 'ยืนยันการแนะนำและให้สิทธิ์ขับ' : 'ปิดสิทธิ์ขับ'}</strong>
                    {accountAction === 'rename' && <label className="admin-review-field"><span>ชื่อ–นามสกุลใหม่</span><input value={actionValue} onChange={(event) => setActionValue(event.target.value)} maxLength={80} disabled={submitting} /></label>}
                    {accountAction === 'promote_manager' && <p className="muted">เปลี่ยนบทบาทจาก {selectedAccount.role} เป็น Manager</p>}
                    {accountAction === 'change_role' && <label className="admin-review-field"><span>บทบาทใหม่</span><select value={actionValue} onChange={(event) => setActionValue(event.target.value)} disabled={submitting}>{roles.map((role) => <option value={role} key={role}>{role}</option>)}</select></label>}
                    {(accountAction === 'change_role' || accountAction === 'promote_manager' || accountAction === 'suspend' || accountAction === 'restore') && <p className="admin-driving-note"><ShieldCheck size={14} />การเปลี่ยนบทบาท/สถานะจะปิด Driving Permission; ต้องตรวจและเปิดใหม่แยกต่างหาก</p>}
                    {accountAction === 'grant_driving' && <label className="admin-affiliation-check"><input type="checkbox" checked={inductionConfirmed} onChange={(event) => setInductionConfirmed(event.target.checked)} disabled={submitting} /><span>ทีมงานตรวจและยืนยันแล้วว่าผู้ใช้นี้ผ่านการแนะนำ</span></label>}
                    <label className="admin-review-field"><span>เหตุผล <b>*</b></span><textarea value={actionReason} onChange={(event) => setActionReason(event.target.value)} rows={2} minLength={5} maxLength={1000} disabled={submitting} placeholder="ระบุเหตุผลอย่างน้อย 5 ตัวอักษร" /></label>
                    {reviewError && <div className="admin-feedback error" role="alert"><CircleAlert size={17} /><span>{reviewError}</span></div>}
                    <div className="button-row"><button className="button button-primary" type="button" disabled={submitting || actionReason.trim().length < 5 || (accountAction === 'rename' && actionValue.trim() === selectedAccount.fullName) || (accountAction === 'change_role' && actionValue === selectedAccount.role) || (accountAction === 'grant_driving' && !inductionConfirmed)} onClick={() => void submitAccountAction()}>{submitting ? 'กำลังบันทึก…' : 'ยืนยันและบันทึก Audit'}</button><button className="button button-outline" type="button" onClick={() => setAccountAction(null)} disabled={submitting}>ยกเลิก</button></div>
                  </div>}
                </div>
              )}
            </div>}
          </dialog>
        </section>

      </div>} settings={<AdminPortalPanels enhanced refreshKey={adminRevision} isDemo={isDemo} pendingAccountCount={!isDemo && listState === 'ready' ? pendingCount : null} onShowToast={onShowToast} />} />
    </>
  );
}
