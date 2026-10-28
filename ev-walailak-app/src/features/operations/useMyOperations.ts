import {useCallback,useEffect,useRef,useState} from 'react';
import {loadMyOperations,ownerSessionAction,requestWebSession,runUserOperation} from './client';
import type {MyOperations} from './types';

interface SnapshotState {userId:string|null;data:MyOperations|null;error:string;loading:boolean}
export function useMyOperations(userId:string|null,enabled:boolean,onShowToast:(message:string)=>void){
  const [state,setState]=useState<SnapshotState>({userId:null,data:null,error:'',loading:enabled});
  const [busyActor,setBusyActor]=useState<string|null>(null);const busy=busyActor===userId;const epoch=useRef(0);const identity=useRef(userId);identity.current=userId;
  const refresh=useCallback(async()=>{
    const current=++epoch.current;
    if(!enabled||!userId){setState({userId:null,data:null,error:'',loading:false});return;}
    setState(old=>({userId,data:old.userId===userId?old.data:null,error:old.userId===userId?old.error:'',loading:true}));
    const response=await loadMyOperations();
    if(current!==epoch.current||identity.current!==userId)return;
    setState({userId,data:response.data,error:response.error??'',loading:false});
  },[enabled,userId]);
  useEffect(()=>{void refresh();return()=>{epoch.current++;};},[refresh]);
  useEffect(()=>{if(!enabled||!userId)return;const refreshVisible=()=>{if(document.visibilityState==='visible')void refresh();};const timer=window.setInterval(refreshVisible,5000);window.addEventListener('focus',refreshVisible);return()=>{window.clearInterval(timer);window.removeEventListener('focus',refreshVisible);};},[enabled,userId,refresh]);
  async function mutate(operation:()=>Promise<{error:string|null}>,success:string):Promise<boolean>{
    if(!enabled||!userId||busy)return false;
    const actor=userId;setBusyActor(actor);const response=await operation();
    setBusyActor(current=>current===actor?null:current);
    if(identity.current!==actor)return false;
    if(response.error){setState(old=>old.userId===actor?{...old,error:response.error??''}:old);return false;}
    onShowToast(success);await refresh();return true;
  }
  const data=state.userId===userId&&enabled?state.data:null;
  return {data,error:state.userId===userId?state.error:'',loading:state.userId===userId?state.loading:enabled,busy,refresh,
    run:(action:string,payload:Record<string,unknown>)=>mutate(()=>runUserOperation(action,payload),'บันทึกคำขอแล้ว'),
    requestSession:(inspection:boolean,terms:boolean,requestId:string)=>mutate(()=>requestWebSession(inspection,terms,requestId),'ส่งคำขอเริ่ม Session แล้ว · รอรถยืนยัน Motor Ready'),
    sessionAction:(id:string,action:string)=>mutate(()=>ownerSessionAction(id,action),'ส่งคำขอ Session แล้ว · รอหลักฐานจากรถ')};
}
