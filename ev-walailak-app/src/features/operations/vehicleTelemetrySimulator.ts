import type {VehicleMapFix} from './vehicleMapState.ts';

export type VehicleTelemetrySimulatorMode='empty'|'live'|'stale'|'offline';
export interface VehicleTelemetrySample {mode:VehicleTelemetrySimulatorMode;fix:VehicleMapFix}

const sampleRoute=[
  {latitude:8.641,longitude:99.898},
  {latitude:8.6417,longitude:99.8988},
  {latitude:8.6424,longitude:99.8995},
  {latitude:8.6431,longitude:99.8987},
] as const;

const OLD_FIX_AGE_MS=2*60_000;
const OFFLINE_FIX_AGE_MS=5*60_000;

export function createVehicleTelemetrySample(
  mode:VehicleTelemetrySimulatorMode,
  now=Date.now(),
  routeStep=0,
):VehicleTelemetrySample{
  if(mode==='empty')return {mode,fix:{latitude:null,longitude:null,gpsAt:null,fresh:null,sessionActive:false}};

  const step=Number.isFinite(routeStep)?Math.trunc(routeStep):0;
  const routeIndex=((step%sampleRoute.length)+sampleRoute.length)%sampleRoute.length;
  const point=sampleRoute[routeIndex];
  const age=mode==='live'?0:mode==='stale'?OLD_FIX_AGE_MS:OFFLINE_FIX_AGE_MS;

  return {mode,fix:{
    ...point,
    gpsAt:new Date(now-age).toISOString(),
    fresh:mode==='live',
    sessionActive:mode!=='offline',
  }};
}