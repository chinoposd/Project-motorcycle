import { useState } from 'react';
import { AlertTriangle, ShieldCheck } from 'lucide-react';

interface ProfileAccountActionsProps {
  isRealAccount?: boolean;
  canCloseAccount: boolean;
  onResetPassword: () => void | Promise<void>;
  onCloseAccount: () => boolean;
  onShowToast: (message: string) => void;
}

export default function ProfileAccountActions({ isRealAccount = false, canCloseAccount, onResetPassword, onCloseAccount, onShowToast }: ProfileAccountActionsProps) {
  const [confirmClose, setConfirmClose] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);

  async function handleResetPassword() {
    if (isSendingReset) return;
    setIsSendingReset(true);
    try {
      await onResetPassword();
    } finally {
      setIsSendingReset(false);
    }
  }

  return (
    <section className="panel profile-account-actions">
      <div className="manager-profile-section-heading">
        <span className="profile-section-icon"><ShieldCheck size={18} aria-hidden="true" /></span>
        <div><h2>ความปลอดภัยและบัญชี</h2><p>จัดการรหัสผ่านและสถานะบัญชีของคุณ</p></div>
      </div>
      <div className="profile-account-action-row">
        <div><strong>รีเซ็ตรหัสผ่าน</strong><p>{isRealAccount ? 'ส่งลิงก์รีเซ็ตไปยังอีเมลบัญชีผ่าน Supabase Auth' : 'บัญชีตัวอย่างไม่สามารถส่งอีเมลรีเซ็ตรหัสผ่านได้'}</p></div>
        <button className="button button-outline" type="button" disabled={!isRealAccount || isSendingReset} onClick={() => { void handleResetPassword(); }}>{isSendingReset ? 'กำลังส่ง…' : 'ส่งลิงก์รีเซ็ต'}</button>
      </div>
      <div className="profile-account-action-row profile-close-account-row">
        <div><strong>ปิดบัญชี</strong><p>{isRealAccount ? 'การปิดบัญชีจริงต้องติดต่อผู้ดูแลระบบเพื่อดำเนินการอย่างปลอดภัย' : 'ปิดบัญชีตัวอย่างแล้วจะเปิดกลับไม่ได้ และจะไม่ลบประวัติการใช้งาน'}</p></div>
        <button className="button button-danger" type="button" disabled={!canCloseAccount} onClick={() => setConfirmClose(true)}>ปิดบัญชี</button>
        {!canCloseAccount && !isRealAccount && <small className="profile-close-blocked">ต้องไม่มี Reservation, Pending Start, Active Session, Pending End หรือรายการซิงก์ค้างก่อน</small>}
      </div>
      {confirmClose && (
        <div className="profile-close-confirm" role="alertdialog" aria-modal="true" aria-labelledby="close-account-title" aria-describedby="close-account-description">
          <h3 id="close-account-title"><AlertTriangle size={17} aria-hidden="true" /> ยืนยันปิดบัญชี?</h3>
          <p id="close-account-description">บัญชีตัวอย่างนี้จะเข้าสู่สถานะปิดและไม่สามารถเข้าสู่ระบบได้อีก ประวัติเดิมจะไม่ถูกลบอัตโนมัติ</p>
          <div className="profile-close-confirm-actions">
            <button className="button button-outline" type="button" onClick={() => setConfirmClose(false)}>ยกเลิก</button>
            <button className="button button-danger" type="button" onClick={() => { if (onCloseAccount()) onShowToast('ปิดบัญชีตัวอย่างแล้ว · ประวัติเดิมไม่ได้ถูกลบ'); }}>ยืนยันปิดบัญชี</button>
          </div>
        </div>
      )}
    </section>
  );
}
