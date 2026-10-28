import PageHeader from '../../components/PageHeader';
import type {ManagerView} from '../../types';
import {bangkokDay,displayTime} from './client';
import {Alerts,DailyReport,type RunOperation} from './OperationalOverview';
import OperationalReviews from './OperationalReviews';
import type {OperationsSnapshot} from './types';
import VehicleLiveMap from './VehicleLiveMap';

interface Props {view:ManagerView;onViewChange:(view:ManagerView)=>void;data:OperationsSnapshot|null;loading:boolean;error:string;busy:boolean;onRefresh:()=>Promise<void>;onRun:RunOperation;date?:string;onDateChange?:(date:string)=>void}
export default function ManagerOperationsPage({view,onViewChange,data,loading,error,busy,onRefresh,onRun,date=bangkokDay(),onDateChange=()=>undefined}:Props){
  const v=data?.vehicle,s=data?.current_session;
  return <div className="ops-manager"><PageHeader title="ภาพรวมการปฏิบัติงาน" description="สถานะรถ Session การแจ้งเตือน และรายงานจากข้อมูลจริง" badge="Manager"/>
    <div className="view-switch" role="tablist" aria-label="เมนู Manager"><button type="button" role="tab" aria-selected={view==='overview'} className={view==='overview'?'active':''} onClick={()=>onViewChange('overview')}>ภาพรวม</button><button type="button" role="tab" aria-selected={view==='ride'} className={view==='ride'?'active':''} onClick={()=>onViewChange('ride')}>ขับขี่รถ</button></div>
    {error&&<div role="alert" className="admin-feedback error">{error}<button className="text-button" type="button" onClick={()=>void onRefresh()}>โหลดใหม่</button></div>}{loading&&!data&&<p role="status">กำลังโหลดข้อมูลปฏิบัติการ…</p>}
    <div className="ops-two-columns"><section className="panel ops-panel"><h2>รถและ Session ปัจจุบัน</h2><p>Safety Block: <strong>{data?data.service.safety_block_active?'เปิดอยู่':'ไม่มี':'—'}</strong> · OUT_OF_SERVICE: <strong>{data?data.service.manual_out_of_service?'เปิดอยู่':'ไม่มี':'—'}</strong></p>
      {!v?.telemetry_at?null:<><p className={v.fresh?'ops-good':'ops-warning'}>ข้อมูลรถ {v.fresh?'ยังใช้ได้':'เก่าหรือขาดการยืนยัน'} · {displayTime(v.telemetry_at)}</p><div className="ops-data-grid"><div>มอเตอร์<strong>{v.motor_ready===true?'Motor Ready':v.motor_ready===false?'ปิด':'ไม่ทราบ'}</strong></div><div>แบตเตอรี่<strong>{v.battery_percent??'ไม่มีข้อมูล'}</strong></div><div>รถหยุดนิ่ง<strong>{v.stopped===true?'ยืนยันแล้ว':v.stopped===false?'กำลังเคลื่อนที่':'ไม่ทราบ'}</strong></div></div></>}
      <VehicleLiveMap fix={{latitude:v?.latitude??null,longitude:v?.longitude??null,gpsAt:v?.gps_at??null,fresh:v?.fresh===true&&v.gps_reliable===true,sessionActive:s?.status==='Active'}}/>
      {s?<article className="ops-record"><strong>{s.status} · {s.rider_name??'ไม่พบชื่อ'} · {s.rider_role??'—'}</strong><p>เริ่ม {displayTime(s.started_at)} · ข้อมูลจาก {s.source}</p>{s.status==='Active'&&s.rider_phone&&<a href={`tel:${s.rider_phone.replace(/[^+\d]/g,'')}`}>โทรหาผู้ขับปัจจุบัน</a>}</article>:<p className="ops-empty">{data?'ไม่มี Session ค้าง':'รอข้อมูล Session'}</p>}</section>
      <Alerts data={data} disabled={!data||busy} run={onRun}/></div>
    <DailyReport data={data} date={date} onDateChange={onDateChange}/><OperationalReviews data={data} disabled={!data||busy} run={onRun} isManager/>
    <p className="tiny-note">Manager รับทราบ Alert และดูรายงานร่วมกับ Admin ได้ การเปิดบริการขั้นสุดท้ายและการแก้ข้อมูลส่วนบุคคลเป็นหน้าที่ Admin</p>
  </div>;
}
