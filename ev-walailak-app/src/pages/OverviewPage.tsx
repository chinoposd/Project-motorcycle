import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, BookOpen, Check, ClipboardList, Clock3, FileText, ShieldCheck } from 'lucide-react';
import CampusMap from '../components/CampusMap';
import PageHeader from '../components/PageHeader';
import VehiclePanel from '../components/VehiclePanel';
import { hasActiveSafetyBlock, isPrototypeVehicleAvailable, userTrips, type PrototypeState } from '../data/prototypeState';
import type { DemoVehicleSession, SessionStatus, UtilityView } from '../types';
import type { AppUser } from '../auth/supabaseAuth';

interface OverviewPageProps {
  user: AppUser;
  prototypeState: PrototypeState;
  session: DemoVehicleSession | null;
  sessionStatus: SessionStatus;
  onStartPause: () => void;
  onCancelReservation: () => void;
  onLock: () => void;
  onOpenUtility: (view: UtilityView) => void;
}

export default function OverviewPage({ user, prototypeState, session, sessionStatus, onStartPause, onCancelReservation, onLock, onOpenUtility }: OverviewPageProps) {
  const trips = userTrips(prototypeState, user.id);
  const approved = user.authSource === 'demo' || user.accountStatus === 'Approved';
  const permitted = user.authSource === 'demo' ? ['Student', 'Employee', 'Manager'].includes(user.role) : user.drivingPermission === true;
  const vehicleAvailable = isPrototypeVehicleAvailable(prototypeState);
  const accessLabel = approved && permitted ? 'ขอใช้รถได้' : !approved ? 'รออนุมัติบัญชี' : 'ยังไม่มี Driving Permission';
  return (
    <>
      <PageHeader title="ภาพรวม" description="ตรวจสอบสถานะรถ สิทธิ์การใช้งาน และข้อมูลล่าสุดของคุณ" badge="ข้อมูลตัวอย่าง" />
      <div className="dashboard-grid home-grid">
        <div className="main-column">
            <VehiclePanel status={sessionStatus} reserveExpiresAt={session?.reserveExpiresAt} locked={session?.locked} onCancelReservation={onCancelReservation} onStartPause={onStartPause} onLock={onLock} />
          <CampusMap />
          <section className="panel history-panel">
            <div className="panel-heading"><div className="heading-with-icon"><Clock3 size={17} aria-hidden="true" /><h2>ประวัติการใช้งานล่าสุด</h2></div><button className="text-button" type="button" onClick={() => onOpenUtility('trip-history')}>ดูทั้งหมด <ArrowRight size={14} /></button></div>
            <div className="table-scroll"><table className="data-table"><thead><tr><th>วันที่ / เวลา</th><th>ผู้ใช้งาน</th><th>ระยะเวลา</th><th>ระยะทาง</th><th>สถานะ</th></tr></thead><tbody>{trips.slice(0, 5).map((entry) => <tr key={entry.sessionId}><td>{new Date(entry.endedAt).toLocaleString('th-TH')}</td><td>{entry.driverName}</td><td>{entry.durationMinutes} นาที</td><td>{entry.distanceKm === null ? '—' : `${entry.distanceKm.toFixed(1)} กม.`}</td><td><span className="table-status"><Check size={12} />จบแล้ว</span></td></tr>)}</tbody></table>{trips.length === 0 && <div className="empty-row">ยังไม่มีประวัติการใช้งาน</div>}</div>
          </section>
        </div>

        <aside className="side-column">
          <section className="panel access-panel">
            <div className="panel-heading"><h2>ข้อมูลการใช้รถ</h2><span className="panel-kicker">บัญชีของคุณ</span></div>
            <div className={`access-status${approved && permitted && vehicleAvailable ? '' : ' access-status-limited'}`}><span className="access-check"><Check size={20} strokeWidth={2.5} /></span><div><strong>{accessLabel}</strong><p>อนุมัติบัญชีและ Driving Permission เป็นคนละสิทธิ์</p></div></div>
            {hasActiveSafetyBlock(prototypeState) && <p className="access-warning"><ShieldCheck size={15} />เริ่ม Session ใหม่ไม่ได้ · มี Safety Block ในข้อมูลตัวอย่าง</p>}
            {!prototypeState.service.serviceOpen || prototypeState.service.manualOutOfService ? <p className="access-warning">รถหยุดให้บริการในข้อมูลตัวอย่าง</p> : null}
            <div className="safety-guidance"><div className="heading-with-icon"><ShieldCheck size={18} /><h3>ก่อนเริ่มใช้งาน</h3></div><ul><li>สวมหมวกนิรภัยทุกครั้งก่อนขับขี่</li><li>ตรวจเบรก ยาง และแบตเตอรี่</li><li>ปฏิบัติตามกฎจราจรในมหาวิทยาลัย</li></ul><button type="button" className="button button-outline full-width" onClick={() => onOpenUtility('guide')}><BookOpen size={16} />อ่านคู่มือ</button><button type="button" className="button button-outline full-width" onClick={() => onOpenUtility('issue-report')}>รายงานปัญหารถ</button></div>
          </section>

          <section className="panel announcements-panel">
            <div className="panel-heading"><div className="heading-with-icon"><ClipboardList size={17} /><h2>ประกาศ</h2></div><button type="button" className="text-button" onClick={() => onOpenUtility('announcements')}>ดูทั้งหมด <ArrowRight size={14} /></button></div>
            <div className="announcement-list">{prototypeState.announcements.slice(0, 3).map((item) => <article className="announcement" key={item.id}><span className="announcement-icon"><FileText size={15} /></span><div><div className="announcement-title-row"><h3>{item.title}</h3><time>{item.time}</time></div><p>{item.detail}</p></div></article>)}</div>
          </section>

          <div className="callout callout-info"><AlertTriangle size={16} /><p>ตำแหน่งบนแผนที่และสถานะรถในหน้านี้เป็นข้อมูลตัวอย่าง</p></div>
        </aside>
      </div>
    </>
  );
}
