import { BatteryMedium, BookOpen, Check, Clock3, LockKeyhole, MapPin, Pause, Play, ShieldAlert, Square } from 'lucide-react';
import { useEffect, useState } from 'react';
import CampusMap from '../components/CampusMap';
import PageHeader from '../components/PageHeader';
import type { DemoVehicleSession, SessionStatus, UtilityView } from '../types';

interface RidePageProps {
  status: SessionStatus;
  session: DemoVehicleSession | null;
  onPauseResume: () => void;
  onCancelReservation: () => void;
  onEnd: () => void;
  onOpenUtility: (view: UtilityView) => void;
  onLock: () => void;
  onReturnToOverview: () => void;
}

export default function RidePage({ status, session, onPauseResume, onCancelReservation, onEnd, onOpenUtility, onLock, onReturnToOverview }: RidePageProps) {
  const isActive = status === 'active';
  const isPaused = status === 'paused';
  const isReserved = status === 'reserved';
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const durationSeconds = session && !isReserved ? Math.max(0, Math.floor((now - Date.parse(session.startedAt)) / 1000)) : 0;
  const durationText = `${String(Math.floor(durationSeconds / 3600)).padStart(2, '0')}:${String(Math.floor((durationSeconds % 3600) / 60)).padStart(2, '0')}:${String(durationSeconds % 60).padStart(2, '0')}`;
  const reservationSeconds = session?.reserveExpiresAt ? Math.max(0, Math.ceil((Date.parse(session.reserveExpiresAt) - now) / 1000)) : 0;
  return (
    <>
      <PageHeader title="ระหว่างใช้งาน" description="ติดตาม Session ปัจจุบันและข้อมูลสำหรับการคืนรถ" badge="Session จำลอง" />
      <div className="dashboard-grid ride-grid">
        <div className="main-column">
          <section className="panel ride-overview-panel">
            <div className="panel-heading ride-title-row"><div><h2>{isReserved ? 'สงวนรถ · ตรวจความพร้อมก่อนเริ่ม' : isPaused ? 'พัก Session ชั่วคราว' : isActive ? 'กำลังใช้งานรถ' : 'ยังไม่มี Session ที่กำลังใช้งาน'}</h2><p className="muted">รถต้นแบบ EV-01 · ผู้ขับ {session?.driverName ?? '—'}</p></div><span className={`status-pill ${isPaused || isReserved ? 'is-paused' : isActive ? 'is-active' : ''}`}><i />{isReserved ? 'สงวนรถ' : isPaused ? 'พัก Session' : isActive ? 'Active Session' : 'ไม่มี Session'}</span></div>
            <CampusMap />
            <div className="callout callout-warning"><ShieldAlert size={17} /><p><strong>เตือนพื้นที่บริการ</strong><br />หากได้รับเสียงเตือนจากรถ โปรดตรวจสอบเส้นทางและกลับเข้าสู่พื้นที่ให้บริการ</p></div>
            <div className="callout callout-info nfc-resume-note"><Check size={17} /><p><strong>Resume ผ่าน NFC เมื่อออฟไลน์</strong><br />ใช้ได้เฉพาะกลับเข้า Session เดิมที่ถูกพักไว้เท่านั้น ไม่ใช้เริ่ม Session ใหม่ และต้องผ่านการตรวจความปลอดภัยกับระยะใกล้รถ โดย manifest สิทธิ์ล่าสุดต้องยังไม่หมดอายุ (ไม่เกิน 24 ชั่วโมง)</p></div>
            {isReserved && <div className="reservation-note"><strong>เหลือเวลาสงวน {String(Math.floor(reservationSeconds / 60)).padStart(2, '0')}:{String(reservationSeconds % 60).padStart(2, '0')}</strong><span>ตรวจรายการก่อนเริ่ม · หากหมดเวลาให้เริ่มสงวนใหม่</span></div>}
            <div className="ride-actions"><span className="muted">ข้อมูลบนเว็บเป็นต้นแบบในเบราว์เซอร์ · ไม่ควบคุมรถ</span><div className="button-group">{isReserved && <button className="button button-outline" type="button" onClick={onCancelReservation}>ยกเลิกการสงวน</button>}<button className="button button-outline" type="button" onClick={onPauseResume} disabled={status === 'idle' || (isPaused && Boolean(session?.locked))}>{isActive ? <Pause size={16} /> : <Play size={16} />}{isReserved ? 'ตรวจรถและเริ่ม' : isPaused ? session?.locked ? 'ปลดล็อกก่อนทำงานต่อ' : 'ทำงานต่อ · Session เดิม' : 'พัก Session · ตัวอย่าง'}</button>{isPaused && <button className="button button-outline" type="button" onClick={onLock}><LockKeyhole size={15} />{session?.locked ? 'ปลดล็อก' : 'ล็อก Session'}</button>}<button className="button button-danger" type="button" onClick={onEnd} disabled={status === 'idle' || isReserved || isActive}><Square size={14} fill="currentColor" />คืนรถ / จบ Session</button></div></div>
          </section>
        </div>

        <aside className="side-column">
          <section className="panel session-time-panel"><h2>เวลาการใช้งาน</h2><div className="session-time">{isReserved ? `${String(Math.floor(reservationSeconds / 60)).padStart(2, '0')}:${String(reservationSeconds % 60).padStart(2, '0')}` : session ? durationText : '00:00:00'}</div><p className="muted">{session ? `เริ่มเวลา ${new Date(session.startedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น. · ตัวอย่าง` : 'ยังไม่มี Session'}</p><div className="ride-metric-list"><div><Clock3 size={16} /><span>ระยะทาง</span><strong>{session ? `${session.distanceKm.toFixed(1)} กม.` : '—'}</strong></div><div><BatteryMedium size={16} /><span>แบตเตอรี่</span><strong>74%</strong></div><div><MapPin size={16} /><span>ตำแหน่งล่าสุด</span><strong>{session ? new Date(session.lastPositionAt).toLocaleTimeString('th-TH') : 'ไม่มีข้อมูล'}</strong></div></div><div className="notice-box">เว็บแอปแสดงข้อมูลจำลองเท่านั้น ไม่ควบคุมกำลังมอเตอร์หรือรับข้อมูลสดจากรถ</div>{isPaused && <div className="notice-box"><LockKeyhole size={15} /> สถานะล็อกตัวอย่าง: {session?.locked ? 'ล็อกอยู่' : 'ปลดล็อกอยู่'} · ไม่ได้สั่งล็อกรถจริง</div>}{status === 'idle' && <div className="empty-session"><p>เริ่มสงวนรถตัวอย่างจากหน้าภาพรวมเพื่อดูการทำงานของหน้านี้</p><button className="button button-outline" type="button" onClick={onReturnToOverview}>กลับหน้าภาพรวม</button></div>}<button className="button button-outline full-width" type="button" onClick={() => onOpenUtility('issue-report')}>รายงานปัญหารถ</button><button className="button button-outline full-width" type="button" onClick={() => onOpenUtility('guide')}><BookOpen size={15} />เปิดคู่มือ</button></section>
          <section className="panel event-panel"><div className="panel-heading"><h2>เหตุการณ์ใน Session</h2></div><div className="event-list"><div className="event-item"><i className={`event-dot ${session ? 'good' : 'warn'}`} /><div><strong>{isReserved ? 'สงวนรถตัวอย่างแล้ว' : session ? 'Session ตัวอย่างเริ่มต้นแล้ว' : 'ไม่มี Session ที่กำลังทำงาน'}</strong><time>{session ? new Date(session.startedAt).toLocaleTimeString('th-TH') : '—'} · ข้อมูลจำลอง</time></div></div>{session && <div className="event-item"><i className={`event-dot ${isPaused ? 'warn' : 'good'}`} /><div><strong>{isPaused ? 'Session อยู่ในสถานะพัก' : isReserved ? 'รอตรวจความพร้อมก่อนเริ่ม' : 'Session กำลังทำงาน'}</strong><time>{new Date(session.lastPositionAt).toLocaleTimeString('th-TH')} · ข้อมูลจำลอง</time></div></div>}</div><div className="callout callout-info"><Check size={16} /><p>ข้อมูลตำแหน่งและเหตุการณ์เป็นข้อมูลจำลอง</p></div></section>
        </aside>
      </div>
    </>
  );
}
