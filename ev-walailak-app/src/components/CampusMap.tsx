import {MapPin} from 'lucide-react';
import StreetViewSurface from './StreetViewSurface';

interface CampusMapProps {manager?:boolean}

export default function CampusMap({manager=false}:CampusMapProps){
  return <section className={`panel map-panel${manager?' manager-map-panel':''}`}>
    <div className="panel-heading map-heading"><div className="heading-with-icon"><MapPin size={17} aria-hidden="true"/><h2>Street View บริเวณมหาวิทยาลัย</h2></div></div>
    <StreetViewSurface latitude={8.6416} longitude={99.89747} title="Street View พิกัดตัวอย่างของมหาวิทยาลัย" demo/>
  </section>;
}
