import { BatteryMedium, Check, Clock3, MapPin, Pause, Play, ShieldAlert, Square } from 'lucide-react';
import CampusMap from '../components/CampusMap';
import PageHeader from '../components/PageHeader';
import type { SessionStatus } from '../types';

interface RidePageProps {
  status: SessionStatus;
  onPauseResume: () => void;
  onEnd: () => void;
  onShowToast: (message: string) => void;
}

export default function RidePage({ status, onPauseResume, onEnd, onShowToast }: RidePageProps) {
  const isActive = status === 'active';
  const isPaused = status === 'paused';
  return (
    <>
      <PageHeader title="ระหว่างใช้งาน" description="ติดตาม Session ปัจจุบันและข้อมูลสำหรับการคืนรถ" badge="Session จำลอง" />
      <div className="dashboard-grid ride-grid">
        <div className="main-column">
          <section className="panel ride-overview-panel">
            <div className="panel-heading ride-title-row"><div><h2>{isPaused ? 'พัก Session ชั่วคราว' : isActive ? 'กำลังใช้งานรถ' : 'ยังไม่มี Session ที่กำลังใช้งาน'}</h2><p className="muted">รถต้นแบบ EV-01 · ผู้ขับ นภัส</p></div><span className={`status-pill ${isPaused ? 'is-paused' : isActive ? 'is-active' : ''}`}><i />{isPaused ? 'Pause / Lock' : isActive ? 'Active Session' : 'ไม่มี Session'}</span></div>
            <CampusMap />
            <div className="callout callout-warning"><ShieldAlert size={17} /><p><strong>เตือนพื้นที่บริการ</strong><br />หากได้รับเสียงเตือนจากรถ โปรดตรวจสอบเส้นทางและกลับเข้าสู่พื้นที่ให้บริการ</p></div>
            <div className="callout callout-info nfc-resume-note"><Check size={17} /><p><strong>Resume ผ่าน NFC เมื่อออฟไลน์</strong><br />ใช้ได้เฉพาะกลับเข้า Session เดิมที่ถูกพักไว้เท่านั้น ไม่ใช้เริ่ม Session ใหม่ และต้องผ่านการตรวจความปลอดภัยกับระยะใกล้รถ โดย manifest สิทธิ์ล่าสุดต้องยังไม่หมดอายุ (ไม่เกิน 24 ชั่วโมง)</p></div>
            <div className="ride-actions"><span className="muted">เมื่อถึงจุดคืนรถ ให้ดำเนินการจบ Session</span><div className="button-group"><button className="button button-outline" type="button" onClick={onPauseResume} disabled={status === 'idle'}>{isActive ? <Pause size={16} /> : <Play size={16} />}{isPaused ? 'ทำงานต่อ · ตัวอย่าง' : 'พัก Session · ตัวอย่าง'}</button><button className="button button-danger" type="button" onClick={onEnd} disabled={status === 'idle'}><Square size={14} fill="currentColor" />คืนรถ / จบ Session</button></div></div>
          </section>
        </div>

        <aside className="side-column">
          <section className="panel session-time-panel"><h2>เวลาการใช้งาน</h2><div className="session-time">00:24:18</div><p className="muted">เริ่มเวลา 10:18 น. · ตัวอย่าง</p><div className="ride-metric-list"><div><Clock3 size={16} /><span>ระยะทาง</span><strong>3.8 กม.</strong></div><div><BatteryMedium size={16} /><span>แบตเตอรี่</span><strong>74%</strong></div><div><MapPin size={16} /><span>GPS ล่าสุด</span><strong>10:42:16</strong></div></div><div className="notice-box">เว็บแอปแสดงสถานะและข้อความเตือนเท่านั้น ไม่ควบคุมกำลังมอเตอร์</div>{status === 'idle' && <div className="empty-session"><p>เริ่ม Session จำลองจากหน้าภาพรวมเพื่อดูการทำงานของหน้านี้</p><button className="button button-primary" type="button" onClick={() => onShowToast('กลับไปหน้าภาพรวมเพื่อเริ่ม Session ตัวอย่าง')}>เข้าใจแล้ว</button></div>}</section>
          <section className="panel event-panel"><div className="panel-heading"><h2>เหตุการณ์ใน Session</h2></div><div className="event-list"><div className="event-item"><i className="event-dot good" /><div><strong>Session เริ่มต้นแล้ว</strong><time>10:18 น. · ตัวอย่าง</time></div></div><div className="event-item"><i className="event-dot good" /><div><strong>GPS รถทำงานปกติ</strong><time>10:39 น. · ตัวอย่าง</time></div></div><div className="event-item"><i className={`event-dot ${isPaused ? 'warn' : 'good'}`} /><div><strong>{isPaused ? 'Session อยู่ในสถานะ Pause' : 'พร้อมสำหรับการคืนรถเมื่อถึงจุดหมาย'}</strong><time>10:42 น. · ตัวอย่าง</time></div></div></div><div className="callout callout-info"><Check size={16} /><p>ข้อมูลตำแหน่งและเหตุการณ์เป็นข้อมูลจำลอง</p></div></section>
        </aside>
      </div>
    </>
  );
}
