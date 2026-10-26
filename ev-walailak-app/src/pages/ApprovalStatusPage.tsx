import { LockKeyhole, LogOut, ShieldAlert } from 'lucide-react';
import type { AppUser } from '../auth/supabaseAuth';

interface ApprovalStatusPageProps {
  user: AppUser;
  onLogout: () => void;
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

export default function ApprovalStatusPage({ user, onLogout }: ApprovalStatusPageProps) {
  const status = user.accountStatus ?? 'Pending';
  const copy = statusCopy[status];

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
        <button className="account-status-logout" type="button" onClick={onLogout}>
          <LogOut size={16} aria-hidden="true" /> ออกจากระบบ
        </button>
        <p className="account-status-footnote">สถานะและสิทธิ์อ่านจากโปรไฟล์ในฐานข้อมูล · ไม่มีการแก้สิทธิ์จากเบราว์เซอร์</p>
      </section>
    </main>
  );
}
