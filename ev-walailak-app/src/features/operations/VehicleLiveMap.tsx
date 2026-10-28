import {useEffect,useState} from 'react';
import StreetViewSurface from '../../components/StreetViewSurface';
import {displayTime} from './client';
import {vehicleMapState,type VehicleMapFix} from './vehicleMapState';

export default function VehicleLiveMap({fix,title='ตำแหน่งรถ EV-01'}:{fix:VehicleMapFix;title?:string}){
  const [now,setNow]=useState(Date.now());
  useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),5000);return()=>window.clearInterval(timer);},[]);
  const state=vehicleMapState(fix,now);
  if(state.kind==='waiting')return <div className="ops-live-map-empty" role="status"><strong>รอข้อมูลพิกัดจากรถ</strong><span>เปิด Street View ได้เมื่อรถส่ง GPS จริงเข้าสู่ระบบ</span></div>;
  const label=state.kind==='live'?'พิกัดจากรถล่าสุด':state.kind==='stale'?'พิกัดเก่าหรือไม่ยืนยัน · ไม่ใช่ตำแหน่งสด':'พิกัดล่าสุด · ไม่มี Session ที่กำลังขับ';
  return <figure className="ops-live-map">
    <StreetViewSurface latitude={state.latitude} longitude={state.longitude} title={title}/>
    <figcaption><span className={`ops-map-status ops-map-status-${state.kind}`}>{label}</span><span>GPS {displayTime(state.gpsAt)}</span><span>{state.latitude.toFixed(6)}, {state.longitude.toFixed(6)}</span></figcaption>
    {state.kind==='stale'&&<p className="ops-warning">ไม่สามารถรับข้อมูลล่าสุดจากรถได้ · ตรวจสอบเวลาพิกัดก่อนตัดสินใจ</p>}
  </figure>;
}
