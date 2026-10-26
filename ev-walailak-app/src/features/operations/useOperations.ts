import {useCallback,useEffect,useRef,useState} from 'react';
import {loadOperations,runOperation} from './client';
import type {OperationsSnapshot} from './types';
export function useOperations(isDemo:boolean,date:string,onShowToast:(message:string)=>void,onChanged?:()=>void){
  const [data,setData]=useState<OperationsSnapshot|null>(null);const [loading,setLoading]=useState(!isDemo);const [error,setError]=useState('');const [busy,setBusy]=useState(false);const epoch=useRef(0);
  const refresh=useCallback(async()=>{
    const current=++epoch.current;if(isDemo){setLoading(false);return;}
    setLoading(true);const response=await loadOperations(date);if(current!==epoch.current)return;
    setData(response.data);setError(response.error??'');setLoading(false);
  },[isDemo,date]);
  useEffect(()=>{void refresh();return ()=>{epoch.current++;};},[refresh]);
  useEffect(()=>{if(isDemo)return;const refreshVisible=()=>{if(document.visibilityState==='visible')void refresh();};const timer=window.setInterval(refreshVisible,15000);window.addEventListener('focus',refreshVisible);return()=>{window.clearInterval(timer);window.removeEventListener('focus',refreshVisible);};},[isDemo,refresh]);
  async function run(action:string,payload:Record<string,unknown>):Promise<boolean>{
    if(isDemo||!data||busy)return false;setBusy(true);setError('');
    const response=await runOperation(action,payload);setBusy(false);
    if(response.error){setError(response.error);return false;}
    onShowToast('บันทึกการดำเนินการและ Audit แล้ว');await refresh();onChanged?.();return true;
  }
  return {data,loading,error,busy,refresh,run,disabled:isDemo||!data||busy};
}
