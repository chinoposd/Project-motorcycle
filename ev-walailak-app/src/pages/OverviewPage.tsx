import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, BookOpen, Check, ClipboardList, Clock3, FileText, ShieldCheck } from 'lucide-react';
import CampusMap from '../components/CampusMap';
import PageHeader from '../components/PageHeader';
import VehiclePanel from '../components/VehiclePanel';
import { announcements, sessionHistory } from '../data/mockData';
import type { SessionStatus } from '../types';
import { loadPublishedAnnouncements, type PublishedAnnouncement } from '../auth/adminPortal';

interface OverviewPageProps {
  sessionStatus: SessionStatus;
  onStartPause: () => void;
  onLock: () => void;
  onShowToast: (message: string) => void;
  authSource: 'demo' | 'supabase';
}

export default function OverviewPage({ sessionStatus, onStartPause, onLock, onShowToast, authSource }: OverviewPageProps) {
  const [liveAnnouncements, setLiveAnnouncements] = useState<PublishedAnnouncement[] | null>(null);
  const [announcementError, setAnnouncementError] = useState('');
  useEffect(() => {
    if (authSource !== 'supabase') return;
    void loadPublishedAnnouncements().then((result) => {
      if (result.error) setAnnouncementError(result.error);
      else { setAnnouncementError(''); setLiveAnnouncements(result.data); }
    });
  }, [authSource]);
  const visibleAnnouncements = authSource === 'supabase' ? liveAnnouncements ?? [] : announcements.map((item) => ({ id: item.id, title: item.title, body: item.detail, published_at: item.time }));
  return (
    <>
      <PageHeader title="ภาพรวม" description="ตรวจสอบสถานะรถ สิทธิ์การใช้งาน และข้อมูลล่าสุดของคุณ" badge="ข้อมูลตัวอย่าง" />
      <div className="dashboard-grid home-grid">
        <div className="main-column">
          <VehiclePanel status={sessionStatus} onStartPause={onStartPause} onLock={onLock} />
          <CampusMap />
          <section className="panel history-panel">
            <div className="panel-heading"><div className="heading-with-icon"><Clock3 size={17} aria-hidden="true" /><h2>ประวัติการใช้งานล่าสุด</h2></div><button className="text-button" type="button" onClick={() => onShowToast('แสดงประวัติการใช้งาน · ข้อมูลตัวอย่าง')}>ดูทั้งหมด <ArrowRight size={14} /></button></div>
            <div className="table-scroll"><table className="data-table"><thead><tr><th>วันที่ / เวลา</th><th>ผู้ใช้งาน</th><th>ระยะเวลา</th><th>ระยะทาง</th><th>สถานะ</th></tr></thead><tbody>{sessionHistory.map((entry) => <tr key={entry.date}><td>{entry.date}</td><td>{entry.user}</td><td>{entry.duration}</td><td>{entry.distance}</td><td><span className="table-status"><Check size={12} />{entry.status}</span></td></tr>)}</tbody></table></div>
          </section>
        </div>

        <aside className="side-column">
          <section className="panel access-panel">
            <div className="panel-heading"><h2>ข้อมูลการใช้รถ</h2><span className="panel-kicker">บัญชีของคุณ</span></div>
            <div className="access-status"><span className="access-check"><Check size={20} strokeWidth={2.5} /></span><div><strong>ขอใช้รถได้</strong><p>บัญชีได้รับอนุมัติและมีสิทธิ์ขับ</p></div></div>
            <div className="safety-guidance"><div className="heading-with-icon"><ShieldCheck size={18} /><h3>ก่อนเริ่มใช้งาน</h3></div><ul><li>สวมหมวกนิรภัยทุกครั้งก่อนขับขี่</li><li>ตรวจเบรก ยาง และแบตเตอรี่</li><li>ปฏิบัติตามกฎจราจรในมหาวิทยาลัย</li></ul><button type="button" className="button button-outline full-width" onClick={() => onShowToast('เปิดคู่มือการใช้งาน · ตัวอย่าง')}><BookOpen size={16} />อ่านคู่มือ</button></div>
          </section>

          <section className="panel announcements-panel">
            <div className="panel-heading"><div className="heading-with-icon"><ClipboardList size={17} /><h2>ประกาศ</h2></div><button type="button" className="text-button" onClick={() => onShowToast('เปิดประกาศทั้งหมด · ตัวอย่าง')}>ดูทั้งหมด <ArrowRight size={14} /></button></div>
            <div className="announcement-list">{visibleAnnouncements.map((item) => <article className="announcement" key={item.id}><span className="announcement-icon"><FileText size={15} /></span><div><div className="announcement-title-row"><h3>{item.title}</h3><time>{authSource === 'supabase' ? new Date(item.published_at).toLocaleDateString('th-TH') : item.published_at}</time></div><p>{item.body}</p></div></article>)}{announcementError ? <p className="muted">ยังโหลดประกาศไม่ได้: {announcementError}</p> : visibleAnnouncements.length === 0 && <p className="muted">{authSource === 'supabase' && liveAnnouncements === null ? 'กำลังโหลดประกาศ…' : 'ยังไม่มีประกาศที่เผยแพร่'}</p>}</div>
          </section>

          <div className="callout callout-info"><AlertTriangle size={16} /><p>ตำแหน่งบนแผนที่และสถานะรถในหน้านี้เป็นข้อมูลตัวอย่าง</p></div>
        </aside>
      </div>
    </>
  );
}
