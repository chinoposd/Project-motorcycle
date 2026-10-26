import { useState } from 'react';
import { Activity, AlertTriangle, BatteryMedium, Check, Phone, ShieldAlert, ShieldCheck, Wrench } from 'lucide-react';
import CampusMap from '../components/CampusMap';
import PageHeader from '../components/PageHeader';
import SessionWorkflow from '../components/SessionWorkflow';
import VehiclePanel from '../components/VehiclePanel';
import { systemHealth } from '../data/mockData';
import type { AlertRecord, DemoTripRecord, DemoVehicleSession, ManagerView, SessionStatus, UtilityView, VehicleIssueRecord } from '../types';

interface ManagerPageProps {
  view: ManagerView;
  onViewChange: (view: ManagerView) => void;
  alerts: AlertRecord[];
  issues: VehicleIssueRecord[];
  trips: DemoTripRecord[];
  monitoredSession: DemoVehicleSession | null;
  ownSession: DemoVehicleSession | null;
  onAcknowledge: (id: string) => void;
  sessionStatus: SessionStatus;
  onStartPause: () => void;
  onCancelReservation: () => void;
  onEnd: () => void;
  onLock: () => void;
  onOpenUtility: (view: UtilityView) => void;
  onShowToast: (message: string) => void;
}

