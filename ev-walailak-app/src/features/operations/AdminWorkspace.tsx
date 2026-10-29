import {useState,type KeyboardEvent,type ReactNode} from 'react';
import {Activity, LayoutDashboard, LockKeyhole, MapPinned, RefreshCw, Settings2, UsersRound} from 'lucide-react';
import {bangkokDay} from './client';
import {useOperations} from './useOperations';
import OperationalOverview,{DailyReport} from './OperationalOverview';
import AccountOperations from './AccountOperations';
import OperationalReviews from './OperationalReviews';
import ZoneContactSettings from './ZoneContactSettings';
import PrivacyOperations from './PrivacyOperations';
const tabs=[
  {id:'overview',label:'ภาพรวม',detail:'สถานะและสรุปงาน',icon:LayoutDashboard},
  {id:'accounts',label:'บัญชีและอุทธรณ์',detail:'อนุมัติและจัดการสิทธิ์',icon:UsersRound},
  {id:'operations',label:'ปฏิบัติการรถ',detail:'ตรวจรถ Alert และ No-show',icon:Activity},
  {id:'zones',label:'พื้นที่และติดต่อ',detail:'เขตใช้งานและข้อมูลติดต่อ',icon:MapPinned},
  {id:'privacy',label:'ข้อมูลส่วนบุคคล',detail:'คำขอและการเก็บรักษาข้อมูล',icon:LockKeyhole},
  {id:'settings',label:'ตั้งค่าระบบ',detail:'บริการ ประกาศ และ Audit',icon:Settings2},
] as const;
type AdminTab=(typeof tabs)[number]['id'];
export default function AdminWorkspace({isDemo,accounts,settings,onShowToast,onChanged,pendingAccountCount}:{isDemo:boolean;accounts:ReactNode;settings:ReactNode;onShowToast:(message:string)=>void;onChanged:()=>void;pendingAccountCount:number|null}){
  const [tab,setTab]=useState<AdminTab>('overview');const [date,setDate]=useState(bangkokDay);
  const state=useOperations(isDemo,date,onShowToast,onChanged);
  function handleTabKeyDown(event:KeyboardEvent<HTMLButtonElement>){
    const index=tabs.findIndex(item=>item.id===tab);
    const nextIndex=event.key==='ArrowRight'?(index+1)%tabs.length:event.key==='ArrowLeft'?(index-1+tabs.length)%tabs.length:event.key==='Home'?0:event.key==='End'?tabs.length-1:-1;
    if(nextIndex<0)return;
    event.preventDefault();
    const nextTab:AdminTab=tabs[nextIndex].id;
    setTab(nextTab);
    document.getElementById(`ops-tab-${nextTab}`)?.focus();
  }
  return <div className="ops-workspace">
    <div className="ops-workspace-heading"><div className="ops-workspace-heading-copy"><span className="ops-workspace-heading-icon"><LockKeyhole size={19}/></span><div><h2>ศูนย์จัดการระบบ</h2><p>เลือกหมวดงานเพื่อดูข้อมูลและดำเนินการ</p></div></div><span className={`ops-workspace-mode${isDemo?' is-demo':''}`}><i/>{isDemo?'โหมดตัวอย่าง':'บัญชีผู้ดูแลระบบ'}</span></div>
    <nav className="ops-workspace-tabs" aria-label="พื้นที่งานผู้ดูแล" role="tablist" onKeyDown={handleTabKeyDown}>{tabs.map(({id,label,detail,icon:Icon})=>{const count=id==='accounts'?pendingAccountCount:null;return <button key={id} type="button" role="tab" id={`ops-tab-${id}`} aria-label={count===null?label:`${label}, ${count} บัญชีรอตรวจ`} aria-selected={tab===id} aria-controls={`ops-view-${id}`} tabIndex={tab===id?0:-1} onClick={()=>setTab(id)}><Icon className="ops-workspace-tab-icon" size={18}/><span className="ops-workspace-tab-copy"><strong>{label}</strong><small>{detail}</small></span>{count!==null&&<span className={`ops-workspace-tab-count${count>0?' has-pending':''}`}>{count}</span>}</button>})}</nav>
    {isDemo&&<div className="admin-feedback info">โหมดตัวอย่าง · ดูโครงสร้างเครื่องมือได้ การดำเนินการจริงต้องใช้บัญชี Admin</div>}
    {state.error&&<div className="admin-feedback error" role="alert"><span>{state.error}</span><button className="text-button" type="button" onClick={()=>void state.refresh()}><RefreshCw size={14}/>โหลดใหม่</button></div>}
    {state.loading&&!state.data&&<p role="status" className="muted">กำลังโหลดข้อมูล Adminx3…</p>}
    <section id="ops-view-overview" className="ops-workspace-view" role="tabpanel" aria-labelledby="ops-tab-overview" tabIndex={0} hidden={tab!=='overview'}><OperationalOverview data={state.data} disabled={state.disabled} run={state.run} refresh={state.refresh}/><DailyReport data={state.data} date={date} onDateChange={setDate}/></section>
    <section id="ops-view-accounts" className="ops-workspace-view" role="tabpanel" aria-labelledby="ops-tab-accounts" tabIndex={0} hidden={tab!=='accounts'}>{accounts}<AccountOperations data={state.data} disabled={state.disabled} run={state.run}/></section>
    <section id="ops-view-operations" className="ops-workspace-view" role="tabpanel" aria-labelledby="ops-tab-operations" tabIndex={0} hidden={tab!=='operations'}><OperationalReviews data={state.data} disabled={state.disabled} run={state.run}/></section>
    <section id="ops-view-zones" className="ops-workspace-view" role="tabpanel" aria-labelledby="ops-tab-zones" tabIndex={0} hidden={tab!=='zones'}><ZoneContactSettings data={state.data} disabled={state.disabled} run={state.run}/></section>
    <section id="ops-view-privacy" className="ops-workspace-view" role="tabpanel" aria-labelledby="ops-tab-privacy" tabIndex={0} hidden={tab!=='privacy'}><PrivacyOperations data={state.data} disabled={state.disabled} run={state.run}/></section>
    <section id="ops-view-settings" className="ops-workspace-view" role="tabpanel" aria-labelledby="ops-tab-settings" tabIndex={0} hidden={tab!=='settings'}>{settings}</section>
  </div>;
}

