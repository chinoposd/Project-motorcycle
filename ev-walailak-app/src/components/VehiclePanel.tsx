import { CirclePause, LockKeyhole, MapPin, Play, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { SessionStatus } from '../types';

interface VehiclePanelProps {
  status: SessionStatus;
  reserveExpiresAt?: string | null;
  locked?: boolean;
  onCancelReservation?: () => void;
  manager?: boolean;
  onStartPause: () => void;
  onLock: () => void;
}

export default function VehiclePanel({ status, reserveExpiresAt, locked = false, onCancelReservation, manager = false, onStartPause, onLock }: VehiclePanelProps) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (status !== 'reserved') return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [status]);
  const remainingSeconds = reserveExpiresAt ? Math.max(0, Math.ceil((Date.parse(reserveExpiresAt) - now) / 1000)) : 0;
  const remainingText = `${String(Math.floor(remainingSeconds / 60)).padStart(2, '0')}:${String(remainingSeconds % 60).padStart(2, '0')}`;
  const actionLabel = status === 'active' ? 'พัก Session ตัวอย่าง' : status === 'paused' ? 'ทำงานต่อใน Session เดิม' : status === 'reserved' ? 'ตรวจรายการก่อนเริ่ม Session' : 'สงวนรถและเริ่ม Session ตัวอย่าง';
  const statusText = status === 'active' ? 'กำลังใช้งาน' : status === 'paused' ? 'พักชั่วคราว' : status === 'reserved' ? 'สงวนรถ · รอตรวจ' : 'พร้อมให้บริการ';

  return (
    <section className="panel vehicle-panel">
      <div className="panel-heading vehicle-heading">
        <div><h2>{manager ? 'รถของฉัน · ใช้งานสำหรับ Manager' : 'รถของฉัน'}</h2><p className="muted">มหาวิทยาลัยวลัยลักษณ์ · รถต้นแบบไฟฟ้า</p></div>
        <span className={`status-pill ${status === 'active' ? 'is-active' : status === 'paused' ? 'is-paused' : status === 'reserved' ? 'is-paused' : ''}`}><i />{statusText}</span>
      </div>

      <div className="vehicle-stage">
        <div className="vehicle-copy"><strong>EV-01</strong><span>รถจักรยานยนต์ไฟฟ้าต้นแบบ</span></div>
        <img src="/assets/ev-01-motorcycle.png" alt="รถจักรยานยนต์ไฟฟ้าต้นแบบ EV-01 สีขาว น้ำเงิน และกรมท่า" />
      </div>

      <div className="vehicle-metrics">
        <div className="battery-metric">
          <div className="battery-glyph" aria-hidden="true"><i style={{ width: '74%' }} /></div>
          <div><span>แบตเตอรี่</span><strong>74%</strong></div>
        </div>
        <div className="gps-metric">
          <MapPin size={20} aria-hidden="true" />
          <div><span>GPS รถ</span><strong>พร้อมใช้งาน</strong></div>
        </div>
        <div className="range-metric"><Zap size={19} aria-hidden="true" /><div><span>ระยะทางโดยประมาณ</span><strong>58 กม.</strong></div></div>
      </div>

      <div className="vehicle-actions">
        <button type="button" className="vehicle-action primary" onClick={onStartPause} aria-label={actionLabel} disabled={status === 'paused' && locked} title={status === 'paused' && locked ? 'ปลดล็อก Session ก่อนทำงานต่อ' : undefined}>
          {status === 'active' ? <CirclePause size={21} /> : <Play size={20} fill="currentColor" />}
          <span>{status === 'active' ? 'พัก' : status === 'paused' ? 'ทำงานต่อ' : status === 'reserved' ? 'ตรวจรถต่อ' : 'เริ่ม'}</span>
        </button>
        <button type="button" className="vehicle-action" onClick={onLock} disabled={status !== 'paused'} title={status !== 'paused' ? 'ใช้ได้เมื่อพัก Session แล้ว' : 'เปลี่ยนสถานะล็อกในต้นแบบ'}>
          <LockKeyhole size={21} /><span>{locked ? 'ปลดล็อก' : 'ล็อก'}</span>
        </button>
        <span className="vehicle-action-note">ปุ่มนี้สาธิตการเปลี่ยนหน้าจอเท่านั้น ไม่มีคำสั่งส่งถึงรถจริง</span>
      </div>
      {status === 'paused' && <p className="vehicle-lock-status" role="status">สถานะล็อกตัวอย่าง: {locked ? 'ล็อกอยู่' : 'ปลดล็อกอยู่'} · ไม่ได้ส่งคำสั่งไปยังรถจริง</p>}
      {status === 'reserved' && <div className="reservation-note"><strong>สงวนรถตัวอย่าง · เหลือ {remainingText}</strong><span>ยังไม่เริ่ม Session · ยกเลิกได้ก่อนครบเวลา</span><button className="text-button" type="button" onClick={onCancelReservation}>ยกเลิกการสงวน</button></div>}
      {manager && <div className="manager-access-note">Manager เริ่มใช้งานได้โดยไม่จำกัดช่วงเวลาตามตาราง ทั้งนี้ยังต้องผ่านเงื่อนไขความปลอดภัยครบถ้วน</div>}
    </section>
  );
}
