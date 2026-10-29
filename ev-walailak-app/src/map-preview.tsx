import {useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import VehicleLiveMap from './features/operations/VehicleLiveMap';
import {createVehicleTelemetrySample,type VehicleTelemetrySimulatorMode} from './features/operations/vehicleTelemetrySimulator';
import './styles.css';

const modes:{id:VehicleTelemetrySimulatorMode;label:string;description:string}[]=[
  {id:'empty',label:'รอพิกัด',description:'ไม่มีข้อมูลตำแหน่ง'},
  {id:'live',label:'GPS สด · จำลอง',description:'พิกัดจำลองเคลื่อนที่ทุก 4 วินาที'},
  {id:'stale',label:'พิกัดเก่า',description:'ทดสอบตำแหน่งที่เกินเวลา'},
  {id:'offline',label:'ออฟไลน์',description:'แสดงตำแหน่งล่าสุดก่อนรถขาดการเชื่อมต่อ'},
];

function Preview(){
  const [mode,setMode]=useState<VehicleTelemetrySimulatorMode>('empty');
  const [now,setNow]=useState(Date.now);
  const [routeStep,setRouteStep]=useState(0);

  useEffect(()=>{
    if(mode!=='live')return;
    const timer=window.setInterval(()=>{
      setNow(Date.now());
      setRouteStep(step=>step+1);
    },4_000);
    return()=>window.clearInterval(timer);
  },[mode]);

  const fix=createVehicleTelemetrySample(mode,now,routeStep);
  const selectedMode=modes.find(option=>option.id===mode)!;

  if(!import.meta.env.DEV)return <main className="map-preview-page"><section className="panel map-preview-card"><h1>หน้า Preview นี้ใช้ได้เฉพาะโหมดพัฒนา</h1><a className="button button-primary" href="/LoginPage">กลับหน้าเข้าสู่ระบบ</a></section></main>;

  return <main className="map-preview-page">
    <section className="panel map-preview-card">
      <div className="map-preview-heading"><div><span className="map-preview-eyebrow">EV Walailak · EV-01</span><h1>ทดลองสถานะแผนที่</h1></div><span className="map-preview-badge">DEV SIMULATOR</span></div>
      <div className="map-preview-disclaimer" role="note"><strong>ข้อมูลจำลองสำหรับพัฒนาเท่านั้น</strong><span>ไม่อ่านหรือเขียน Supabase · ไม่ควบคุมรถ · ไม่ใช่ตำแหน่งจริง</span></div>
      <div className="map-preview-controls" role="group" aria-label="เลือกสถานะจำลองรถ">
        {modes.map(option=><button key={option.id} type="button" aria-pressed={mode===option.id} onClick={()=>{setNow(Date.now());setRouteStep(0);setMode(option.id);}}>{option.label}</button>)}
      </div>
      <p className="map-preview-state" role="status"><strong>{selectedMode.label}</strong><span>{selectedMode.description}</span></p>
      <VehicleLiveMap fix={fix.fix} simulated title="ตำแหน่งจำลอง EV-01"/>
      <a className="button button-outline map-preview-login" href="/LoginPage">กลับหน้าเข้าสู่ระบบ</a>
    </section>
  </main>;
}

createRoot(document.getElementById('root')!).render(<Preview/>);