import { useState } from 'react';
import { Check, MapPin, ShieldAlert, X } from 'lucide-react';

interface EndSessionDialogProps {
  onCancel: () => void;
  onConfirm: () => void;
}

export default function EndSessionDialog({ onCancel, onConfirm }: EndSessionDialogProps) {
  const [stationary, setStationary] = useState(false);
  const [returnZone, setReturnZone] = useState(false);
  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <section aria-labelledby="end-session-title" aria-modal="true" className="confirm-dialog" role="dialog">
        <button aria-label="ปิด" className="dialog-close" onClick={onCancel} type="button"><X size={18} /></button>
        <div className="dialog-icon"><MapPin size={20} /></div>
        <h2 id="end-session-title">ยืนยันคืนรถใน Session ตัวอย่าง</h2>
        <p>การจบ Session จะบันทึกประวัติการใช้งานในเบราว์เซอร์นี้เท่านั้น</p>
        <label className="checkbox-row"><input checked={stationary} onChange={(event) => setStationary(event.target.checked)} type="checkbox" /><span>ในการสาธิต ยืนยันว่ารถหยุดนิ่งแล้ว</span></label>
        <label className="checkbox-row"><input checked={returnZone} onChange={(event) => setReturnZone(event.target.checked)} type="checkbox" /><span>ในการสาธิต ยืนยันว่าถึงจุดคืนรถแล้ว</span></label>
        <div className="callout callout-warning"><ShieldAlert size={16} /><p>เว็บนี้ตรวจรถจริง, Return Zone หรือ Motor Ready ไม่ได้ และไม่ได้ส่งคำสั่งถึงรถ</p></div>
        <div className="dialog-actions"><button className="button button-outline" onClick={onCancel} type="button">กลับไปตรวจสอบ</button><button className="button button-primary" disabled={!stationary || !returnZone} onClick={onConfirm} type="button"><Check size={15} />จบ Session ตัวอย่าง</button></div>
      </section>
    </div>
  );
}