function bangkokDateInput(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export default function ManagerPage({ view, onViewChange, alerts, issues, trips, monitoredSession, ownSession, onAcknowledge, sessionStatus, onStartPause, onCancelReservation, onEnd, onLock, onOpenUtility, onShowToast }: ManagerPageProps) {
  const [alertFilter, setAlertFilter] = useState<'unread' | 'all'>('unread');
  const [reportDate, setReportDate] = useState(() => bangkokDateInput(new Date()));
  const unreadCount = alerts.filter((item) => item.state === 'unread').length;
  const visibleAlerts = alerts.filter((item) => alertFilter === 'all' || item.state === 'unread');
  const selectedDateTrips = trips.filter((trip) => bangkokDateInput(new Date(trip.endedAt)) === reportDate);
  const dailyMinutes = selectedDateTrips.reduce((total, trip) => total + trip.durationMinutes, 0);
  const dailyDistance = selectedDateTrips.reduce((total, trip) => total + (trip.distanceKm ?? 0), 0);
  const dailyUsers = new Set(selectedDateTrips.map((trip) => trip.userId)).size;

  return (
    <>
      <PageHeader title={view === 'overview' ? 'ภาพรวมการปฏิบัติงาน' : 'ขับขี่รถ'} description={view === 'overview' ? 'ติดตามรถ Session การแจ้งเตือน และสุขภาพระบบ' : 'หน้าสำหรับ Manager ใช้งานรถต้นแบบ EV-01'} badge="Manager" />
      <div className="view-switch" role="tablist" aria-label="เมนู Manager">
        <button type="button" role="tab" aria-selected={view === 'overview'} className={view === 'overview' ? 'active' : ''} onClick={() => onViewChange('overview')}>ภาพรวม</button>
        <button type="button" role="tab" aria-selected={view === 'ride'} className={view === 'ride' ? 'active' : ''} onClick={() => onViewChange('ride')}>ขับขี่รถ</button>
      </div>

      {view === 'ride' ? (
        <div className="dashboard-grid ride-grid manager-ride-grid">
          <div className="main-column"><VehiclePanel status={sessionStatus} reserveExpiresAt={ownSession?.reserveExpiresAt} locked={ownSession?.locked} onCancelReservation={onCancelReservation} manager onStartPause={onStartPause} onLock={onLock} /><CampusMap /></div>
          <aside className="side-column">
            <section className="panel manager-session-card"><div className="panel-heading"><h2>Session ของ Manager</h2><span className={`status-pill ${sessionStatus === 'active' ? 'is-active' : sessionStatus === 'paused' || sessionStatus === 'reserved' ? 'is-paused' : ''}`}><i />{sessionStatus === 'active' ? 'กำลังใช้งาน' : sessionStatus === 'paused' ? 'พักชั่วคราว' : sessionStatus === 'reserved' ? 'สงวนรถ' : 'ยังไม่เริ่ม'}</span></div><div className="session-detail-list"><div><span>ผู้ขับ</span><strong>{ownSession?.driverName ?? 'ผู้จัดการระบบ'}</strong></div><div><span>เริ่มเมื่อ</span><strong>{ownSession ? new Date(ownSession.startedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.' : '—'}</strong></div><div><span>ระยะเวลา</span><strong>{ownSession && sessionStatus !== 'reserved' ? Math.max(0, Math.floor((Date.now() - Date.parse(ownSession.startedAt)) / 60000)) + ' นาที' : '—'}</strong></div><div><span>ตำแหน่งล่าสุด</span><strong>{ownSession ? new Date(ownSession.lastPositionAt).toLocaleTimeString('th-TH') : 'ไม่มีข้อมูล'}</strong></div></div><div className="button-row"><button className="button button-outline" type="button" onClick={() => onOpenUtility('guide')}>คู่มือ</button>{sessionStatus !== 'idle' && sessionStatus !== 'reserved' && <button className="button button-danger" disabled={sessionStatus !== 'paused'} type="button" onClick={onEnd}>คืนรถ / จบ Session</button>}</div></section>
            <section className="panel"><h2>สถานะระบบรถ</h2><div className="manager-health-list">{systemHealth.map((item) => <div className="health-row" key={item.name}><span className={`health-indicator ${item.state}`} /><div><strong>{item.name}</strong><span>{item.detail}</span></div><em className={item.state}>{item.value}</em></div>)}</div></section>
            <div className="callout callout-info"><Activity size={16} /><p>หากข้อมูลรถขาดหรือเก่า ระบบจริงควรแสดงว่าไม่สามารถรับข้อมูลจากรถได้</p></div>
          </aside>
        </div>
      ) : (
        <>
          <div className="dashboard-grid manager-grid">
            <div className="main-column">
              <CampusMap manager />
              <section className="panel current-session-panel">
                <div className="panel-heading"><div className="heading-with-icon"><Activity size={17} /><h2>Session ปัจจุบัน</h2></div><span className={`status-pill ${monitoredSession ? 'is-active' : ''}`}><i />{monitoredSession ? 'กำลังใช้งาน' : 'ไม่มี Active Session'}</span></div>
                {!monitoredSession ? <div className="empty-row">ขณะนี้ไม่มี Active Session ให้ติดตาม</div> : <div className="session-detail-list horizontal"><div><span>ผู้ขับ</span><strong>{monitoredSession.driverName} · {monitoredSession.driverRole}</strong></div><div><span>เริ่มเมื่อ</span><strong>{new Date(monitoredSession.startedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.</strong></div><div><span>ระยะเวลา</span><strong>{Math.max(0, Math.floor((Date.now() - Date.parse(monitoredSession.startedAt)) / 60000))} นาที</strong></div><div><span>ตำแหน่งล่าสุด</span><strong>{new Date(monitoredSession.lastPositionAt).toLocaleTimeString('th-TH')}</strong></div>{monitoredSession.driverPhone && <a className="button button-outline" href={`tel:${monitoredSession.driverPhone}`}><Phone size={15} />โทรหาผู้ขับ</a>}</div>}
                <SessionWorkflow status={monitoredSession ? 'active' : 'idle'} />
              </section>
              <section className="panel health-panel"><div className="panel-heading"><div className="heading-with-icon"><Activity size={17} /><h2>สถานะระบบรถ</h2></div><span className="panel-kicker">อัปเดต 10:42:18</span></div><div className="health-grid">{systemHealth.map((item) => <div className="health-card" key={item.name}><div><strong>{item.name}</strong><span className={`health-value ${item.state}`}><i />{item.value}</span></div><p>{item.detail}</p></div>)}</div><div className="callout callout-info">ข้อมูลรถที่ขาดหรือเก่าควรแสดงเป็น “ไม่สามารถรับข้อมูลจากรถได้” แทนการแสดงค่าเดิมเสมือนเป็นข้อมูลสด</div></section>
              <section className="panel stats-panel"><div className="stats-header"><div><h2>สถิติรายวัน</h2><p className="muted">สรุปจากประวัติ Session ตัวอย่าง · ไม่แสดงชื่อผู้ใช้</p></div><label className="date-field"><span>วันที่</span><input type="date" value={reportDate} onChange={(event) => { setReportDate(event.target.value); onShowToast('เปลี่ยนวันที่สรุปแล้ว · ข้อมูลตัวอย่าง'); }} /></label></div><div className="daily-stats"><div><strong>{selectedDateTrips.length}</strong><span>จำนวน Session</span></div><div><strong>{Math.floor(dailyMinutes / 60)} ชม. {dailyMinutes % 60} นาที</strong><span>ระยะเวลารวม</span></div><div><strong>{dailyDistance.toFixed(1)} กม.</strong><span>ระยะทางรวม</span></div><div><strong>{dailyUsers}</strong><span>ผู้ใช้ไม่ซ้ำ</span></div></div></section>
            </div>

            <aside className="side-column">
              <section className="panel alert-center">
                <div className="panel-heading"><div className="heading-with-icon"><AlertTriangle size={17} /><h2>ศูนย์แจ้งเตือน</h2></div><span className="alert-count">{unreadCount} ใหม่</span></div>
                <div className="alert-tabs" role="tablist" aria-label="กรอง Alert"><button type="button" role="tab" aria-selected={alertFilter === 'unread'} className={alertFilter === 'unread' ? 'active' : ''} onClick={() => setAlertFilter('unread')}>ยังไม่รับทราบ</button><button type="button" role="tab" aria-selected={alertFilter === 'all'} className={alertFilter === 'all' ? 'active' : ''} onClick={() => setAlertFilter('all')}>ทั้งหมด</button></div>
                <div className="alert-list">{visibleAlerts.map((alert) => <article className={`alert-item ${alert.severity}${alert.state === 'acknowledged' ? ' acknowledged' : ''}`} key={alert.id}><div className="alert-topline"><span className={`severity-icon ${alert.severity}`}>{alert.severity === 'high' ? <ShieldAlert size={15} /> : alert.severity === 'warning' ? <AlertTriangle size={15} /> : <Check size={15} />}</span><div className="alert-copy"><div className="alert-title-row"><h3>{alert.title}</h3><span className={`severity-label ${alert.severity}`}>{alert.category}</span></div><p>{alert.description}</p><time>{alert.time} · ข้อมูลตัวอย่าง</time></div></div><div className="alert-footer">{alert.state === 'acknowledged' ? <span className="acknowledged-note">รับทราบแล้ว · เมื่อสักครู่</span> : <span className="acknowledged-note">บันทึกผลรับทราบแยกรายการ</span>}<button className="ack-button" type="button" disabled={alert.state === 'acknowledged'} onClick={() => onAcknowledge(alert.id)}>{alert.state === 'acknowledged' ? 'รับทราบแล้ว' : 'รับทราบ'}</button></div></article>)}</div>
                {visibleAlerts.length === 0 && <div className="empty-alerts"><Check size={18} /><p>ไม่มี Alert ที่รอการรับทราบ</p></div>}
              </section>

              <section className="panel issue-panel"><div className="panel-heading"><div className="heading-with-icon"><ShieldCheck size={17} /><h2>ปัญหาและ Safety Block</h2></div><span className="severity-label high">{issues.filter((issue) => issue.severity === 'high' && issue.state !== 'resolved').length} Block</span></div>{issues.slice(0, 4).map((issue) => <div className="issue-row" key={issue.id}><div><strong>{issue.category}</strong><span>{issue.reporterName} · {new Date(issue.createdAt).toLocaleTimeString('th-TH')}</span></div><span className={`severity-label ${issue.state === 'resolved' ? 'info' : issue.severity === 'high' ? 'high' : 'warning'}`}>{issue.state === 'resolved' ? 'ปิดแล้ว' : issue.state === 'inspected' ? 'ตรวจแล้ว' : issue.severity === 'high' ? 'รอตรวจ' : 'ตรวจสอบ'}</span></div>)}<button className="button button-outline full-width" type="button" onClick={() => onOpenUtility('inspection')}><Wrench size={15} />เปิดรายการตรวจสอบ</button><div className="callout callout-warning"><AlertTriangle size={16} /><p>Manager บันทึกผลตรวจในต้นแบบได้ แต่การยืนยันปลด Safety Block สงวนไว้สำหรับ Admin</p></div></section>
              <section className="permission-note"><div className="heading-with-icon"><ShieldAlert size={17} /><h2>ขอบเขตสิทธิ์ Manager</h2></div><p>ไม่มีสิทธิ์อนุมัติบัญชี ลงทะเบียน NFC เปลี่ยนบทบาท หรือสั่งเปิด/หยุดบริการรถด้วยตนเอง</p></section>
              <div className="tiny-note"><BatteryMedium size={14} />ข้อมูลสถานะทั้งหมดเป็นตัวอย่าง</div>
            </aside>
          </div>
        </>
      )}
    </>
  );
}

