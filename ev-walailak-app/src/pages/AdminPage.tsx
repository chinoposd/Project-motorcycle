import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Archive, BadgeCheck, Check, CircleAlert, FileClock, LoaderCircle, RefreshCw, Search, ShieldCheck, UserRoundCheck, UserRoundX } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { initialAccounts } from '../data/mockData';
import type { AdminAccount, ApplicantRole, ReviewDecision } from '../auth/adminAccountReview';
import { listPendingAdminAccounts, reviewPendingAdminAccount } from '../auth/adminAccountReview';
import type { AccountRecord, UserStatus } from '../types';

interface AdminPageProps {
  authSource: 'demo' | 'supabase';
}

type DisplayAccount = Omit<AdminAccount, 'requestedRole'> & { requestedRole: string; status: UserStatus };

const filters: ('ทั้งหมด' | UserStatus)[] = ['ทั้งหมด', 'Pending', 'Approved', 'Rejected', 'Suspended'];
const demoAccounts: DisplayAccount[] = initialAccounts.map((account: AccountRecord) => ({
  id: account.id,
  email: account.email,
  fullName: account.name,
  phone: '',
  department: '',
  requestedRole: account.role,
  createdAt: '',
  status: account.status,
}));

export default function AdminPage({ authSource }: AdminPageProps) {
  const isDemo = authSource === 'demo';
  const [pendingAccounts, setPendingAccounts] = useState<AdminAccount[]>([]);
  const [listState, setListState] = useState<'loading' | 'ready' | 'error'>(isDemo ? 'ready' : 'loading');
  const [listError, setListError] = useState('');
  const [filter, setFilter] = useState<(typeof filters)[number]>('ทั้งหมด');
  const [query, setQuery] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<DisplayAccount | null>(null);
  const [verifiedRole, setVerifiedRole] = useState<ApplicantRole>('Student');
  const [affiliationVerified, setAffiliationVerified] = useState(false);
  const [decision, setDecision] = useState<ReviewDecision | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const reviewDialogRef = useRef<HTMLDialogElement>(null);

  const loadPendingAccounts = useCallback(async () => {
    setListState('loading');
    setListError('');
    const result = await listPendingAdminAccounts();
    if (result.error !== null) {
      setPendingAccounts([]);
      setListState('error');
      setListError(result.error);
      return;
    }
    setPendingAccounts(result.data);
    setSelectedAccount((previous) => previous && !result.data.some((account) => account.id === previous.id)
      ? null
      : previous);
    setListState('ready');
  }, []);

  useEffect(() => {
    if (isDemo) {
      setPendingAccounts([]);
      setListState('ready');
      setListError('');
      return;
    }
    void loadPendingAccounts();
  }, [isDemo, loadPendingAccounts]);

  useEffect(() => {
    if (selectedAccount) return;
    setVerifiedRole('Student');
    setAffiliationVerified(false);
    setDecision(null);
    setRejectionReason('');
    setReviewError('');
  }, [selectedAccount]);

  useEffect(() => {
    const dialog = reviewDialogRef.current;
    if (!dialog) return;
    if (selectedAccount && !dialog.open) dialog.showModal();
    if (!selectedAccount && dialog.open) dialog.close();
  }, [selectedAccount]);

  const accounts = useMemo<DisplayAccount[]>(() => isDemo
    ? demoAccounts
    : pendingAccounts.map((account) => ({ ...account, status: 'Pending' })), [isDemo, pendingAccounts]);

  const visibleAccounts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('th');
    return accounts.filter((account) => (isDemo && filter !== 'ทั้งหมด' ? account.status === filter : true)
      && (!normalizedQuery
        || (account.fullName + ' ' + account.email + ' ' + account.phone + ' ' + account.department)
          .toLocaleLowerCase('th').includes(normalizedQuery)));
  }, [accounts, filter, isDemo, query]);

  function selectAccount(account: DisplayAccount) {
    setSelectedAccount(account);
    setVerifiedRole(account.requestedRole === 'Employee' ? 'Employee' : 'Student');
    setAffiliationVerified(false);
    setDecision(null);
    setRejectionReason('');
    setReviewError('');
    setSuccessMessage('');
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

    setPendingAccounts((previous) => previous.filter((account) => account.id !== result.data.accountId));
    setSelectedAccount(null);
    setSuccessMessage(result.data.status === 'Approved'
      ? 'อนุมัติบัญชีเป็น ' + result.data.role + ' แล้ว · สิทธิ์ขับขี่ยังคงสถานะเดิม'
      : 'ปฏิเสธบัญชีแล้ว · บันทึกเหตุผลการตรวจสอบเรียบร้อย');
    void loadPendingAccounts();
  }

  return (
    <>
      <PageHeader title="จัดการระบบ" description="ตรวจสอบและจัดการบัญชีผู้ใช้" badge="Admin" />
      <div className="dashboard-grid admin-grid">
        <section className="panel admin-users-panel">
          <div className="panel-heading">
            <div>
              <h2>จัดการบัญชีผู้ใช้</h2>
              <p className="muted">{isDemo ? 'ข้อมูลตัวอย่าง · อ่านได้อย่างเดียว' : 'ตรวจสอบบัญชีที่รออนุมัติทีละบัญชี'}</p>
            </div>
            <span className="panel-kicker">{isDemo ? 'ข้อมูลตัวอย่าง' : listState === 'ready' ? pendingAccounts.length + ' บัญชีรอตรวจ' : 'สถานะบัญชี'}</span>
          </div>

          {isDemo && <div className="admin-feedback info"><ShieldCheck size={17} /><span>โหมดตัวอย่าง · รายการนี้ไม่ใช่บัญชีจริงและไม่สามารถบันทึกผลการตรวจสอบได้</span></div>}
          {!isDemo && successMessage && <div className="admin-feedback success" role="status"><BadgeCheck size={17} /><span>{successMessage}</span></div>}

          <div className={'account-toolbar ' + (isDemo ? 'demo-account-toolbar' : 'live-account-toolbar')}>
            {isDemo && <div className="account-filters" role="tablist" aria-label="กรองบัญชีผู้ใช้">{filters.map((item) => <button key={item} type="button" role="tab" aria-selected={filter === item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item}</button>)}</div>}
            <label className="search-field"><Search size={15} aria-hidden="true" /><input type="search" placeholder="ค้นหาชื่อ อีเมล หรือหน่วยงาน" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
            {!isDemo && <button className="button button-small button-outline" type="button" onClick={() => void loadPendingAccounts()} disabled={listState === 'loading'}><RefreshCw size={14} />โหลดใหม่</button>}
          </div>

          {!isDemo && listState === 'loading' && <div className="admin-list-state" role="status"><LoaderCircle size={19} className="admin-spinner" />กำลังโหลดบัญชีจาก Supabase…</div>}
          {!isDemo && listState === 'error' && <div className="admin-feedback error" role="alert"><CircleAlert size={18} /><span>{listError}<button type="button" className="text-button" onClick={() => void loadPendingAccounts()}>ลองอีกครั้ง</button></span></div>}
          {!isDemo && listState === 'ready' && pendingAccounts.length === 0 && <div className="admin-list-state"><BadgeCheck size={19} />ไม่มีบัญชีที่รออนุมัติ</div>}

          {(isDemo || listState === 'ready') && (
            <div className="table-scroll">
              <table className="data-table account-table">
                <thead><tr><th>ชื่อ / อีเมล</th><th>{isDemo ? 'บทบาทตัวอย่าง' : 'บทบาทที่สมัคร'}</th><th>สถานะ</th><th aria-label="การดำเนินการ" /></tr></thead>
                <tbody>{visibleAccounts.map((account) => (
                  <tr key={account.id}>
                    <td><strong>{account.fullName || 'ไม่ระบุชื่อ'}</strong><span className="table-subtext">{account.email || 'ไม่พบอีเมล'}</span></td>
                    <td>{account.requestedRole}</td>
                    <td><span className={'account-status ' + account.status.toLowerCase()}>{account.status}</span></td>
                    <td><button className="button button-small button-outline" type="button" onClick={() => selectAccount(account)}>{isDemo ? 'ดูตัวอย่าง' : 'ตรวจสอบ'}</button></td>
                  </tr>
                ))}</tbody>
              </table>
              {visibleAccounts.length === 0 && (isDemo || pendingAccounts.length > 0) && <div className="empty-row">ไม่พบบัญชีที่ตรงกับการค้นหา</div>}
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
                  <span className="panel-kicker">{isDemo ? 'บัญชีตัวอย่าง · อ่านได้อย่างเดียว' : 'กำลังตรวจสอบบัญชี Pending'}</span>
                  <strong id="admin-review-title">{selectedAccount.fullName || 'ไม่ระบุชื่อ'}</strong>
                  <span>{selectedAccount.email || 'ไม่พบอีเมล'}</span>
                </div>
                <button type="button" className="text-button" aria-label="ปิดหน้าต่างตรวจสอบ" onClick={() => setSelectedAccount(null)}>ปิด</button>
              </div>
              <dl className="admin-account-details">
                <div><dt>เบอร์โทรศัพท์</dt><dd>{selectedAccount.phone || 'ไม่ระบุ'}</dd></div>
                <div><dt>หน่วยงาน</dt><dd>{selectedAccount.department || 'ไม่ระบุ'}</dd></div>
                <div><dt>{isDemo ? 'บทบาทตัวอย่าง' : 'ประเภทที่สมัคร'}</dt><dd>{selectedAccount.requestedRole}</dd></div>
                <div><dt>วันที่สมัคร</dt><dd>{selectedAccount.createdAt ? new Date(selectedAccount.createdAt).toLocaleString('th-TH') : 'ไม่มีข้อมูล'}</dd></div>
              </dl>

              {!isDemo ? (
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
              ) : <div className="callout callout-info">บัญชีตัวอย่างนี้อ่านได้อย่างเดียว ไม่มีการเปลี่ยนสถานะจริง</div>}
            </div>}
          </dialog>
        </section>

        <aside className="side-column">
          <section className="panel service-settings-panel">
            <div className="panel-heading"><div><div className="heading-with-icon"><ShieldCheck size={17} /><h2>เวลาขอเริ่ม Session</h2></div><p className="muted">Student / Employee · Manager ได้รับการยกเว้น</p></div><span className="panel-kicker">ยังไม่เชื่อมระบบจริง</span></div>
            <div className="callout callout-info">ส่วนนี้ยังไม่เชื่อมฐานข้อมูล · การบันทึกยังไม่พร้อมใช้งาน</div>
            <fieldset className="admin-disabled-fields" disabled>
              <div className="time-range"><label><span>เริ่มเวลา</span><input type="time" defaultValue="08:00" /></label><label><span>สิ้นสุดเวลา</span><input type="time" defaultValue="17:00" /></label></div>
              <label className="service-select"><span>สถานะการให้บริการ</span><select defaultValue="open"><option value="open">เปิดให้บริการ</option><option value="closed">หยุดให้บริการ</option></select></label>
              <button className="button button-primary full-width" type="button"><Check size={16} />บันทึกการตั้งค่า</button>
            </fieldset>
          </section>
          <section className="panel admin-tools-panel">
            <div className="panel-heading"><div className="heading-with-icon"><Archive size={17} /><h2>การดูแลระบบ</h2></div><span className="panel-kicker">ยังไม่พร้อมใช้งาน</span></div>
            <div className="callout callout-info">ประกาศ คำขอข้อมูลส่วนบุคคล และการเปิด Audit Log ยังไม่เชื่อมระบบจริง</div>
            <fieldset className="admin-disabled-fields" disabled>
              <button className="button button-outline full-width" type="button">หยุดให้บริการชั่วคราว</button>
              <button className="button button-outline full-width" type="button"><FileClock size={15} />ดู Audit Log</button>
              <div className="admin-links"><button type="button">ประกาศโครงการ</button><button type="button">คำขอใช้สิทธิข้อมูลส่วนบุคคล</button></div>
            </fieldset>
          </section>
          <div className="permission-note"><div className="heading-with-icon"><ShieldCheck size={17} /><h2>สิทธิ์ผู้ดูแลระบบ</h2></div><p>ตรวจสอบบัญชีได้ทีละคน และบันทึกผลในประวัติการตรวจสอบ การอนุมัติบัญชีไม่ใช่การอนุญาตให้ใช้รถ</p></div>
        </aside>
      </div>
    </>
  );
}
