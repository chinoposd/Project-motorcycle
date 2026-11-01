import { Activity, BatteryMedium, ShieldCheck } from 'lucide-react';
import type { MyOperations } from './types';

export default function ManagerRideInsights({ data, sessionStatus, demo = false }: { data: MyOperations | null; sessionStatus?: string; demo?: boolean }) {
  const reading = data?.vehicle_readiness;
  const fresh = reading?.fresh === true;
  const ai = !fresh || reading?.ai_ready == null ? 'กำลังตรวจสอบ' : reading.ai_ready ? 'พร้อมใช้งาน' : 'ไม่พร้อมใช้งาน';
  const battery = fresh && reading?.battery_percent != null ? `${reading.battery_percent}%` : 'รอข้อมูลจากรถ';
  const batteryState = !fresh || reading?.bms_ok == null ? 'กำลังตรวจสอบ' : reading.bms_ok ? 'BMS ปกติ · ระดับแบตยังไม่จัดประเภท' : 'BMS ไม่พร้อม';
  return <section className="manager-ride-insights" aria-label="สิทธิ์และสถานะรถสำหรับ Manager">
    <div className="manager-ride-permission"><span className="manager-insight-icon"><ShieldCheck size={21} /></span><div><h2>สิทธิ์การขับขี่ของ Manager</h2><p>เริ่มได้โดยยกเว้นเงื่อนไข AI, Main Geofence และตารางเวลา แต่ต้องมี Driving Permission และผ่านการตรวจสภาพรถ ความใกล้รถ BMS รถหยุดนิ่ง และคันเร่งเป็นศูนย์ทุกครั้ง</p></div></div>
    <div className="manager-ride-readings"><div><Activity size={18} /><span>ระบบ AI</span><strong>{demo ? 'พร้อมใช้งาน · ตัวอย่าง' : data ? ai : 'กำลังตรวจสอบ'}</strong></div><div><BatteryMedium size={18} /><span>แบตเตอรี่</span><strong>{demo ? '74% · ตัวอย่าง' : data ? battery : 'กำลังตรวจสอบ'}</strong><small>{demo ? 'ค่าจำลอง ไม่ใช่ข้อมูลจากรถ' : data ? batteryState : 'รอข้อมูลจากรถ'}</small></div></div>
    {sessionStatus === 'PendingEnd' && <p className="manager-ride-next-step">กำลังตรวจคืนรถ: จอดรถให้หยุดนิ่งใน Return Zone และรอรถยืนยันว่า Motor Ready ปิดแล้ว หากตรวจพิกัดรถไม่ได้ ให้ส่งพิกัดโทรศัพท์ด้านล่างหรือติดต่อเจ้าหน้าที่</p>}
  </section>;
}
