import { Bike, LocateFixed, MapPin, Minus, Plus } from 'lucide-react';
import {streetViewUrl} from '../features/operations/streetViewUrl';

const demoStreetView=streetViewUrl(8.6416,99.89747);

interface CampusMapProps {
  manager?: boolean;
}

export default function CampusMap({ manager = false }: CampusMapProps) {
  return (
    <section className={`panel map-panel${manager ? ' manager-map-panel' : ''}`}>
      <div className="panel-heading map-heading">
        <div className="heading-with-icon"><MapPin size={17} aria-hidden="true" /><h2>{manager ? 'แผนที่ตำแหน่งรถและพื้นที่ใช้งาน' : 'ตำแหน่งรถในมหาวิทยาลัย'}</h2></div>
        {manager && <div className="map-legend"><span><i className="legend-line geofence-line" />Main Geofence</span><span><i className="legend-line return-line" />Return Zone</span></div>}
      </div>
      <div className="campus-map" role="img" aria-label="แผนที่จำลองแสดงตำแหน่งรถ EV-01 ภายในมหาวิทยาลัย">
        <svg className="map-art" viewBox="0 0 1000 360" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <rect width="1000" height="360" fill="#e8f0f8" />
          <path d="M0 34 170 0l112 58-40 102L54 178 0 142ZM719 0h281v104l-102 43-88-61-91 9ZM0 276l112-26 98 61-29 49H0ZM814 247l116-61 70 35v139H764Z" fill="#dbeafe" />
          <path d="M290 0h112l42 86-61 36-105-29-18-45ZM515 239l92-45 80 42-26 83H525ZM95 74l98-21 31 55-59 60-81-18ZM690 56l72-39 60 46-27 66-88 2Z" fill="#dcebdc" />
          <g fill="none" stroke="#fff" strokeLinecap="round" strokeLinejoin="round">
            <path d="M-25 221 165 156 328 175 481 116 636 132 805 71 1022 105" strokeWidth="22" />
            <path d="M86-22 155 84 232 155 268 256 337 383" strokeWidth="17" />
            <path d="M404-12 422 81 519 149 532 233 613 376" strokeWidth="18" />
            <path d="M685-15 651 76 712 145 786 193 802 273 908 373" strokeWidth="20" />
            <path d="M-20 310 142 266 275 288 402 246 554 270 695 226 838 250 1021 210" strokeWidth="15" />
            <path d="M-12 75 118 115 226 99 333 57 478 69 603 26 743 34 863-5" strokeWidth="13" />
          </g>
          <g fill="#cfdae7" opacity=".72">
            <rect x="300" y="133" width="74" height="38" rx="5" /><rect x="367" y="177" width="98" height="49" rx="5" />
            <rect x="548" y="54" width="62" height="44" rx="5" /><rect x="742" y="171" width="82" height="35" rx="5" />
            <rect x="134" y="193" width="74" height="39" rx="5" /><rect x="835" y="82" width="72" height="49" rx="5" />
          </g>
          {manager && <path d="M91 220 130 105 282 53 436 75 572 42 700 76 739 170 822 202 788 275 631 302 477 282 339 316 193 290Z" fill="#2563eb0c" stroke="#2563eb" strokeWidth="3" strokeDasharray="10 8" />}
          {manager && <ellipse cx="758" cy="261" rx="74" ry="46" fill="#93c5fd42" stroke="#60a5fa" strokeWidth="3" strokeDasharray="8 7" />}
          <g className="map-campus-labels" fill="#71839a" fontFamily="Segoe UI, Tahoma, sans-serif" fontSize="14">
            <text x="302" y="154">อาคารเรียนรวม</text><text x="684" y="197">ศูนย์กีฬา</text><text x="165" y="271">ถนนมหาวิทยาลัย</text>
            {manager && <><text x="516" y="210">อาคารบริหาร</text><text x="739" y="326">จุดคืนรถ</text></>}
          </g>
          <g className="vehicle-pin" transform="translate(492 168)">
            <circle r="25" fill="#2563eb" stroke="#fff" strokeWidth="5" />
            <g fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="-5" cy="4" r="3" /><circle cx="5" cy="4" r="3" />
              <path d="m-5 4 3-8h4l3 8m-7-8 2 8h5m-5-9h-3" />
            </g>
            <path d="M-7 20h14l-7 12z" fill="#2563eb" />
          </g>
          <g transform="translate(527 152)"><rect width="68" height="30" rx="15" fill="#fff" stroke="#dbe5f0" /><text x="34" y="20" textAnchor="middle" fill="#1b2b40" fontSize="13" fontWeight="700" fontFamily="Segoe UI, Tahoma, sans-serif">EV-01</text></g>
        </svg>
        <div className="map-toolbar" aria-hidden="true"><span><Plus size={15} /></span><span><Minus size={15} /></span><span><LocateFixed size={15} /></span></div>
        <div className="map-timestamp"><Bike size={13} aria-hidden="true" /> GPS ล่าสุด {manager ? '10:42:16' : '10:42:16'} · แผนที่จำลอง</div>
      </div>
      {demoStreetView&&<div className="ops-street-view-action"><a className="button button-outline" href={demoStreetView} target="_blank" rel="noopener noreferrer">เปิด Street View พิกัดตัวอย่าง</a><small>ตำแหน่งตัวอย่างในมหาวิทยาลัย ไม่ใช่ GPS ของ EV-01 · เมื่อกดจะเปิด Google</small></div>}
    </section>
  );
}
