import {Activity, AlertTriangle, ClipboardCheck, Clock3, History, Radio, RefreshCw} from 'lucide-react';
import {displayTime} from './client';
import type {OperationsSnapshot, OpsSession} from './types';

const sessionLabels:Record<string,{label:string;next:string;attention:boolean}>={
  Reserved:{label:'สงวนสิทธิ์',next:'รอเริ่มภายในเวลาที่กำหนด',attention:false},
  PendingStart:{label:'รอยืนยันเริ่ม',next:'รอหลักฐาน Motor Ready จากรถ',attention:true},
  Active:{label:'กำลังใช้งาน',next:'ติดตามการขับขี่และเหตุแจ้งเตือน',attention:false},
  PendingPause:{label:'รอยืนยันพัก',next:'รอรถหยุดนิ่งและ Motor Ready ปิดจริง',attention:true},
  Paused:{label:'พักและล็อก',next:'เจ้าของรอบเดิมเท่านั้นที่ Resume ได้',attention:false},
  PendingResume:{label:'รอยืนยัน Resume',next:'รอหลักฐาน Motor Ready จากรถ',attention:true},
  PendingEnd:{label:'รอยืนยันคืนรถ',next:'รอรถหยุดนิ่ง Return Zone และ Motor Ready ปิดจริง',attention:true},
  EndedPendingSync:{label:'รอซิงก์รอบออฟไลน์',next:'รอเซิร์ฟเวอร์รับรอง Event ตามลำดับ',attention:true},
  Conflict:{label:'ข้อมูลขัดแย้ง',next:'ตรวจเหตุการณ์และประสานสถานะก่อนเปิดรอบใหม่',attention:true},
};

export function sessionPresentation(session:OpsSession|null){
  if(!session)return {label:'ไม่มี Session ค้าง',next:'พร้อมตรวจคำขอใหม่เมื่อเงื่อนไขบริการครบ',attention:false};
  return sessionLabels[session.status]??{label:session.status,next:'ตรวจสอบสถานะล่าสุดก่อนดำเนินการ',attention:true};
}

export function ManagerStatusSummary({data,onRefresh}:{data:OperationsSnapshot|null;onRefresh:()=>Promise<void>}){
  const vehicle=data?.vehicle;
  const session=sessionPresentation(data?.current_session??null);
  const telemetry=vehicle?.telemetry_at ? vehicle.fresh===true?'ข้อมูลรถล่าสุด':'ข้อมูลรถเก่าหรือไม่ยืนยัน':'รอข้อมูลจากรถ';
  return <section className="manager-command" aria-label="สรุปงาน Manager">
    <div className="manager-command-intro"><div><span className="manager-eyebrow"><Radio size={14}/> ศูนย์ปฏิบัติการ EV-01</span><h2>ภาพรวมรถและงานที่ต้องดูแล</h2><p>ข้อมูลจากระบบเว็บ · การยืนยันจากรถขึ้นอยู่กับอุปกรณ์ที่เชื่อมต่อ</p></div><button type="button" className="button button-outline button-small" onClick={()=>void onRefresh()}><RefreshCw size={15}/>โหลดข้อมูลใหม่</button></div>
    <div className="manager-command-metrics"><div><span>Session ปัจจุบัน</span><strong className={session.attention?'manager-text-alert':''}>{data?session.label:'กำลังโหลด'}</strong><small>{data?session.next:'—'}</small></div><div><span>ข้อมูลจากรถ</span><strong>{data?telemetry:'กำลังโหลด'}</strong><small>{vehicle?.telemetry_at?`อัปเดต ${displayTime(vehicle.telemetry_at)}`:'ยังไม่มีเวลาอัปเดต'}</small></div><div><span>สถานะบริการ</span><strong>{data?data.service.safety_block_active?'มี Safety Block':data.service.manual_out_of_service?'หยุดให้บริการ':'ไม่มีข้อจำกัดบริการ':'กำลังโหลด'}</strong><small>{data?.service.final_confirmation_required?'รอ Admin ยืนยันเปิดบริการ':'ตรวจเงื่อนไขก่อนเริ่มทุกครั้ง'}</small></div></div>
  </section>;
}

