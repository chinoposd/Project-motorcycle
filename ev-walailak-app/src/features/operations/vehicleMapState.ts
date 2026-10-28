export interface VehicleMapFix {
  latitude:number|null;
  longitude:number|null;
  gpsAt:string|null;
  fresh:boolean|null;
  sessionActive:boolean;
}

export type VehicleMapState=
  | {kind:'waiting'}
  | {kind:'live'|'stale'|'last-known';latitude:number;longitude:number;gpsAt:string};

const GPS_MAX_AGE_MS=30_000;

export function vehicleMapState(fix:VehicleMapFix,now=Date.now()):VehicleMapState {
  const {latitude,longitude,gpsAt,fresh,sessionActive}=fix;
  if(latitude===null||longitude===null||!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180||!gpsAt)return {kind:'waiting'};
  const age=now-Date.parse(gpsAt);
  if(!Number.isFinite(age)||age<0||age>GPS_MAX_AGE_MS||fresh!==true)return {kind:'stale',latitude,longitude,gpsAt};
  return {kind:sessionActive?'live':'last-known',latitude,longitude,gpsAt};
}
