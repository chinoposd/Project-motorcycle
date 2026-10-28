import {useState} from 'react';
import OperationForm,{reasonField,type FormField} from './OperationForm';
import ZonePreview,{geometryFromText,textFromGeometry} from './ZonePreview';
import type {OperationsSnapshot,Zone} from './types';
import type {RunOperation} from './OperationalOverview';
function ZoneEditor({kind,zone,disabled,run}:{kind:'return'|'main';zone:Zone|undefined;disabled:boolean;run:RunOperation}){
  const [text,setText]=useState(()=>textFromGeometry(zone?.geometry));const [reason,setReason]=useState('');const [error,setError]=useState('');
  let geometry:Zone['geometry']|null=null;try{geometry=geometryFromText(text);}catch{/* Render the validation on submit. */}
  return <section className="panel ops-panel"><h2>{kind==='return'?'Return Zone':'Main Geofence'}</h2><p className="muted">รุ่นปัจจุบัน {zone?.version??'ยังไม่กำหนด'} · เปลี่ยนได้เมื่อมีหลักฐานรถหยุดนิ่งและไม่มี Session หรือสิทธิ์ออฟไลน์ค้าง</p><ZonePreview geometry={geometry} label={kind==='return'?'พื้นที่คืนรถ':'พื้นที่ใช้งานหลัก'}/><form className="ops-form" onSubmit={event=>{event.preventDefault();setError('');try{const next=geometryFromText(text);void run('save_zone',{kind,geometry:next,reason,expected_version:zone?.version??0});}catch(failure){setError(failure instanceof Error?failure.message:'ตรวจพิกัดอีกครั้ง');}}}><fieldset disabled={disabled}><label className="ops-field">ละติจูด, ลองจิจูด · จุดละหนึ่งบรรทัด<textarea rows={5} value={text} onChange={event=>setText(event.target.value)} required placeholder="กรอกพิกัดพื้นที่จริงอย่างน้อย 3 จุด"/></label><label className="ops-field">เหตุผลเปลี่ยนขอบเขต<textarea rows={2} minLength={5} required value={reason} onChange={event=>setReason(event.target.value)}/></label>{error&&<p role="alert" className="ops-warning">{error}</p>}<button className="button button-primary" type="submit">บันทึกขอบเขตรุ่นใหม่</button></fieldset></form></section>;
}
const pilotFields:FormField[]=[{name:'project_phone',label:'หมายเลขโทรกลางโครงการ',type:'tel'},
  {name:'cancellation_window_hours',label:'หน้าต่างประเมิน Cancellation (ชั่วโมง)',type:'number',min:1},
  {name:'cancellation_warning_remaining',label:'เตือน Cancellation เมื่อเหลือกี่เหตุการณ์',type:'number',min:1},
  {name:'no_show_window_hours',label:'หน้าต่างประเมิน No-show (ชั่วโมง)',type:'number',min:1},
  {name:'no_show_warning_remaining',label:'เตือน No-show เมื่อเหลือกี่เหตุการณ์',type:'number',min:1},
  {name:'offline_alert_minutes',label:'รถขาดการเชื่อมต่อนานกี่นาทีจึงแจ้งเตือน',type:'number',min:1},reasonField];
export default function ZoneContactSettings({data,disabled,run}:{data:OperationsSnapshot|null;disabled:boolean;run:RunOperation}){
  const config=data?.config;
  return <><div className="ops-two-columns">{(['return','main'] as const).map(kind=>{const zone=data?.zones.find(item=>item.kind===kind&&item.active);return <ZoneEditor key={`${kind}-${zone?.version??0}`} kind={kind} zone={zone} disabled={disabled} run={run}/>;})}</div>
    <section className="panel ops-panel"><h2>เบอร์กลางและค่าประเมินจาก Pilot</h2><p className="muted">เว้นค่าว่างจนกว่าจะได้ผล Pilot ใช้ร่วมกับจำนวนครั้ง/คูลดาวน์ในแท็บตั้งค่า · ค่าใหม่ใช้กับการประเมินครั้งถัดไป ไม่แก้เวลา cooldown ที่เริ่มแล้ว</p><OperationForm key={config?.version??0} disabled={disabled} initial={config?Object.fromEntries(pilotFields.map(field=>[field.name,config[field.name as keyof typeof config]??''])):{}} fields={pilotFields} onSubmit={values=>run('update_operations_config',{...values,version:config?.version})}/></section>
    <section className="panel ops-panel"><h2>Privacy Notice และข้อตกลงก่อนเริ่มรถ</h2><p className="muted">ใส่ข้อความและเลขรุ่นที่อาจารย์/ผู้รับผิดชอบตรวจทานแล้ว ผู้ใช้ต้องยอมรับรุ่นที่เผยแพร่ก่อนเริ่มครั้งแรก</p><OperationForm disabled={disabled} fields={[{name:'privacy_notice_version',label:'รุ่น Privacy Notice',required:true},{name:'privacy_notice_text',label:'ข้อความ Privacy Notice ที่ตรวจทานแล้ว',type:'textarea',required:true},{name:'terms_version',label:'รุ่นข้อตกลงการใช้รถ',required:true},{name:'terms_text',label:'ข้อความข้อตกลงที่ตรวจทานแล้ว',type:'textarea',required:true},{name:'advisor_review_confirmed',label:'ผู้รับผิดชอบตรวจทานข้อความทั้งสองฉบับแล้ว',type:'checkbox',required:true},reasonField]} onSubmit={values=>run('publish_ride_policy',values)}/></section>
  </>;
}