export function ManagerWorkQueue({data}:{data:OperationsSnapshot|null}){
  const current=data?.current_session??null;
  const state=sessionPresentation(current);
  const pendingNoShow=data?.no_show_events.filter(event=>event.counted&&['UnderReview','Reopened'].includes(event.fault_status)).length??0;
  const pendingRelease=data?.cycles.filter(cycle=>cycle.kind==='NoShow'&&cycle.release_pending).length??0;
  const unresolved=data?.alerts.filter(alert=>!alert.acknowledged_at).length??0;
  return <section className="panel ops-panel manager-work-panel" aria-labelledby="manager-work-title"><div className="manager-section-heading"><div><span className="manager-section-icon"><ClipboardCheck size={18}/></span><h2 id="manager-work-title">งานที่ต้องติดตาม</h2></div><span className="manager-section-meta">จากข้อมูลเว็บล่าสุด</span></div>
    <div className="manager-work-list"><article className="manager-work-item"><span className={`manager-work-dot ${state.attention?'urgent':'calm'}`}/><div><strong>{data?state.label:'กำลังโหลด Session'}</strong><p>{data?state.next:'รอข้อมูลจากระบบ'}</p>{current&&<small>{current.rider_name??'ไม่พบชื่อผู้ขับ'} · {current.source} · {displayTime(current.created_at)}</small>}</div></article>
      <article className="manager-work-item"><span className={`manager-work-dot ${pendingNoShow+pendingRelease?'urgent':'calm'}`}/><div><strong>ตรวจ No-show {data?pendingNoShow+pendingRelease:'—'} รายการ</strong><p>รอตรวจหลักฐาน {data?pendingNoShow:'—'} · รออนุมัติปลดข้อจำกัด {data?pendingRelease:'—'}</p><a href="#manager-reviews">เปิดรายการพิจารณา</a></div></article>
      <article className="manager-work-item"><span className={`manager-work-dot ${unresolved?'urgent':'calm'}`}/><div><strong>Alert ยังไม่รับทราบ {data?unresolved:'—'} รายการ</strong><p>การรับทราบไม่ปลด Safety Block</p><a href="#manager-alerts">เปิดศูนย์แจ้งเตือน</a></div></article></div>
    {data?.vehicle.offline_reconciliation_required&&<p className="ops-warning">มีรายการ NFC ออฟไลน์ที่ต้องซิงก์และตรวจความขัดแย้งก่อนรับคำขอเว็บใหม่</p>}
  </section>;
}

export function ManagerBehaviorWarnings({data}:{data:OperationsSnapshot|null}){
  const cycles=data?.cycles??[];
  const warnings=cycles.filter(cycle=>!cycle.restricted_until&&cycle.policy.limit!=null&&cycle.policy.warning_remaining!=null&&cycle.policy.limit-cycle.count_value>0&&cycle.policy.limit-cycle.count_value<=cycle.policy.warning_remaining);
  const restricted=cycles.filter(cycle=>cycle.restricted_until&&Date.parse(cycle.restricted_until)>Date.now());
  return <section className="panel ops-panel manager-warning-panel" aria-labelledby="manager-warning-title"><div className="manager-section-heading"><div><span className="manager-section-icon amber"><AlertTriangle size={18}/></span><h2 id="manager-warning-title">คำเตือนพฤติกรรมการใช้รถ</h2></div><span className="manager-section-meta">Cancellation / No-show</span></div>
    {warnings.length?warnings.map(cycle=><div className="manager-warning-row" key={cycle.id}><span className="manager-warning-kind">{cycle.kind==='Cancellation'?'Cancellation':'No-show'}</span><div><strong>{cycle.user_name??'ผู้ใช้'}</strong><p>เหลืออีก {cycle.policy.limit!-cycle.count_value} เหตุการณ์ก่อนถึงเกณฑ์</p></div></div>):<p className="manager-quiet-state">{data?'ไม่มีคำเตือนที่เข้าเงื่อนไข · เกณฑ์ที่ยังไม่กำหนดจาก Pilot จะไม่สร้างคำเตือน':'กำลังโหลดการประเมิน'}</p>}
    {restricted.length>0&&<div className="manager-restriction-note"><Clock3 size={16}/><span>มีผู้ใช้ติด Cooldown {restricted.length} รายการ · ดูรายละเอียดในส่วนพิจารณาด้านล่าง</span></div>}
  </section>;
}

const activityLabels:Record<string,string>={acknowledge_alert:'รับทราบ Alert',review_no_show:'ตรวจหลักฐาน No-show',approve_no_show_release:'อนุมัติปลด No-show',clear_safety_block:'บันทึกผลตรวจ Safety Block'};
export function ManagerActivityHistory({data}:{data:OperationsSnapshot|null}){
  const history=data?.manager_activity??[];
  return <section className="panel ops-panel manager-history-panel" aria-labelledby="manager-history-title"><div className="manager-section-heading"><div><span className="manager-section-icon"><History size={18}/></span><h2 id="manager-history-title">ประวัติการดำเนินงาน</h2></div><span className="manager-section-meta">อ่านอย่างเดียว · ล่าสุด 30 รายการ</span></div>
    {history.length?<div className="manager-history-list">{history.map(item=><article key={item.id}><span className="manager-history-mark"/><div><strong>{activityLabels[item.action]??item.action}</strong><p>{item.actor_name} · {item.reason||'ไม่มีเหตุผลเพิ่มเติม'}</p><small>{displayTime(item.created_at)}</small></div></article>)}</div>:<p className="manager-quiet-state">{data?.manager_activity?'ยังไม่มีประวัติการดำเนินงานในขอบเขต Manager':data?'ต้องติดตั้ง migration ประวัติ Manager เพื่อแสดง Audit':'กำลังโหลดประวัติ'}</p>}
    <p className="manager-history-scope"><Activity size={14}/> แสดงเฉพาะการรับทราบ Alert การตรวจ No-show การอนุมัติปลด และการตรวจ Safety Block</p>
  </section>;
}
