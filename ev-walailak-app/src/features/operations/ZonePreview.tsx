import type {Zone} from './types';
export function geometryFromText(text:string):Zone['geometry']{
  const points=text.trim().split(/\n+/).filter(Boolean).map(line=>{
    const values=line.split(',').map(value=>Number(value.trim()));
    if(values.length!==2||values.some(value=>!Number.isFinite(value))||Math.abs(values[0]!)>90||Math.abs(values[1]!)>180)throw new Error('กรอกละติจูด, ลองจิจูดที่ถูกต้อง จุดละหนึ่งบรรทัด');
    return [values[1]!,values[0]!];
  });
  if(points.length<3)throw new Error('ต้องมีอย่างน้อย 3 จุด');
  if(points[0]![0]!==points.at(-1)![0]||points[0]![1]!==points.at(-1)![1])points.push([...points[0]!]);
  return {type:'Polygon',coordinates:[points]};
}
export function textFromGeometry(geometry:Zone['geometry']|undefined):string{return geometry?.coordinates[0]?.slice(0,-1).map(([longitude,latitude])=>`${latitude}, ${longitude}`).join('\n')??'';}
export default function ZonePreview({geometry,label='ขอบเขตจากพิกัดที่กำหนด'}:{geometry:Zone['geometry']|null;label?:string}){
  const points=geometry?.coordinates[0]??[];
  if(!points.length)return <div className="ops-map-empty">ยังไม่ได้กำหนดพิกัดขอบเขต</div>;
  const minX=Math.min(...points.map(p=>p[0]!));const maxX=Math.max(...points.map(p=>p[0]!));const minY=Math.min(...points.map(p=>p[1]!));const maxY=Math.max(...points.map(p=>p[1]!));
  const range=Math.max(maxX-minX,maxY-minY,0.00001);const polygon=points.map(([x,y])=>`${40+(x!-minX)/range*480},${260-(y!-minY)/range*220}`).join(' ');
  const center=points.slice(0,-1).reduce((sum,p)=>[sum[0]!+p[0]!,sum[1]!+p[1]!],[0,0]).map(value=>value/(points.length-1));
  return <figure className="ops-zone-preview"><svg viewBox="0 0 560 300" role="img" aria-label={label}><defs><pattern id={`ops-grid-${label.replace(/\s/g,'')}`} width="28" height="28" patternUnits="userSpaceOnUse"><path d="M 28 0 L 0 0 0 28" fill="none" stroke="#dce7f4" strokeWidth="1"/></pattern></defs><rect width="560" height="300" fill="#f3f7fd"/><polygon points={polygon} fill="#3b82f633" stroke="#3078ed" strokeWidth="3"/><text x="520" y="30" fill="#345">N ↑</text>{points.slice(0,-1).map(([x,y],index)=><g key={index}><circle cx={40+(x!-minX)/range*480} cy={260-(y!-minY)/range*220} r="4" fill="#18416c"/><text x={48+(x!-minX)/range*480} y={254-(y!-minY)/range*220} fontSize="13" fill="#18416c">{index+1}</text></g>)}</svg><figcaption>{label} · <a href={`https://www.google.com/maps/search/?api=1&query=${center[1]},${center[0]}`} target="_blank" rel="noreferrer">เปิดจุดกึ่งกลางบน Google Maps</a></figcaption></figure>;
}
