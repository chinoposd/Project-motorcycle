import {useState} from 'react';
import {streetViewEmbedUrl,streetViewUrl} from '../features/operations/streetViewUrl';

interface Position {latitude:number;longitude:number}

export default function StreetViewSurface({latitude,longitude,title='Street View',demo=false}:{latitude:number;longitude:number;title?:string;demo?:boolean}){
  const [openedAt,setOpenedAt]=useState<Position|null>(null);
  const key=import.meta.env.VITE_GOOGLE_MAPS_EMBED_KEY as string|undefined;
  const canEmbed=streetViewEmbedUrl(latitude,longitude,key)!==null;
  const embedUrl=openedAt?streetViewEmbedUrl(openedAt.latitude,openedAt.longitude,key):null;
  const externalUrl=streetViewUrl(latitude,longitude);
  const open=()=>setOpenedAt({latitude,longitude});
  return <div className="street-view-surface" aria-label={title}>
    {embedUrl?<iframe className="street-view-frame" title={title} src={embedUrl} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen/>:
      <div className="street-view-launch"><span className="street-view-orb" aria-hidden="true">360°</span><strong>Google Street View</strong><p>{demo?'ตัวอย่างภาพถนนบริเวณมหาวิทยาลัย':'ภาพถนนใกล้พิกัด GPS ล่าสุดของรถ'}</p>
        {canEmbed?<button type="button" className="button button-primary" onClick={open}>แสดง Street View</button>:externalUrl?<a className="button button-primary" href={externalUrl} target="_blank" rel="noopener noreferrer">เปิด Street View ใน Google Maps</a>:null}
      </div>}
    {embedUrl&&<div className="street-view-controls"><button type="button" className="button button-outline button-small" onClick={open}>อัปเดตจากพิกัดล่าสุด</button><button type="button" className="button button-outline button-small" onClick={()=>setOpenedAt(null)}>ปิดภาพ</button>{externalUrl&&<a className="button button-outline button-small" href={externalUrl} target="_blank" rel="noopener noreferrer">เปิดใน Google Maps</a>}</div>}
    <small className="street-view-note">{demo?'ใช้พิกัดตัวอย่าง ไม่ใช่ตำแหน่งรถจริง':'เมื่อกดเปิด จะส่งพิกัดไป Google'} · ภาพถนนไม่ใช่ภาพสดและอาจไม่มีภาพในบางพื้นที่</small>
  </div>;
}
