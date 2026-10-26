import { useState, type FormEvent } from 'react';
import { ArrowLeft, BookOpen, Check, ClipboardList, FileClock, FileText, LifeBuoy, LockKeyhole, ShieldAlert, Wrench } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { userTrips, type PrototypeState } from '../data/prototypeState';
import type { UtilityView } from '../types';
import type { AppUser } from '../auth/supabaseAuth';

interface UtilityViewPageProps {
  view: UtilityView;
  user: AppUser;
  state: PrototypeState;
  onBack: () => void;
  onSubmitIssue: (input: { category: string; details: string; severity: 'high' | 'low' }) => void;
  onInspectIssue: (issueId: string, note: string, safeToClear: boolean) => void;
  onSubmitPrivacyRequest: (requestType: string, details: string) => void;
  onReviewPrivacyRequest: (requestId: string, state: 'reviewing' | 'completed') => void;
}

const content: Record<UtilityView, { title: string; description: string; icon: typeof LifeBuoy }> = {
  help: { title: 'ช่วยเหลือ', description: 'คำถามและช่องทางช่วยเหลือในระบบต้นแบบ', icon: LifeBuoy },
  guide: { title: 'คู่มือการใช้งาน', description: 'ขั้นตอนใช้งานและข้อควรทราบด้านความปลอดภัย', icon: BookOpen },
  announcements: { title: 'ประกาศ', description: 'ข่าวสารและแนวปฏิบัติของโครงการ', icon: ClipboardList },
  'trip-history': { title: 'ประวัติการใช้งาน', description: 'รายการ Session ของบัญชีนี้เท่านั้น', icon: FileClock },
  'issue-report': { title: 'รายงานปัญหารถ', description: 'ข้อมูลรายงานเป็นข้อมูลตัวอย่างในเบราว์เซอร์นี้', icon: ShieldAlert },
  inspection: { title: 'ตรวจสอบปัญหารถ', description: 'บันทึกผลตรวจตัวอย่าง · ไม่ได้ยืนยันการตรวจรถจริง', icon: Wrench },
  'audit-log': { title: 'Audit Log', description: 'ประวัติการเปลี่ยนแปลงภายในข้อมูลตัวอย่าง', icon: FileClock },
  'privacy-request': { title: 'คำขอใช้สิทธิข้อมูลส่วนบุคคล', description: 'ส่งคำขอตัวอย่าง · ไม่ได้ส่งไปยังหน่วยงานจริง', icon: LockKeyhole },
};

