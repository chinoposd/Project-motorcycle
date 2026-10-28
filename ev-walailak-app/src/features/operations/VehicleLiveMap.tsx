import {useEffect,useState} from 'react';
import {displayTime} from './client';
import type {Zone} from './types';
import {vehicleMapState,type VehicleMapFix} from './vehicleMapState';

type Point=[number,number];
const validPoint=([longitude,latitude]:Point)=>Number.isFinite(latitude)&&Number.isFinite(longitude)&&Math.abs(latitude)<=90&&Math.abs(longitude)<=180;

export default function VehicleLiveMap({fix,zones=[],title='ตำแหน่งรถ EV-01'}:{fix:VehicleMapFix;zones?:Zone[];title?:string}){
  const [now,setNow]=useState(Date.now());
  useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),5000);return()=>window.clearInterval(timer);},[]);
  const state=vehicleMapState(fix,now);
  if(state.kind==='waiting')return <div className="ops-live-map-empty" role="status"><strong>รอข้อมูลพิกัดจากรถ</strong><span>แผนที่จะแสดงเมื่อรถส่ง GPS จริงเข้าสู่ระบบ</span></div>;

  const visibleZones=zones.filter(zone=>zone.active).map(zone=>({kind:zone.kind,points:zone.geometry.coordinates[0]?.filter((point):point is Point=>point.length===2&&validPoint(point as Point))??[]})).filter(zone=>zone.points.length>=3);
  const allPoints:Point[]=[[state.longitude,state.latitude],...visibleZones.flatMap(zone=>zone.points)];
  const longitudes=allPoints.map(point=>point[0]),latitudes=allPoints.map(point=>point[1]);
  const minLon=Math.min(...longitudes),maxLon=Math.max(...longitudes),minLat=Math.min(...latitudes),maxLat=Math.max(...latitudes);
  const width=Math.max(maxLon-minLon,0.003),height=Math.max(maxLat-minLat,0.003);
  const west=(minLon+maxLon)/2-width*0.65,north=(minLat+maxLat)/2+height*0.65;
  const scaleX=560/(width*1.3),scaleY=300/(height*1.3);
  const x=(longitude:number)=>(longitude-west)*scaleX;
  const y=(latitude:number)=>(north-latitude)*scaleY;
  const label=state.kind==='live'?'พิกัดจากรถล่าสุด':state.kind==='stale'?'พิกัดเก่าหรือไม่ยืนยัน · ไม่ใช่ตำแหน่งสด':'พิกัดล่าสุด · ไม่มี Session ที่กำลังขับ';
  return <figure className="ops-live-map">
    <svg viewBox="0 0 560 300" role="img" aria-label={title} className="ops-live-map-plot">
      <rect width="560" height="300" fill="#eef4fc"/>
      {[1,2,3,4].map(index=><g key={index} stroke="#cbdcf0" strokeWidth="1"><path d={`M ${index*112} 0 V 300`}/><path d={`M 0 ${index*60} H 560`}/></g>)}
      {visibleZones.map(zone=><polygon key={zone.kind} points={zone.points.map(([longitude,latitude])=>`${x(longitude)},${y(latitude)}`).join(' ')} fill={zone.kind==='main'?'#2563eb20':'#10a37f30'} stroke={zone.kind==='main'?'#2563eb':'#0b9876'} strokeWidth="2" strokeDasharray={zone.kind==='main'?'8 5':'5 4'}/>)}
      <circle cx={x(state.longitude)} cy={y(state.latitude)} r="16" fill={state.kind==='live'?'#2563eb':'#71819a'} stroke="white" strokeWidth="4"/>
      <circle cx={x(state.longitude)} cy={y(state.latitude)} r="4" fill="white"/>
      <text x={Math.min(x(state.longitude)+20,500)} y={Math.max(y(state.latitude)-10,22)} fill="#123257" fontSize="13" fontWeight="700">EV-01</text>
      <text x="12" y="22" fill="#536b88" fontSize="11">N ↑ · พิกัด GPS</text>
    </svg>
    <figcaption><span className={`ops-map-status ops-map-status-${state.kind}`}>{label}</span><span>GPS {displayTime(state.gpsAt)}</span><span>{state.latitude.toFixed(6)}, {state.longitude.toFixed(6)}</span></figcaption>
    {!!visibleZones.length&&<p className="ops-map-legend">{visibleZones.map(zone=><span key={zone.kind} className={`ops-map-legend-${zone.kind}`}>{zone.kind==='main'?'Main Geofence':'Return Zone'}</span>)}</p>}
    {state.kind==='stale'&&<p className="ops-warning">ไม่สามารถรับข้อมูลล่าสุดจากรถได้ · ตรวจสอบเวลาพิกัดก่อนตัดสินใจ</p>}
  </figure>;
}
