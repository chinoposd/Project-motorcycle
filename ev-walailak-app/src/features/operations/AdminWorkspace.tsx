import {useState,type ReactNode} from 'react';
import {RefreshCw} from 'lucide-react';
import {bangkokDay} from './client';
import {useOperations} from './useOperations';
import OperationalOverview,{DailyReport} from './OperationalOverview';
import AccountOperations from './AccountOperations';
import OperationalReviews from './OperationalReviews';
import ZoneContactSettings from './ZoneContactSettings';
import PrivacyOperations from './PrivacyOperations';
const tabs=[['overview','ภาพรวม'],['accounts','บัญชี / อุทธรณ์'],['operations','ปฏิบัติการ'],['zones','พื้นที่และติดต่อ'],['privacy','ข้อมูลส่วนบุคคล'],['settings','สิทธิ์ / ตั้งค่า / ประกาศ / Audit']] as const;
export default function AdminWorkspace({isDemo,accounts,settings,onShowToast,onChanged}:{isDemo:boolean;accounts:ReactNode;settings:ReactNode;onShowToast:(message:string)=>void;onChanged:()=>void}){
  const [tab,setTab]=useState<(typeof tabs)[number][0]>('overview');const [date,setDate]=useState(bangkokDay);
  const state=useOperations(isDemo,date,onShowToast,onChanged);
  return <div className="ops-workspace"><nav className="ops-workspace-tabs" aria-label="พื้นที่งานผู้ดูแล" role="tablist">{tabs.map(([id,label])=><button key={id} type="button" role="tab" id={`ops-tab-${id}`} aria-selected={tab===id} aria-controls={`ops-view-${id}`} onClick={()=>setTab(id)}>{label}</button>)}</nav>
    {isDemo&&<div className="admin-feedback info">โหมดตัวอย่าง · ดูโครงสร้างเครื่องมือได้ การดำเนินการจริงต้องใช้บัญชี Admin</div>}
    {state.error&&<div className="admin-feedback error" role="alert"><span>{state.error}</span><button className="text-button" type="button" onClick={()=>void state.refresh()}><RefreshCw size={14}/>โหลดใหม่</button></div>}
    {state.loading&&!state.data&&<p role="status" className="muted">กำลังโหลดข้อมูล Adminx3…</p>}
    <section id="ops-view-overview" role="tabpanel" aria-labelledby="ops-tab-overview" hidden={tab!=='overview'}><OperationalOverview data={state.data} disabled={state.disabled} run={state.run} refresh={state.refresh}/><DailyReport data={state.data} date={date} onDateChange={setDate}/></section>
    <section id="ops-view-accounts" role="tabpanel" aria-labelledby="ops-tab-accounts" hidden={tab!=='accounts'}>{accounts}<AccountOperations data={state.data} disabled={state.disabled} run={state.run}/></section>
    <section id="ops-view-operations" role="tabpanel" aria-labelledby="ops-tab-operations" hidden={tab!=='operations'}><OperationalReviews data={state.data} disabled={state.disabled} run={state.run}/></section>
    <section id="ops-view-zones" role="tabpanel" aria-labelledby="ops-tab-zones" hidden={tab!=='zones'}><ZoneContactSettings data={state.data} disabled={state.disabled} run={state.run}/></section>
    <section id="ops-view-privacy" role="tabpanel" aria-labelledby="ops-tab-privacy" hidden={tab!=='privacy'}><PrivacyOperations data={state.data} disabled={state.disabled} run={state.run}/></section>
    <section id="ops-view-settings" role="tabpanel" aria-labelledby="ops-tab-settings" hidden={tab!=='settings'}>{settings}</section>
  </div>;
}
