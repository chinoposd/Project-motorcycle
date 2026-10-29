import {supabase} from '../../auth/supabaseClient';
import type {Json} from '../../auth/database.types';
import type {OperationsSnapshot,MyOperations,OpsSession} from './types';
export type OpsResult<T>={data:T;error:null}|{data:null;error:string};
function failure(code?:string,message=''):string {
  if(code==='PGRST202'||code==='42883'||code==='42P01')return 'ยังไม่ได้ติดตั้ง migration Adminx3 ในระบบนี้ · เครื่องมือเดิมยังเปิดใช้ได้';
  if(code==='40001')return 'ข้อมูลเปลี่ยนระหว่างดำเนินการ · โหลดใหม่แล้วตรวจข้อมูลล่าสุด';
  if(code==='42501')return `สิทธิ์หรือเงื่อนไขบัญชีไม่อนุญาต: ${message}`;
  if(code==='22023'||code==='23514'||code==='23505')return `ยังดำเนินการไม่ได้: ${message}`;
  return 'เชื่อมต่อระบบไม่สำเร็จ · ลองโหลดใหม่อีกครั้ง';
}
async function result<T>(request:PromiseLike<{data:unknown;error:{code?:string;message:string}|null}>):Promise<OpsResult<T>>{
  try{const response=await request;return response.error?{data:null,error:failure(response.error.code,response.error.message)}:{data:response.data as T,error:null};}
  catch{return {data:null,error:'เชื่อมต่อระบบไม่สำเร็จ · ข้อมูลที่กรอกยังอยู่ในหน้านี้'};}
}
const unavailable={data:null,error:'ต้องเข้าสู่ระบบบัญชีจริงก่อนดำเนินการ'} as const;
export async function loadOperations(date:string):Promise<OpsResult<OperationsSnapshot>>{
  if(!supabase)return unavailable;
  const response=await result<OperationsSnapshot>(supabase.rpc('admin_operations_snapshot',{p_date:date}));
  if(response.data && (!Array.isArray(response.data.appeals)||!Array.isArray(response.data.alerts)||!response.data.config||!response.data.vehicle||!response.data.daily_report))return {data:null,error:'ข้อมูล Adminx3 ยังไม่ครบ · ตรวจการติดตั้ง migration แล้วโหลดใหม่'};
  return response;
}
export function runOperation(action:string,payload:Record<string,unknown>):Promise<OpsResult<unknown>>{
  return supabase?result(supabase.rpc('admin_operations_action',{p_action:action,p_payload:payload as Json})):Promise.resolve(unavailable);
}
export function loadMyOperations():Promise<OpsResult<MyOperations>>{
  if(!supabase)return Promise.resolve(unavailable);
  return result<MyOperations>(supabase.rpc('my_operations_snapshot')).then(response=>response.data&&(!response.data.account||!Array.isArray(response.data.appeals)||!Array.isArray(response.data.trips))
    ?{data:null,error:'ข้อมูลบัญชีและ Session ยังไม่ครบ · ตรวจการติดตั้ง migration Adminx3 แล้วโหลดใหม่'}:response);
}
export function runUserOperation(action:string,payload:Record<string,unknown>):Promise<OpsResult<unknown>>{
  return supabase?result(supabase.rpc('user_operations_action',{p_action:action,p_payload:payload as Json})):Promise.resolve(unavailable);
}
export function requestWebSession(inspection:boolean,terms:boolean,requestId:string):Promise<OpsResult<OpsSession>>{
  return supabase?result(supabase.rpc('request_web_session',{p_inspection_confirmed:inspection,p_terms_confirmed:terms,p_request_id:requestId})):Promise.resolve(unavailable);
}
export function ownerSessionAction(id:string,action:string):Promise<OpsResult<OpsSession>>{
  return supabase?result(supabase.rpc('session_owner_action',{p_session_id:id,p_action:action})):Promise.resolve(unavailable);
}
export const bangkokDay=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export {displayTime} from './formatTime';
export function localTimeInput(value:string|null):string {if(!value)return '';const date=new Date(value);return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);}
