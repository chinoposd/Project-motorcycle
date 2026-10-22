import { useMemo, useState } from 'react';
import { Archive, Check, FileClock, Search, ShieldCheck, UserRoundCheck, UserRoundX } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { initialAccounts } from '../data/mockData';
import type { AccountRecord, UserStatus } from '../types';

interface AdminPageProps {
  onShowToast: (message: string) => void;
}

const filters: ('ทั้งหมด' | UserStatus)[] = ['ทั้งหมด', 'Pending', 'Approved', 'Rejected', 'Suspended'];

export default function AdminPage({ onShowToast }: AdminPageProps) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [filter, setFilter] = useState<(typeof filters)[number]>('ทั้งหมด');
  const [query, setQuery] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<AccountRecord | null>(null);
  const [serviceOpen, setServiceOpen] = useState(true);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('17:00');

  const visibleAccounts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('th');
    return accounts.filter((account) => (filter === 'ทั้งหมด' || account.status === filter)
      && (!normalizedQuery || `${account.name} ${account.email}`.toLocaleLowerCase('th').includes(normalizedQuery)));
  }, [accounts, filter, query]);

  function updateAccountStatus(accountId: string, status: UserStatus) {
    setAccounts((previous) => previous.map((account) => account.id === accountId ? { ...account, status } : account));
    setSelectedAccount((previous) => previous?.id === accountId ? { ...previous, status } : previous);
    onShowToast(`เปลี่ยนสถานะบัญชีเป็น ${status} · ตัวอย่าง`);
  }

  return (
    <>
      <PageHeader title="จัดการระบบ" description="บัญชีผู้ใช้ · การให้บริการ · บันทึกการตรวจสอบ" badge="Admin" />
      <div className="dashboard-grid admin-grid">
        <section className="panel admin-users-panel">
          <div className="panel-heading"><div><h2>จัดการบัญชีผู้ใช้</h2><p className="muted">ตรวจสอบและดำเนินการทีละบัญชี</p></div><span className="panel-kicker">{accounts.length} รายการ · ตัวอย่าง</span></div>
          <div className="account-toolbar"><div className="account-filters" role="tablist" aria-label="กรองบัญชีผู้ใช้">{filters.map((item) => <button key={item} type="button" role="tab" aria-selected={filter === item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item}</button>)}</div><label className="search-field"><Search size={15} aria-hidden="true" /><input type="search" placeholder="ค้นหาชื่อหรืออีเมล" value={query} onChange={(event) => setQuery(event.target.value)} /></label></div>
          <div className="table-scroll"><table className="data-table account-table"><thead><tr><th>ชื่อ / อีเมล</th><th>บทบาท</th><th>สถานะ</th><th aria-label="การดำเนินการ" /></tr></thead><tbody>{visibleAccounts.map((account) => <tr key={account.id}><td><strong>{account.name}</strong><span className="table-subtext">{account.email}</span></td><td>{account.role}</td><td><span className={`account-status ${account.status.toLowerCase()}`}>{account.status}</span></td><td><button className="button button-small button-outline" type="button" onClick={() => setSelectedAccount(account)}>{account.status === 'Pending' ? 'ตรวจสอบ' : 'ดูบัญชี'}</button></td></tr>)}</tbody></table>{visibleAccounts.length === 0 && <div className="empty-row">ไม่พบบัญชีที่ตรงกับการค้นหา</div>}</div>
          {selectedAccount && <div className="selected-account"><div className="selected-head"><div><span className="panel-kicker">กำลังตรวจสอบบัญชี</span><strong>{selectedAccount.name}</strong><span>{selectedAccount.email} · {selectedAccount.role}</span></div><button type="button" className="text-button" onClick={() => setSelectedAccount(null)}>ปิด</button></div><div className="selected-actions"><button className="button button-primary" type="button" onClick={() => updateAccountStatus(selectedAccount.id, 'Approved')}><UserRoundCheck size={15} />อนุมัติ</button><button className="button button-danger" type="button" onClick={() => updateAccountStatus(selectedAccount.id, 'Rejected')}><UserRoundX size={15} />ปฏิเสธ</button><span>เหตุผลและผลการตรวจสอบควรบันทึกใน Audit Log</span></div></div>}
        </section>

        <aside className="side-column">
          <section className="panel service-settings-panel"><div className="panel-heading"><div><div className="heading-with-icon"><ShieldCheck size={17} /><h2>เวลาขอเริ่ม Session</h2></div><p className="muted">Student / Employee · Manager ได้รับการยกเว้น</p></div></div><div className="time-range"><label><span>เริ่มเวลา</span><input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></label><label><span>สิ้นสุดเวลา</span><input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} /></label></div><label className="service-select"><span>สถานะการให้บริการ</span><select value={serviceOpen ? 'open' : 'closed'} onChange={(event) => setServiceOpen(event.target.value === 'open')}><option value="open">เปิดให้บริการ</option><option value="closed">หยุดให้บริการ</option></select></label><button className="button button-primary full-width" type="button" onClick={() => onShowToast('บันทึกการตั้งค่า · ตัวอย่าง')}><Check size={16} />บันทึกการตั้งค่า</button><div className="callout callout-info">ค่าที่แสดงเป็นตัวอย่าง ต้องยืนยันตารางเวลาและนโยบายก่อนใช้งานจริง</div></section>
          <section className="panel admin-tools-panel"><div className="panel-heading"><div className="heading-with-icon"><Archive size={17} /><h2>การดูแลระบบ</h2></div></div><button className="button button-outline full-width" type="button" onClick={() => { setServiceOpen(false); onShowToast('หยุดให้บริการชั่วคราว · ตัวอย่าง'); }}>หยุดให้บริการชั่วคราว</button><button className="button button-outline full-width" type="button" onClick={() => onShowToast('เปิด Audit Log · ตัวอย่าง')}><FileClock size={15} />ดู Audit Log</button><div className="admin-links"><button type="button" onClick={() => onShowToast('จัดการประกาศ · ตัวอย่าง')}>ประกาศโครงการ</button><button type="button" onClick={() => onShowToast('คำขอข้อมูลส่วนบุคคล · ตัวอย่าง')}>คำขอใช้สิทธิข้อมูลส่วนบุคคล</button></div></section>
          <div className="permission-note"><div className="heading-with-icon"><ShieldCheck size={17} /><h2>สิทธิ์ผู้ดูแลระบบ</h2></div><p>การเปลี่ยนสถานะบัญชี เวลาให้บริการ และการยืนยันเปิดบริการ ต้องมีเหตุผลและ Audit Log ตามข้อกำหนด</p></div>
        </aside>
      </div>
    </>
  );
}
