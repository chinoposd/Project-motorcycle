import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bike,
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Flag,
  MapPin,
  Megaphone,
  Settings2,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import type { AppUser } from '../../auth/supabaseAuth';
import { loadPublishedAnnouncements, markAnnouncementSeen, type PublishedAnnouncement } from '../../auth/adminPortal';
import PageHeader from '../../components/PageHeader';
import OperationForm from './OperationForm';
import ZonePreview from './ZonePreview';
import { displayTime } from './client';
import type { MyOperations, UserNotice } from './types';
import VehicleLiveMap from './VehicleLiveMap';

interface Props {
  user: AppUser;
  data: MyOperations | null;
  loading: boolean;
  error: string;
  busy: boolean;
  view?: 'overview' | 'ride';
  onOpenRide?: () => void;
  onOpenOverview?: () => void;
  onRefresh: () => Promise<void>;
  onRun: (action: string, payload: Record<string, unknown>) => Promise<boolean>;
  onRequestSession: (inspection: boolean, terms: boolean, requestId: string) => Promise<boolean>;
  onSessionAction: (id: string, action: string) => Promise<boolean>;
}

const liveStatuses = new Set(['Active', 'Paused', 'PendingPause', 'PendingResume', 'PendingEnd', 'EndedPendingSync']);
const categories = [
  ['brakes', 'เบรก'], ['throttle', 'คันเร่ง'], ['battery', 'แบตเตอรี่'],
  ['gps', 'GPS'], ['nfc', 'NFC'], ['network', 'เครือข่าย'], ['other', 'อื่น ๆ'],
];

type FeedItem =
  | { id: string; type: 'announcement'; title: string; message: string; createdAt: string; source: PublishedAnnouncement }
  | { id: string; type: 'notice'; title: string; message: string; createdAt: string; source: UserNotice };

function vehicleAvailabilityLabel(data: MyOperations | null): string {
  if (!data) return 'กำลังตรวจสอบความพร้อม';
  return ({
    available: 'รถพร้อมรับคำขอ',
    in_use: 'รถกำลังมีผู้ใช้งาน',
    unavailable: 'รถยังไม่พร้อมให้บริการ',
    unknown: 'กำลังตรวจสอบความพร้อม',
  } as const)[data.vehicle_availability ?? 'unknown'];
}