export default function UtilityViewPage({ view, user, state, onBack, onSubmitIssue, onInspectIssue, onSubmitPrivacyRequest, onReviewPrivacyRequest }: UtilityViewPageProps) {
  const [issueCategory, setIssueCategory] = useState('เบรก / ความปลอดภัยสูง');
  const [issueDetails, setIssueDetails] = useState('');
  const [issueSeverity, setIssueSeverity] = useState<'high' | 'low'>('high');
  const [privacyType, setPrivacyType] = useState('ขอสำเนาข้อมูล');
  const [privacyDetails, setPrivacyDetails] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [safeFlags, setSafeFlags] = useState<Record<string, boolean>>({});
  const { title, description, icon: Icon } = content[view];
  const trips = userTrips(state, user.id);

  function submitIssue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!issueDetails.trim()) return;
    onSubmitIssue({ category: issueCategory, details: issueDetails.trim(), severity: issueSeverity });
    setIssueDetails('');
  }

  function submitPrivacy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!privacyDetails.trim()) return;
    onSubmitPrivacyRequest(privacyType, privacyDetails.trim());
    setPrivacyDetails('');
  }

  return (
    <>
      <div className="utility-back-row"><button className="button button-outline" onClick={onBack} type="button"><ArrowLeft size={15} />กลับ</button></div>
      <PageHeader title={title} description={description} badge="ข้อมูลตัวอย่าง" />
      {view === 'help' && <section className="panel utility-panel"><div className="panel-heading"><div className="heading-with-icon"><Icon size={18} /><h2>หัวข้อช่วยเหลือ</h2></div></div><article className="utility-help-card"><strong>เริ่มใช้รถอย่างไร</strong><p>ไปที่หน้าภาพรวม เลือกเริ่ม Session ตัวอย่าง แล้วตรวจสอบรายการก่อนเริ่ม</p></article><article className="utility-help-card"><strong>หากพบปัญหารถ</strong><p>ใช้เมนูรายงานปัญหา หากเป็นเรื่องเบรกหรือความปลอดภัย ระบบตัวอย่างจะบล็อกการเริ่ม Session ใหม่ แต่ไม่หยุด Session ที่กำลังดำเนินอยู่</p></article><article className="utility-help-card"><strong>บัญชีจริงกับบัญชีตัวอย่าง</strong><p>บัญชีจริงยืนยันตัวตนผ่าน Supabase ส่วนข้อมูลรถและการทำงานในหน้านี้ยังเป็นการจำลองในเบราว์เซอร์</p></article></section>}
      {view === 'guide' && <section className="panel utility-panel"><div className="panel-heading"><div className="heading-with-icon"><Icon size={18} /><h2>ขั้นตอนใช้งาน</h2></div></div><ol className="utility-guide-list"><li><strong>ตรวจสิทธิ์และสถานะรถ</strong><span>บัญชีต้องได้รับอนุมัติและมี Driving Permission แยกกัน รถต้องเปิดให้บริการและไม่มี Safety Block</span></li><li><strong>สงวนรถและตรวจความพร้อม</strong><span>การจองตัวอย่างมีเวลา 5 นาที ยกเลิกได้ก่อนเริ่ม Session</span></li><li><strong>ใช้รถและพัก Session</strong><span>Pause และ Resume ใช้กับ Session เดิมเท่านั้น</span></li><li><strong>คืนรถในต้นแบบ</strong><span>พัก Session ก่อน แล้วทำเครื่องหมายยืนยันจุดคืนรถและรถหยุดนิ่งเพื่อบันทึกประวัติจำลอง</span></li></ol><div className="callout callout-warning"><ShieldAlert size={16} /><p>ไม่มีการควบคุมรถจริง, NFC, GPS หรือการยืนยัน Safety Block จากอุปกรณ์</p></div></section>}
      {view === 'announcements' && <section className="panel utility-panel"><div className="panel-heading"><div className="heading-with-icon"><Icon size={18} /><h2>ประกาศโครงการ</h2></div></div>{state.announcements.map((item) => <article className="utility-list-row" key={item.id}><FileText size={17} /><div><strong>{item.title}</strong><p>{item.detail}</p></div><time>{item.time}</time></article>)}</section>}
      {view === 'trip-history' && <section className="panel utility-panel"><div className="panel-heading"><div className="heading-with-icon"><Icon size={18} /><h2>ประวัติของฉัน</h2></div><span className="panel-kicker">{trips.length} Session</span></div>{trips.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>เริ่ม</th><th>สิ้นสุด</th><th>ระยะเวลา</th><th>ระยะทาง</th></tr></thead><tbody>{trips.map((trip) => <tr key={trip.sessionId}><td>{new Date(trip.startedAt).toLocaleString('th-TH')}</td><td>{new Date(trip.endedAt).toLocaleString('th-TH')}</td><td>{trip.durationMinutes} นาที</td><td>{trip.distanceKm === null ? 'ไม่มีข้อมูล' : `${trip.distanceKm.toFixed(1)} กม.`}</td></tr>)}</tbody></table></div> : <p className="empty-row">ยังไม่มีประวัติ Session</p>}</section>}
      {view === 'issue-report' && <section className="panel utility-panel"><div className="panel-heading"><div className="heading-with-icon"><Icon size={18} /><h2>แบบรายงานปัญหา</h2></div></div><form className="utility-form" onSubmit={submitIssue}><label>หัวข้อปัญหา<select value={issueCategory} onChange={(event) => setIssueCategory(event.target.value)}><option>เบรก / ความปลอดภัยสูง</option><option>ยางหรือช่วงล่าง</option><option>ระบบไฟ / แบตเตอรี่</option><option>อุปกรณ์อื่น</option></select></label><label>ระดับความเสี่ยง<select value={issueSeverity} onChange={(event) => setIssueSeverity(event.target.value as 'high' | 'low')}><option value="high">สูง · สร้าง Safety Block</option><option value="low">ทั่วไป · แจ้งเตือน</option></select></label><label>รายละเอียด<textarea required maxLength={500} rows={4} value={issueDetails} onChange={(event) => setIssueDetails(event.target.value)} placeholder="อธิบายสิ่งที่พบ" /></label><button className="button button-primary" type="submit">ส่งรายงานตัวอย่าง</button></form></section>}
      {view === 'inspection' && <section className="panel utility-panel"><div className="panel-heading"><div className="heading-with-icon"><Icon size={18} /><h2>รายการปัญหา</h2></div></div>{state.issues.length ? state.issues.map((issue) => <article className="inspection-card" key={issue.id}><div className="panel-heading"><div><strong>{issue.category}</strong><p className="muted">{issue.reporterName} · {new Date(issue.createdAt).toLocaleString('th-TH')}</p></div><span className={`severity-label ${issue.state === 'resolved' ? 'info' : issue.severity === 'high' ? 'high' : 'warning'}`}>{issue.state === 'resolved' ? 'ปิดแล้ว' : issue.state === 'inspected' ? 'ตรวจแล้ว · รอ Admin' : issue.severity === 'high' ? 'Safety Block' : 'แจ้งเตือน'}</span></div><p>{issue.details}</p>{issue.inspectionNote && <p className="inspection-note">ผลตรวจล่าสุด: {issue.inspectionNote}</p>}{issue.state !== 'resolved' && <div className="utility-form"><label>บันทึกผลตรวจ<textarea maxLength={500} rows={2} value={notes[issue.id] ?? ''} onChange={(event) => setNotes((current) => ({ ...current, [issue.id]: event.target.value }))} placeholder="ระบุผลและเหตุผล" /></label>{user.role === 'Admin' && <label className="checkbox-row"><input checked={Boolean(safeFlags[issue.id])} onChange={(event) => setSafeFlags((current) => ({ ...current, [issue.id]: event.target.checked }))} type="checkbox" />{issue.severity === 'high' ? 'ยืนยันความพร้อมในข้อมูลตัวอย่างเพื่อปลด Safety Block' : 'ยืนยันปิดรายการแจ้งเตือนตัวอย่าง'}</label>}<button className="button button-outline" disabled={!(notes[issue.id] ?? '').trim() || (user.role === 'Admin' && !safeFlags[issue.id])} onClick={() => { onInspectIssue(issue.id, notes[issue.id] ?? '', user.role === 'Admin' && Boolean(safeFlags[issue.id])); setNotes((current) => ({ ...current, [issue.id]: '' })); }} type="button"><Check size={15} />{user.role === 'Admin' ? issue.severity === 'high' ? 'บันทึกและปิด Block ตัวอย่าง' : 'บันทึกและปิดรายการตัวอย่าง' : 'บันทึกผลตรวจ'}</button></div>}</article>) : <p className="empty-row">ไม่มีรายการปัญหา</p>}<div className="callout callout-warning"><ShieldAlert size={16} /><p>การบันทึกเป็นข้อมูลจำลอง ไม่ใช่ผลตรวจรถจริง · Manager บันทึกผลตรวจได้ แต่ปลด Safety Block ไม่ได้</p></div></section>}
      {view === 'audit-log' && <section className="panel utility-panel"><div className="panel-heading"><div className="heading-with-icon"><Icon size={18} /><h2>รายการเปลี่ยนแปลง</h2></div></div>{state.auditLog.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>เวลา</th><th>ผู้ดำเนินการ</th><th>รายการ</th><th>เป้าหมาย / เหตุผล</th></tr></thead><tbody>{state.auditLog.map((item) => <tr key={item.id}><td>{new Date(item.createdAt).toLocaleString('th-TH')}</td><td>{item.actorName}</td><td>{item.action}</td><td>{item.target}{item.reason ? ` · ${item.reason}` : ''}</td></tr>)}</tbody></table></div> : <p className="empty-row">ยังไม่มี Audit Log</p>}{state.privacyRequests.length > 0 && <div className="utility-sublist"><h3>คำขอข้อมูลส่วนบุคคล</h3>{state.privacyRequests.map((request) => <p key={request.id}>{request.requesterName} · {request.requestType} · {request.details} · {request.state}</p>)}</div>}</section>}
      {view === 'privacy-request' && <section className="panel utility-panel"><div className="panel-heading"><div className="heading-with-icon"><Icon size={18} /><h2>{user.role === 'Admin' ? 'ตรวจคำขอในข้อมูลตัวอย่าง' : 'สร้างคำขอตัวอย่าง'}</h2></div></div>{user.role === 'Admin' ? state.privacyRequests.map((request) => <article className="utility-list-row" key={request.id}><FileText size={17} /><div><strong>{request.requesterName} · {request.requestType}</strong><p>{request.details}</p><small>{new Date(request.createdAt).toLocaleString('th-TH')}</small></div><div className="button-group">{request.state === 'submitted' && <button className="button button-outline" onClick={() => onReviewPrivacyRequest(request.id, 'reviewing')} type="button">รับเรื่อง</button>}{request.state !== 'completed' && <button className="button button-primary" onClick={() => onReviewPrivacyRequest(request.id, 'completed')} type="button">ดำเนินการเสร็จ</button>}<span className="account-status">{request.state}</span></div></article>) : <form className="utility-form" onSubmit={submitPrivacy}><label>ประเภทคำขอ<select value={privacyType} onChange={(event) => setPrivacyType(event.target.value)}><option>ขอสำเนาข้อมูล</option><option>ขอแก้ไขข้อมูล</option><option>ขอลบข้อมูล</option><option>สอบถามการใช้ข้อมูล</option></select></label><label>รายละเอียด<textarea required maxLength={500} rows={4} value={privacyDetails} onChange={(event) => setPrivacyDetails(event.target.value)} /></label><button className="button button-primary" type="submit">บันทึกคำขอตัวอย่าง</button></form>}{user.role === 'Admin' && state.privacyRequests.length === 0 && <p className="empty-row">ยังไม่มีคำขอ</p>}</section>}
    </>
  );
}
