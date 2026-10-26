import { useState } from 'react';
import { Check, ShieldCheck, X } from 'lucide-react';

const checks = ['ตรวจเบรกและคันเร่งในขั้นตอนสาธิต', 'ตรวจยางและไฟส่องสว่างในขั้นตอนสาธิต', 'สวมหมวกนิรภัยในขั้นตอนสาธิต'];

interface PreflightDialogProps {
  onCancel: () => void;
  onConfirm: () => void;
}

export default function PreflightDialog({ onCancel, onConfirm }: PreflightDialogProps) {
  const [completed, setCompleted] = useState<boolean[]>(checks.map(() => false));
  const allCompleted = completed.every(Boolean);
  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <section aria-labelledby="preflight-title" aria-modal="true" className="confirm-dialog" role="dialog">
        <button aria-label="ปิด" className="dialog-close" onClick={onCancel} type="button"><X size={18} /></button>
        <div className="dialog-icon"><ShieldCheck size={20} /></div>
        <h2 id="preflight-title">ตรวจความพร้อมก่อนเริ่ม</h2>
        <p>รถถูกสงวนไว้ชั่วคราวในข้อมูลตัวอย่าง · ยืนยันรายการจำลองเพื่อเริ่ม Session</p>
        <div className="preflight-checks">{checks.map((label, index) => <label className="checkbox-row" key={label}><input checked={completed[index]} onChange={(event) => setCompleted((current) => current.map((value, itemIndex) => itemIndex === index ? event.target.checked : value))} type="checkbox" /><span>{label}</span></label>)}</div>
        <div className="callout callout-warning"><ShieldCheck size={16} /><p>การติ๊กไม่ใช่การตรวจจากเซนเซอร์ และไม่มีการสั่ง Motor Ready หรือปลดล็อกรถจริง</p></div>
        <div className="dialog-actions"><button className="button button-outline" onClick={onCancel} type="button">กลับ</button><button className="button button-primary" disabled={!allCompleted} onClick={onConfirm} type="button"><Check size={15} />เริ่ม Session ตัวอย่าง</button></div>
      </section>
    </div>
  );
}