function formatTripDuration(startedAt: string | null, endedAt: string | null): string {
  if (!startedAt || !endedAt) return '—';
  const milliseconds = Date.parse(endedAt) - Date.parse(startedAt);
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return '—';
  const totalMinutes = Math.max(1, Math.round(milliseconds / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  return hours ? `${hours} ชม. ${totalMinutes % 60} นาที` : `${totalMinutes} นาที`;
}

export default function LiveUserPage({
  user,
  data,
  loading,
  error,
  busy,
  view = 'overview',
  onOpenRide,
  onOpenOverview,
  onRefresh,
  onRun,
  onRequestSession,
  onSessionAction,
}: Props) {
  const [inspection, setInspection] = useState(false);
  const [terms, setTerms] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [locationError, setLocationError] = useState('');
  const [announcementFeed, setAnnouncementFeed] = useState<{ items: PublishedAnnouncement[]; loading: boolean; error: string }>({ items: [], loading: false, error: '' });
  const [markingAnnouncement, setMarkingAnnouncement] = useState<string | null>(null);
  const requestId = useRef<string | null>(null);
  const announcementRequest = useRef(0);

  const refreshAnnouncements = useCallback(async () => {
    if (user.authSource !== 'supabase') return;
    const currentRequest = ++announcementRequest.current;
    setAnnouncementFeed((current) => ({ ...current, loading: true, error: '' }));
    try {
      const result = await loadPublishedAnnouncements();
      if (currentRequest !== announcementRequest.current) return;
      setAnnouncementFeed({ items: result.data ?? [], loading: false, error: result.error ?? '' });
    } catch {
      if (currentRequest !== announcementRequest.current) return;
      setAnnouncementFeed((current) => ({ ...current, loading: false, error: 'โหลดประกาศไม่สำเร็จ · ลองใหม่อีกครั้ง' }));
    }
  }, [user.authSource, user.id]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (view !== 'overview' || user.authSource !== 'supabase') return;
    void refreshAnnouncements();
    return () => {
      announcementRequest.current += 1;
    };
  }, [refreshAnnouncements, user.authSource, view]);

  const session = data?.session;
  const pending = session?.status === 'Reserved' || session?.status === 'PendingStart';
  const available = data?.vehicle_availability === 'available';
  const accountStatus = data?.account.status ?? user.accountStatus;
  const drivingPermission = data?.account.driving_permission ?? user.drivingPermission === true;
  const accountApproved = accountStatus === 'Approved';
  const canRequest = !!data && !session && available && accountApproved && drivingPermission && !busy
    && Boolean(data.consent_versions?.privacy && data.consent_versions?.terms
      && data.consent_versions?.privacy_text && data.consent_versions?.terms_text);
  const seconds = session?.status === 'Reserved' ? Math.max(0, Math.ceil((Date.parse(session.expires_at) - now) / 1000)) : null;
  const phone = data?.project_phone?.replace(/[^+\d]/g, '') ?? '';

  const feedItems: FeedItem[] = [
    ...announcementFeed.items.map((announcement): FeedItem => ({
      id: `announcement-${announcement.id}`,
      type: 'announcement',
      title: announcement.title,
      message: announcement.body,
      createdAt: announcement.published_at,
      source: announcement,
    })),
    ...(data?.notices ?? []).map((notice): FeedItem => ({
      id: `notice-${notice.id}`,
      type: 'notice',
      title: 'แจ้งเตือนจากระบบ',
      message: notice.message,
      createdAt: notice.created_at,
      source: notice,
    })),
  ].sort((left, right) => (Date.parse(right.createdAt) || 0) - (Date.parse(left.createdAt) || 0));

  async function request() {
    if (!canRequest || !inspection || !terms) return;
    requestId.current ??= crypto.randomUUID();
    const ok = await onRequestSession(inspection, terms, requestId.current);
    if (ok) {
      requestId.current = null;
      setInspection(false);
      setTerms(false);
    }
  }

  function checkReturnLocation() {
    if (!session || session.status !== 'PendingEnd') return;
    setLocationError('');
    if (!navigator.geolocation) {
      setLocationError('อุปกรณ์นี้ไม่รองรับการอ่านพิกัด');
      return;
    }
    navigator.geolocation.getCurrentPosition((position) => {
      void onRun('submit_return_location', {
        session_id: session.id,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
    }, () => setLocationError('อ่านพิกัดโทรศัพท์ไม่ได้ · ตรวจสิทธิ์ตำแหน่งแล้วลองใหม่'), {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 15000,
    });
  }

  async function acknowledgeAnnouncement(id: string) {
    if (markingAnnouncement) return;
    const userId = user.id;
    setMarkingAnnouncement(id);
    try {
      const result = await markAnnouncementSeen(id);
      if (user.id !== userId) return;
      if (result.error) {
        setAnnouncementFeed((current) => ({ ...current, error: result.error ?? '' }));
      } else {
        setAnnouncementFeed((current) => ({
          ...current,
          items: current.items.map((item) => item.id === id ? { ...item, seen: true } : item),
        }));
      }
    } catch {
      setAnnouncementFeed((current) => ({ ...current, error: 'บันทึกการรับทราบไม่สำเร็จ · ลองใหม่อีกครั้ง' }));
    } finally {
      setMarkingAnnouncement(null);
    }
  }

  return (
    <div className={`ops-live-user${view === 'overview' ? ' is-overview' : ''}`}>
      <PageHeader
        title={view === 'ride' ? 'ระหว่างใช้งาน' : 'พร้อมใช้รถหรือยัง?'}
        description={view === 'ride' ? 'ติดตาม Session ปัจจุบันและขั้นตอนคืนรถ' : 'ตรวจสิทธิ์และความพร้อมของรถก่อนเริ่มใช้งาน'}
      />
      {error && <div className="admin-feedback error" role="alert">{error} <button type="button" className="text-button" onClick={() => void onRefresh()}>ลองใหม่</button></div>}
      {loading && !data && <p role="status" className="ops-empty">กำลังอ่านสถานะจากระบบ…</p>}

      {view === 'overview' && <div className="user-overview">
        <section className="user-eligibility" aria-label="สิทธิ์การใช้รถ">
          <article className={accountApproved ? 'is-ready' : 'is-blocked'}>
            <span className="user-eligibility-icon" aria-hidden="true"><UserRound size={21} /></span>
            <div><span>บัญชี</span><strong>{accountApproved ? <><CheckCircle2 size={17} /> ได้รับอนุมัติ</> : accountStatus === 'Pending' ? 'รออนุมัติบัญชี' : accountStatus === 'Suspended' ? 'บัญชีถูกระงับ' : 'ยังไม่สามารถใช้รถได้'}</strong>
              {data?.account.account_status_reason && <small>{data.account.account_status_reason}</small>}</div>
          </article>
          <article className={drivingPermission ? 'is-ready' : 'is-blocked'}>
            <span className="user-eligibility-icon" aria-hidden="true"><ShieldCheck size={21} /></span>
            <div><span>Driving Permission</span><strong>{drivingPermission ? <><CheckCircle2 size={17} /> ได้รับสิทธิ์ขับ</> : 'ยังไม่ได้รับสิทธิ์ขับ'}</strong>
              {!drivingPermission && <small>ต้องผ่านการแนะนำและให้ผู้ดูแลเปิดสิทธิ์</small>}</div>
          </article>
        </section>

        <section className="user-start-area" aria-label="รถและการเริ่มใช้งาน">
          <div className="user-start-panel">
            <div className="user-vehicle-title-row">
              <div><p className="user-section-label">รถของฉัน</p><h2>EV-01</h2></div>
              <span className={`user-vehicle-state ${available ? 'is-ready' : 'is-blocked'}`}><span aria-hidden="true" />{vehicleAvailabilityLabel(data)}</span>
            </div>
            {session ? <div className="user-current-session">
              <strong>{session.status === 'Active' ? 'คุณกำลังใช้งานรถ' : session.status === 'Paused' ? 'Session อยู่ระหว่างพัก' : `มี Session สถานะ ${session.status}`}</strong>
              <p>{session.status === 'Reserved' ? `สิทธิ์จองเหลือ ${seconds ?? 0} วินาที` : session.started_at ? `เริ่มใช้งาน ${displayTime(session.started_at)}` : 'โปรดตรวจสถานะ Session ก่อนดำเนินการต่อ'}</p>
              {onOpenRide && <button className="button button-primary" type="button" onClick={onOpenRide}>ไปหน้าระหว่างใช้งาน <ChevronRight size={16} /></button>}
            </div> : <form className="user-start-form" onSubmit={(event) => { event.preventDefault(); void request(); }}>
              <fieldset disabled={!canRequest}>
                <button className="button button-primary user-start-button" type="submit" disabled={!canRequest || !inspection || !terms}><Bike size={18} />ขอเริ่ม Session<ChevronRight size={17} /></button>
                <label className="ops-check"><input type="checkbox" checked={inspection} required onChange={(event) => setInspection(event.target.checked)} />ยืนยันตรวจรถและความปลอดภัยแล้ว</label>
                <label className="ops-check"><input type="checkbox" checked={terms} required onChange={(event) => setTerms(event.target.checked)} />ยอมรับ Privacy Notice และข้อตกลง</label>
                <details><summary><ChevronDown size={16} /> อ่านประกาศฉบับปัจจุบัน</summary><div className="user-consent-copy"><p>{data?.consent_versions?.privacy_text || 'ยังไม่ได้เผยแพร่ Privacy Notice'}</p><p>{data?.consent_versions?.terms_text || 'ยังไม่ได้เผยแพร่ข้อตกลง'}</p></div></details>
              </fieldset>
              {!canRequest && <p className="user-block-reason">{!data ? 'กำลังรอข้อมูลจากระบบ' : !accountApproved ? 'บัญชียังไม่ได้รับอนุมัติ' : !drivingPermission ? 'ต้องได้รับ Driving Permission ก่อนเริ่ม' : !data.consent_versions?.privacy_text || !data.consent_versions?.terms_text ? 'รอเผยแพร่ Privacy Notice และข้อตกลงฉบับปัจจุบัน' : session ? 'มี Session ที่ยังไม่สิ้นสุด' : !available ? 'รถหรือเงื่อนไขการเริ่มยังไม่พร้อม' : ''}</p>}
            </form>}
          </div>

          <div className="user-vehicle-map">
            <div className="user-map-heading"><div><p className="user-section-label"><MapPin size={14} /> ตำแหน่งรถ</p><h2>ข้อมูลล่าสุด</h2></div>
              <span className={session?.status === 'Active' && data?.own_vehicle?.fresh ? 'is-live' : ''}>{session?.status === 'Active' && data?.own_vehicle?.fresh ? 'GPS ล่าสุด' : data?.own_vehicle?.fresh ? 'พิกัดล่าสุด' : 'รอข้อมูลที่ยืนยันแล้ว'}</span></div>
            {data?.own_vehicle?.battery_percent != null && <p className="user-battery">แบตเตอรี่ <strong>{data.own_vehicle.battery_percent}%</strong></p>}
            <VehicleLiveMap fix={{
              latitude: data?.own_vehicle?.latitude ?? null,
              longitude: data?.own_vehicle?.longitude ?? null,
              gpsAt: data?.own_vehicle?.gps_at ?? null,
              fresh: data?.own_vehicle?.fresh ?? null,
              sessionActive: session?.status === 'Active',
            }} />
          </div>
        </section>

        <section className="panel ops-panel user-trips-section" aria-labelledby="user-trips-heading">
          <div className="user-section-heading"><div><h2 id="user-trips-heading">My Trips</h2><p>ประวัติการใช้รถของคุณ เรียงจากรายการล่าสุด</p></div><span>{data?.trips?.length ?? 0} รายการ</span></div>
          {data?.trips?.length ? <div className="user-trips-table-wrap"><table className="user-trips-table">
            <thead><tr><th scope="col">วันที่ / เวลา</th><th scope="col">ระยะเวลา</th><th scope="col">ระยะทาง</th><th scope="col">สถานะ</th><th scope="col">การดำเนินการ</th></tr></thead>
            <tbody>{data.trips.map((trip) => <tr key={trip.id}>
              <td data-label="วันที่ / เวลา"><time dateTime={trip.started_at ?? undefined}>{displayTime(trip.started_at)}</time></td>
              <td data-label="ระยะเวลา">{formatTripDuration(trip.started_at, trip.ended_at)}</td>
              <td data-label="ระยะทาง">{trip.distance_km == null ? 'ไม่มีข้อมูล' : `${trip.distance_km.toFixed(1)} กม.`}</td>
              <td data-label="สถานะ"><span className={`user-trip-status ${trip.ended_at ? 'is-complete' : 'is-pending'}`}>{trip.ended_at ? 'เสร็จสิ้น' : 'ข้อมูลยังไม่ครบ'}</span></td>
              <td data-label="การดำเนินการ"><details className="user-trip-report"><summary><Flag size={15} /> รายงานข้อมูลผิดพลาด</summary>
                <OperationForm disabled={busy} fields={[{ name: 'details', label: 'ข้อมูลเวลา/ระยะทางที่ต้องตรวจ', type: 'textarea', required: true }]} label="ส่งรายงานข้อมูลผิดพลาด" onSubmit={(values) => onRun('report_trip', { ...values, session_id: trip.id })} />
              </details></td>
            </tr>)}</tbody>
          </table></div> : <p className="ops-empty">{data ? 'ยังไม่มีประวัติการใช้งานรถ' : 'รอข้อมูล My Trips'}</p>}
        </section>

        <section className="panel ops-panel user-updates-section" aria-labelledby="user-updates-heading">
          <div className="user-section-heading"><div className="user-updates-title"><Megaphone size={20} /><h2 id="user-updates-heading">ประกาศและแจ้งเตือน</h2></div></div>
          {announcementFeed.error && <p className="user-feed-error" role="alert">{announcementFeed.error} <button className="text-button" type="button" onClick={() => void refreshAnnouncements()}>ลองใหม่</button></p>}
          {announcementFeed.loading && !feedItems.length && <p className="ops-empty" role="status">กำลังโหลดประกาศ…</p>}
          {feedItems.length > 0 && <div className="user-feed-list">{feedItems.map((item) => {
            const unread = item.type === 'announcement' ? !item.source.seen : item.source.acknowledgment_required && !item.source.acknowledged_at;
            return <article className={`user-feed-item${unread ? ' is-unread' : ''}`} key={item.id}>
              <span className="user-feed-icon" aria-hidden="true">{item.type === 'announcement' ? <Megaphone size={19} /> : <Bell size={18} />}</span>
              <div className="user-feed-content"><div className="user-feed-meta"><span>{item.type === 'announcement' ? 'ประกาศโครงการ' : item.title}</span><time dateTime={item.createdAt}>{displayTime(item.createdAt)}</time></div><h3>{item.type === 'announcement' ? item.title : item.message}</h3>{item.type === 'announcement' && <p>{item.message}</p>}</div>
              {unread && <button className="button button-outline button-small user-feed-action" type="button" disabled={busy || markingAnnouncement === item.source.id} onClick={() => item.type === 'announcement' ? void acknowledgeAnnouncement(item.source.id) : void onRun('acknowledge_notice', { id: item.source.id })}>{markingAnnouncement === item.source.id ? 'กำลังบันทึก…' : 'รับทราบ'}</button>}
            </article>;
          })}</div>}
          {!announcementFeed.loading && !feedItems.length && !announcementFeed.error && <p className="ops-empty">ไม่มีประกาศหรือการแจ้งเตือนในขณะนี้</p>}
        </section>

        <section className="panel ops-panel user-issue-panel" aria-labelledby="user-issue-heading">
          <div className="user-section-heading"><div className="user-updates-title"><CircleAlert size={20} /><div><h2 id="user-issue-heading">รายงานปัญหารถ</h2><p>ปัญหาเบรกหรือคันเร่งจะบล็อกการเริ่มใช้ครั้งถัดไป โดยไม่ตัดมอเตอร์ระหว่างขับ</p></div></div></div>
          <OperationForm disabled={!data || busy} fields={[{ name: 'category', label: 'ประเภทปัญหา', type: 'select', required: true, options: categories.map(([value, label]) => ({ value, label })) }, { name: 'details', label: 'รายละเอียดเหตุขัดข้อง', type: 'textarea', required: true }]} label="ส่งรายงานปัญหา" onSubmit={(values) => onRun('report_issue', values)} />
        </section>

        <details className="user-secondary-tools">
          <summary><span><span className="user-secondary-icon"><Settings2 size={17} /></span><span><strong>ข้อมูลและเครื่องมือเพิ่มเติม</strong><small>คำเตือน บัตร NFC พื้นที่ใช้งาน และข้อมูลส่วนบุคคล</small></span></span><ChevronDown className="user-secondary-chevron" size={18} /></summary>
          <div className="user-secondary-grid">
            <section className="panel ops-panel"><h2>คำเตือนและการทบทวน</h2>
              {data?.warnings?.map((warning) => <p className="ops-warning" key={warning.kind}>{warning.kind}: เหลือ {warning.remaining} ครั้งก่อนถึงเกณฑ์</p>)}
              {!data?.warnings?.length && <p className="muted">{data ? 'ไม่มีคำเตือนตามเกณฑ์ที่ตั้งไว้' : 'รอข้อมูลการประเมิน'}</p>}
              {data?.cycles?.map((cycle) => <p className="ops-record" key={cycle.id}>{cycle.kind} · นับ {cycle.count_value} ครั้ง {cycle.restricted_until && `· จำกัดถึง ${displayTime(cycle.restricted_until)}`}</p>)}
              {data?.no_show_events?.filter((event) => event.fault_status !== 'Exempt').map((event) => <details className="ops-record" key={event.id}><summary>{displayTime(event.occurred_at)} · {event.fault_status}</summary><OperationForm disabled={busy || event.fault_status === 'UnderReview' || event.fault_status === 'Reopened'} fields={[{ name: 'details', label: 'หลักฐานใหม่หรือคำอธิบาย', type: 'textarea', required: true }]} label="ส่งคำขอทบทวน" onSubmit={(values) => onRun('request_no_show_review', { ...values, id: event.id })} /></details>)}
            </section>
            <section className="panel ops-panel"><h2>บัตร NFC และข้อมูลส่วนบุคคล</h2>
              {data?.nfc_card ? <><p>สถานะ {data.nfc_card.enabled ? 'เปิดใช้' : 'ปิดใช้'} · ลงทะเบียน {displayTime(data.nfc_card.registered_at)}</p><button type="button" className="button button-outline" disabled={busy} onClick={() => void onRun('toggle_nfc', { enabled: !data.nfc_card!.enabled })}>{data.nfc_card.enabled ? 'ปิดใช้บัตร' : 'เปิดใช้บัตร'}</button></> : <p className="muted">{data ? 'ยังไม่มีบัตรที่ Admin ลงทะเบียน' : 'รอข้อมูลบัตร'}</p>}
              <h3>ผลคำขอข้อมูลส่วนบุคคล</h3>{data?.privacy_exports?.map((item) => <details className="ops-record" key={item.id}><summary>ข้อมูลที่จัดเตรียม {displayTime(item.created_at)}</summary><pre className="ops-evidence">{JSON.stringify(item.data, null, 2)}</pre></details>)}{!data?.privacy_exports?.length && <p className="muted">ยังไม่มีชุดข้อมูลที่จัดเตรียมให้</p>}
            </section>
            <section className="panel ops-panel"><h2>พื้นที่ใช้งานและคืนรถ</h2>{(['main', 'return'] as const).map((kind) => <div key={kind}><h3>{kind === 'main' ? 'Main Geofence' : 'Return Zone'}</h3><ZonePreview geometry={data?.zones?.find((zone) => zone.kind === kind)?.geometry ?? null} label={kind === 'main' ? 'พื้นที่ใช้งานหลัก' : 'พื้นที่คืนรถ'} /></div>)}</section>
            {Boolean(data?.gps_reviews?.length) && <section className="panel ops-panel"><h2>การตรวจสอบพิกัดของฉัน</h2>{data?.gps_reviews.map((review) => <article className="ops-record" key={review.id}><strong>{review.status}</strong><p>{review.summary || 'ยังไม่มีสรุปการชี้แจงทางโทรศัพท์'}</p><small>ติดต่อหมายเลขกลางโครงการหากข้อมูลไม่ถูกต้อง</small></article>)}</section>}
          </div>
        </details>
      </div>}

      {view === 'ride' && <div className="ops-two-columns">
        <section className="panel ops-panel"><h2>Session จริง</h2><p>สถานะรถ: <strong>{vehicleAvailabilityLabel(data)}</strong></p>
          <p>Driving Permission: <strong>{user.drivingPermission ? 'ได้รับสิทธิ์' : 'ยังไม่ได้รับสิทธิ์'}</strong></p>
          {session ? <div className="ops-record"><strong>{session.status}</strong><p>ขอเริ่ม {displayTime(session.created_at)} · เริ่มจริง {displayTime(session.started_at)}</p>{pending && <p className="ops-warning">{session.status === 'Reserved' ? `รอหลักฐาน Motor Ready จากรถ · สิทธิ์จองหมดอายุใน ${seconds} วินาที` : 'กำลังตรวจสอบผลสั่งงานกับรถ · รอหลักฐาน Motor Ready'}</p>}
            <div className="ops-row">{session.status === 'Reserved' && <button className="button button-outline" type="button" disabled={busy} onClick={() => void onSessionAction(session.id, 'cancel')}>ยกเลิกคำขอ</button>}{session.status === 'Active' && <button className="button button-outline" type="button" disabled={busy} onClick={() => void onSessionAction(session.id, 'pause')}>ขอ Pause</button>}{session.status === 'Paused' && <button className="button button-outline" type="button" disabled={busy} onClick={() => void onSessionAction(session.id, 'resume')}>ขอ Resume</button>}{(session.status === 'Active' || session.status === 'Paused' || session.status === 'PendingEnd') && <button className="button button-primary" type="button" disabled={busy} onClick={() => void onSessionAction(session.id, 'end')}>ขอจบ Session</button>}</div>
            {session.status === 'PendingEnd' && <><p className="muted">จะจบจริงเมื่อรถยืนยันหยุด มอเตอร์ปิด และผ่าน Return Zone หรือข้อยกเว้นที่กำหนด</p><button type="button" className="button button-outline button-small" disabled={busy} onClick={checkReturnLocation}>ส่งพิกัดโทรศัพท์เพื่อตรวจ Return Zone</button>{locationError && <p className="ops-warning">{locationError}</p>}</>}
          </div> : <p className="ops-empty">{data ? 'ยังไม่มี Session ของคุณ' : 'รอข้อมูล Session'}</p>}
          {data && user.role !== 'Manager' && onOpenOverview && <button type="button" className="button button-outline" onClick={onOpenOverview}>กลับไปภาพรวมเพื่อขอเริ่มใช้งาน</button>}
          {!session && user.role === 'Manager' && <form className="ops-form" onSubmit={(event) => { event.preventDefault(); void request(); }}><fieldset disabled={!canRequest}><h3>ตรวจสภาพก่อนขับ</h3><p className="muted">ตรวจรถจริงก่อนทุกครั้ง คำขอผ่านเว็บเป็นการจองชั่วคราวจนกว่ารถยืนยัน Motor Ready</p><label className="ops-check"><input type="checkbox" checked={inspection} required onChange={(event) => setInspection(event.target.checked)} />ยืนยันว่าตรวจรถและสภาพความปลอดภัยก่อนขับแล้ว</label><details><summary>อ่าน Privacy Notice และข้อตกลงรุ่นปัจจุบัน</summary><p>{data?.consent_versions?.privacy_text || 'ยังไม่ได้เผยแพร่ Privacy Notice'}</p><p>{data?.consent_versions?.terms_text || 'ยังไม่ได้เผยแพร่ข้อตกลง'}</p></details><label className="ops-check"><input type="checkbox" checked={terms} required onChange={(event) => setTerms(event.target.checked)} />ยอมรับ Privacy Notice {data?.consent_versions?.privacy ?? '—'} และข้อตกลง {data?.consent_versions?.terms ?? '—'}</label><button className="button button-primary" type="submit">ขอเริ่ม Session</button></fieldset></form>}
          {user.role === 'Manager' && !canRequest && !session && data && <p className="ops-warning">{!accountApproved ? 'ต้องให้ Admin อนุมัติบัญชี' : !drivingPermission ? 'ต้องให้ Admin ยืนยันการแนะนำและเปิด Driving Permission' : !data.consent_versions?.privacy_text || !data.consent_versions?.terms_text ? 'รอเผยแพร่ Privacy Notice และข้อตกลงที่ตรวจทานแล้ว' : 'รถหรือเงื่อนไขการเริ่มยังไม่พร้อม · โหลดสถานะใหม่เมื่อพร้อม'}</p>}
        </section>
        <section className="panel ops-panel"><h2>ข้อมูลจากรถ</h2>{data?.own_vehicle && <><p>แบตเตอรี่: {data.own_vehicle.battery_percent ?? 'ไม่มีข้อมูล'}{data.own_vehicle.battery_percent != null ? '%' : ''}</p><p>GPS ล่าสุด: {displayTime(data.own_vehicle.gps_at)} {data.own_vehicle.fresh ? '' : '· ข้อมูลเก่า'}</p></>}
          <VehicleLiveMap fix={{ latitude: data?.own_vehicle?.latitude ?? null, longitude: data?.own_vehicle?.longitude ?? null, gpsAt: data?.own_vehicle?.gps_at ?? null, fresh: data?.own_vehicle?.fresh ?? null, sessionActive: session?.status === 'Active' }} />
          {phone ? <a className="button button-outline button-small" href={`tel:${phone}`}>โทรหมายเลขกลางโครงการ {data?.project_phone}</a> : <p className="muted">ยังไม่ได้ตั้งหมายเลขกลางโครงการ</p>}</section>
      </div>}
      {view === 'ride' && session && liveStatuses.has(session.status) && <p className="tiny-note">การเปลี่ยนสิทธิ์หรือสถานะบัญชีไม่หยุดรถกลางทาง โปรดจบ Session ตามขั้นตอนและตรวจความปลอดภัยจริง</p>}
    </div>
  );
}

