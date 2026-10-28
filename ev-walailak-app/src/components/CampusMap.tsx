import {MapPin} from 'lucide-react';

interface CampusMapProps {manager?:boolean}

export default function CampusMap({manager=false}:CampusMapProps){
  return <section className={`panel map-panel${manager?' manager-map-panel':''}`}>
    <div className="panel-heading map-heading"><div className="heading-with-icon"><MapPin size={17} aria-hidden="true"/><h2>ตำแหน่งรถ EV-01</h2></div></div>
    <div className="ops-live-map-empty" role="status"><strong>รอพิกัดจริงจากรถ</strong><span>บัญชีทดลองไม่มีข้อมูล GPS จาก EV-01 · เมื่อรถส่งพิกัดเข้าสู่ระบบ บัญชีจริงที่มีสิทธิ์จะเปิด Street View จากพิกัดนั้นได้</span></div>
  </section>;
}
