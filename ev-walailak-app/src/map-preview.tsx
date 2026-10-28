import {createRoot} from 'react-dom/client';
import VehicleLiveMap from './features/operations/VehicleLiveMap';
import './styles.css';

function Preview(){
  return <main style={{maxWidth:900,margin:'40px auto',padding:16}}><section className="panel ops-panel">
    <h2>ตำแหน่งรถ EV-01 จาก GPS จริง</h2>
    <VehicleLiveMap fix={{latitude:null,longitude:null,gpsAt:null,fresh:null,sessionActive:false}}/>
    <p className="muted">รถยังไม่ส่งพิกัดเข้าสู่ระบบ หน้าตัวอย่างนี้จึงไม่แสดงตำแหน่งสมมติ</p>
    <a className="button button-primary" href="/LoginPage">เข้าสู่ระบบเพื่อดูข้อมูลรถจริง</a>
  </section></main>;
}

createRoot(document.getElementById('root')!).render(<Preview/>);
