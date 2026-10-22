import { useState } from 'react';
import { Activity, AlertTriangle, BatteryMedium, Check, Phone, ShieldAlert, ShieldCheck, Wrench } from 'lucide-react';
import CampusMap from '../components/CampusMap';
import PageHeader from '../components/PageHeader';
import VehiclePanel from '../components/VehiclePanel';
import { initialAlerts, systemHealth } from '../data/mockData';
import type { AlertRecord, ManagerView, SessionStatus } from '../types';

interface ManagerPageProps {
  view: ManagerView;
  onViewChange: (view: ManagerView) => void;
  alerts: AlertRecord[];
  onAcknowledge: (id: string) => void;
  sessionStatus: SessionStatus;
  onStartPause: () => void;
  onLock: () => void;
  onShowToast: (message: string) => void;
}

export default function ManagerPage({ view, onViewChange, alerts, onAcknowledge, sessionStatus, onStartPause, onLock, onShowToast }: ManagerPageProps) {
  const [alertFilter, setAlertFilter] = useState<'unread' | 'all'>('unread');
  const [reportDate, setReportDate] = useState('2026-10-22');
  const unreadCount = alerts.filter((item) => item.state === 'unread').length;
  const visibleAlerts = alerts.filter((item) => alertFilter === 'all' || item.state === 'unread');

  return (
    <>
      <PageHeader title={view === 'overview' ? 'ภาพรวมการปฏิบัติงาน' : 'ขับขี่รถ'} description={view === 'overview' ? 'ติดตามรถ Session การแจ้งเตือน และสุขภาพระบบ' : 'หน้าสำหรับ Manager ใช้งานรถต้นแบบ EV-01'} badge="Manager" />
      <div className="view-switch" role="tablist" aria-label="เมนู Manager">
        <button type="button" role="tab" aria-selected={view === 'overview'} className={view === 'overview' ? 'active' : ''} onClick={() => onViewChange('overview')}>ภาพรวม</button>
        <button type="button" role="tab" aria-selected={view === 'ride'} className={view === 'ride' ? 'active' : ''} onClick={() => onViewChange('ride')}>ขับขี่รถ</button>
      </div>

      {view === 'ride' ? (
        <div className="dashboard-grid ride-grid manager-ride-grid">
          <div className="main-column"><VehiclePanel status={sessionStatus} manager onStartPause={onStartPause} onLock={onLock} /><CampusMap /></div>
          <aside className="side-column">
            <section className="panel manager-session-card"><div className="panel-heading"><h2>Session ของ Manager</h2><span className={`status-pill ${sessionStatus === 'active' ? 'is-active' : sessionStatus === 'paused' ? 'is-paused' : ''}`}><i />{sessionStatus === 'active' ? 'กำลังใช้งาน' : sessionStatus === 'paused' ? 'พักชั่วคราว' : 'ยังไม่เริ่ม'}</span></div><div className="session-detail-list"><div><span>ผู้ขับ</span><strong>ผู้จัดการระบบ</strong></div><div><span>เริ่มเมื่อ</span><strong>{sessionStatus === 'idle' ? '—' : '10:18 น.'}</strong></div><div><span>ระยะเวลา</span><strong>{sessionStatus === 'idle' ? '—' : '00:24:18'}</strong></div><div><span>GPS ล่าสุด</span><strong>10:42:16</strong></div></div><div className="button-row"><button className="button button-outline full-width" type="button" onClick={() => onShowToast('โทรหาผู้ขับปัจจุบัน · ตัวอย่าง')}><Phone size={15} />โทรหาผู้ขับ</button></div></section>
            <section className="panel"><h2>สถานะระบบรถ</h2><div className="manager-health-list">{systemHealth.map((item) => <div className="health-row" key={item.name}><span className={`health-indicator ${item.state}`} /><div><strong>{item.name}</strong><span>{item.detail}</span></div><em className={item.state}>{item.value}</em></div>)}</div></section>
            <div className="callout callout-info"><Activity size={16} /><p>หากข้อมูลรถขาดหรือเก่า ระบบจริงควรแสดงว่าไม่สามารถรับข้อมูลจากรถได้</p></div>
          </aside>
        </div>
      ) : (
        <>
          <section className="manager-summary" aria-label="สรุปสถานะการปฏิบัติงาน">
            <div className="summary-item good"><span>การเชื่อมต่อรถ</span><strong>ออนไลน์</strong><small>ล่าสุด {initialAlerts[1].time.replace(' น.', '')}</small></div>
            <div className={`summary-item ${sessionStatus === 'active' ? 'good' : 'neutral'}`}><span>สถานะรถ</span><strong>{sessionStatus === 'active' ? 'กำลังใช้งาน' : sessionStatus === 'paused' ? 'พักชั่วคราว' : 'พร้อมให้บริการ'}</strong><small>{sessionStatus === 'active' ? 'Active Session' : 'ไม่มี Session ที่เปิดอยู่'}</small></div>
            <div className="summary-item good"><span>แบตเตอรี่</span><strong>74%</strong><small>สถานะปกติ</small></div>
            <div className="summary-item good"><span>ระบบ AI</span><strong>พร้อมใช้งาน</strong><small>ตรวจล่าสุด 10:42</small></div>
            <div className={`summary-item ${unreadCount ? 'warn' : 'good'}`}><span>ยังไม่รับทราบ</span><strong>{unreadCount} Alerts</strong><small>ศูนย์แจ้งเตือน</small></div>
          </section>

          <div className="dashboard-grid manager-grid">
            <div className="main-column">
              <CampusMap manager />
              <section className="panel current-session-panel">
                <div className="panel-heading"><div className="heading-with-icon"><Activity size={17} /><h2>Session ปัจจุบัน</h2></div><span className={`status-pill ${sessionStatus === 'active' ? 'is-active' : sessionStatus === 'paused' ? 'is-paused' : ''}`}><i />{sessionStatus === 'active' ? 'กำลังใช้งาน' : sessionStatus === 'paused' ? 'พักชั่วคราว' : 'ไม่มี Session'}</span></div>
                {sessionStatus === 'idle' ? <div className="empty-row">ขณะนี้ไม่มี Active Session</div> : <div className="session-detail-list horizontal"><div><span>ผู้ขับ</span><strong>นภัส · Student</strong></div><div><span>เริ่มเมื่อ</span><strong>10:18 น.</strong></div><div><span>ระยะเวลา</span><strong>00:24:18</strong></div><div><span>ตำแหน่งล่าสุด</span><strong>10:42:16</strong></div><button className="button button-outline" type="button" onClick={() => onShowToast('โทรหาผู้ขับปัจจุบัน · ตัวอย่าง')}><Phone size={15} />โทรหาผู้ขับ</button></div>}
              </section>
              <section className="panel health-panel"><div className="panel-heading"><div className="heading-with-icon"><Activity size={17} /><h2>สถานะระบบรถ</h2></div><span className="panel-kicker">อัปเดต 10:42:18</span></div><div className="health-grid">{systemHealth.map((item) => <div className="health-card" key={item.name}><div><strong>{item.name}</strong><span className={`health-value ${item.state}`}><i />{item.value}</span></div><p>{item.detail}</p></div>)}</div><div className="callout callout-info">ข้อมูลรถที่ขาดหรือเก่าควรแสดงเป็น “ไม่สามารถรับข้อมูลจากรถได้” แทนการแสดงค่าเดิมเสมือนเป็นข้อมูลสด</div></section>
              <section className="panel stats-panel"><div className="stats-header"><div><h2>สถิติรายวัน</h2><p className="muted">ดูบนเว็บไซต์เท่านั้น · ไม่มีการส่งออกไฟล์</p></div><label className="date-field"><span>วันที่</span><input type="date" value={reportDate} onChange={(event) => { setReportDate(event.target.value); onShowToast('เปลี่ยนวันที่รายงาน · ข้อมูลตัวอย่าง'); }} /></label></div><div className="daily-stats"><div><strong>12</strong><span>จำนวน Session</span></div><div><strong>3 ชม. 48 นาที</strong><span>ระยะเวลารวม</span></div><div><strong>46.2 กม.</strong><span>ระยะทางรวม</span></div><div><strong>9</strong><span>ผู้ใช้ไม่ซ้ำ</span></div></div></section>
            </div>

            <aside className="side-column">
              <section className="panel alert-center">
                <div className="panel-heading"><div className="heading-with-icon"><AlertTriangle size={17} /><h2>ศูนย์แจ้งเตือน</h2></div><span className="alert-count">{unreadCount} ใหม่</span></div>
                <div className="alert-tabs" role="tablist" aria-label="กรอง Alert"><button type="button" role="tab" aria-selected={alertFilter === 'unread'} className={alertFilter === 'unread' ? 'active' : ''} onClick={() => setAlertFilter('unread')}>ยังไม่รับทราบ</button><button type="button" role="tab" aria-selected={alertFilter === 'all'} className={alertFilter === 'all' ? 'active' : ''} onClick={() => setAlertFilter('all')}>ทั้งหมด</button></div>
                <div className="alert-list">{visibleAlerts.map((alert) => <article className={`alert-item ${alert.severity}${alert.state === 'acknowledged' ? ' acknowledged' : ''}`} key={alert.id}><div className="alert-topline"><span className={`severity-icon ${alert.severity}`}>{alert.severity === 'high' ? <ShieldAlert size={15} /> : alert.severity === 'warning' ? <AlertTriangle size={15} /> : <Check size={15} />}</span><div className="alert-copy"><div className="alert-title-row"><h3>{alert.title}</h3><span className={`severity-label ${alert.severity}`}>{alert.category}</span></div><p>{alert.description}</p><time>{alert.time} · ข้อมูลตัวอย่าง</time></div></div><div className="alert-footer">{alert.state === 'acknowledged' ? <span className="acknowledged-note">รับทราบแล้ว · เมื่อสักครู่</span> : <span className="acknowledged-note">บันทึกผลรับทราบแยกรายการ</span>}<button className="ack-button" type="button" disabled={alert.state === 'acknowledged'} onClick={() => onAcknowledge(alert.id)}>{alert.state === 'acknowledged' ? 'รับทราบแล้ว' : 'รับทราบ'}</button></div></article>)}</div>
                {visibleAlerts.length === 0 && <div className="empty-alerts"><Check size={18} /><p>ไม่มี Alert ที่รอการรับทราบ</p></div>}
              </section>

              <section className="panel issue-panel"><div className="panel-heading"><div className="heading-with-icon"><ShieldCheck size={17} /><h2>ปัญหาและ Safety Block</h2></div><span className="severity-label high">1 Block</span></div><div className="issue-row"><div><strong>เบรก / ความปลอดภัยสูง</strong><span>ผู้ใช้รายงาน · 10:41 น.</span></div><span className="severity-label high">รอตรวจ</span></div><div className="issue-row"><div><strong>ระบบเสียง</strong><span>ระบบตรวจพบ · 10:39 น.</span></div><span className="severity-label warning">ตรวจสอบ</span></div><button className="button button-outline full-width" type="button" onClick={() => onShowToast('เปิดรายการตรวจสอบรถ · ตัวอย่าง')}><Wrench size={15} />เปิดรายการตรวจสอบ</button><div className="callout callout-warning"><AlertTriangle size={16} /><p>Manager ดูรายงานและบันทึกผลตรวจได้ ส่วนการเปิดบริการขั้นสุดท้ายสงวนไว้สำหรับ Admin</p></div></section>
              <section className="permission-note"><div className="heading-with-icon"><ShieldAlert size={17} /><h2>ขอบเขตสิทธิ์ Manager</h2></div><p>ไม่มีสิทธิ์อนุมัติบัญชี ลงทะเบียน NFC เปลี่ยนบทบาท หรือสั่งเปิด/หยุดบริการรถด้วยตนเอง</p></section>
              <div className="tiny-note"><BatteryMedium size={14} />ข้อมูลสถานะทั้งหมดเป็นตัวอย่าง</div>
            </aside>
          </div>
        </>
      )}
    </>
  );
}
