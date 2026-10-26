import { useState, type FormEvent } from 'react';
import { LockKeyhole, LogOut, ShieldAlert } from 'lucide-react';
import type { AppUser } from '../auth/supabaseAuth';
import {displayTime} from '../features/operations/client';
import type {MyOperations} from '../features/operations/types';

interface ApprovalStatusPageProps {
  user: AppUser;
  onLogout: () => void;
  operations?:MyOperations|null;
  operationsError?:string;
  operationsBusy?:boolean;
  onOperationsRun?:(action:string,payload:Record<string,unknown>)=>Promise<boolean>;
  onSessionAction?:(id:string,action:string)=>Promise<boolean>;
}

const statusCopy = {
  Pending: {
    title: 'บัญชีอยู่ระหว่างรออนุมัติ',
    description: 'ผู้ดูแลต้องตรวจสอบบัญชีก่อนจึงจะเข้าใช้งานระบบได้ การสมัครไม่ได้เปิดสิทธิ์ขับขี่ให้อัตโนมัติ',
  },
  Rejected: {
    title: 'บัญชียังไม่ได้รับการอนุมัติ',
    description: 'กรุณาติดต่อผู้ดูแลระบบเพื่อสอบถามผลการตรวจสอบบัญชี',
  },
  Suspended: {
    title: 'บัญชีถูกระงับการใช้งาน',
    description: 'บัญชีนี้ไม่สามารถเข้าใช้งานระบบได้ในขณะนี้ กรุณาติดต่อผู้ดูแลระบบ',
  },
  Approved: {
    title: 'บัญชีได้รับอนุมัติแล้ว',
    description: 'การอนุมัติบัญชีและสิทธิ์ขับขี่เป็นคนละรายการ',
  },
} as const;

export default function ApprovalStatusPage({ user, onLogout, operations, operationsError='', operationsBusy=false,onOperationsRun,onSessionAction }: ApprovalStatusPageProps) {
  const [details,setDetails]=useState('');
  const status = user.accountStatus ?? 'Pending';
  const copy = statusCopy[status];
  const openAppeal=operations?.appeals?.some(appeal=>appeal.status==='Pending')??false;
  async function submitAppeal(event:FormEvent<HTMLFormElement>){event.preventDefault();if(!onOperationsRun||!operations||openAppeal)return;const ok=await onOperationsRun('appeal',{details});if(ok)setDetails('');}

  return (
    <main className="account-status-screen">
      <section className="account-status-card" aria-labelledby="account-status-heading">
        <div className="account-status-icon"><ShieldAlert size={26} aria-hidden="true" /></div>
        <p className="account-status-kicker"><LockKeyhole size={14} aria-hidden="true" /> บัญชี Supabase · {status}</p>
        <h1 id="account-status-heading">{copy.title}</h1>
        <p className="account-status-description">{copy.description}</p>
        {(status === 'Rejected' || status === 'Suspended') && user.accountStatusReason &&
          <p className="account-status-description"><strong>เหตุผล:</strong> {user.accountStatusReason}</p>}
        <dl className="account-status-details">
          <div><dt>ชื่อ</dt><dd>{user.name}</dd></div>
          <div><dt>อีเมล</dt><dd>{user.email}</dd></div>
          <div><dt>ประเภทบัญชี</dt><dd>{user.role}</dd></div>
          <div><dt>สิทธิ์ขับขี่</dt><dd>{user.drivingPermission ? 'ได้รับอนุญาต' : 'ยังไม่ได้รับอนุญาต'}</dd></div>
        </dl>
        {status==='Pending'&&<p className="account-status-description">สถานะรถ: {operations?.vehicle_availability==='available'?'มีรถพร้อมให้ดูข้อมูล':operations?.vehicle_availability==='in_use'?'มีผู้ใช้งานอยู่':operations?'ยังไม่พร้อมหรือไม่มีข้อมูลยืนยัน':'กำลังตรวจสอบ'} · บัญชี Pending ยังดู GPS ไม่ได้</p>}
        {(status==='Rejected'||status==='Suspended')&&<section className="ops-panel"><h2>ขออุทธรณ์ผลบัญชี</h2><p>ระบุเหตุผลหรือหลักฐานเพิ่มเติมให้ Admin พิจารณา หากรับคำขอแล้วบัญชีจะกลับเป็น Pending เพื่อรอตรวจสอบใหม่</p>{operationsError&&<p role="alert" className="ops-warning">{operationsError}</p>}
          {operations?.appeals?.map(appeal=><article className="ops-record" key={appeal.id}><strong>{appeal.status} · {displayTime(appeal.created_at)}</strong><p>{appeal.details}</p>{appeal.decision_reason&&<p>ผลพิจารณา: {appeal.decision_reason}</p>}</article>)}
          <form className="ops-form" onSubmit={event=>{void submitAppeal(event)}}><fieldset disabled={!operations||operationsBusy||openAppeal}><label className="ops-field">เหตุผลและหลักฐานประกอบ<textarea required minLength={5} maxLength={2000} rows={4} value={details} onChange={event=>setDetails(event.target.value)}/></label><button type="submit" className="button button-primary">{openAppeal?'มีคำขอที่รอพิจารณา':'ส่งคำขออุทธรณ์'}</button></fieldset></form>{!operations&&<p className="muted">กำลังเชื่อมระบบคำขออุทธรณ์</p>}
          {operations?.project_phone&&<p>ติดต่อโครงการ <a href={`tel:${operations.project_phone.replace(/[^+\d]/g,'')}`}>{operations.project_phone}</a></p>}
        </section>}
        {status==='Suspended'&&operations?.session&&['Active','Paused','PendingEnd'].includes(operations.session.status)&&<section className="ops-panel"><h2>Session ที่ยังค้าง</h2><p>การระงับบัญชีไม่ตัดมอเตอร์ระหว่างขับ โปรดนำรถคืนตามขั้นตอนและขอจบ Session</p><button type="button" className="button button-outline" disabled={operationsBusy} onClick={()=>void onSessionAction?.(operations.session!.id,'end')}>ขอจบ Session</button></section>}
        <button className="account-status-logout" type="button" onClick={onLogout}>
          <LogOut size={16} aria-hidden="true" /> ออกจากระบบ
        </button>
        <p className="account-status-footnote">สถานะและสิทธิ์อ่านจากโปรไฟล์ในฐานข้อมูล · ไม่มีการแก้สิทธิ์จากเบราว์เซอร์</p>
      </section>
    </main>
  );
}
