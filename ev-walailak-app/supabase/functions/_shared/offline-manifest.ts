export interface OfflineManifest {
  vehicle_id:string;version:number;issued_at:string;expires_at:string;key_id:string;cards:unknown[];
  [key:string]:unknown;
}

function canonical(value:unknown):string {
  if(Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if(value!==null && typeof value==='object') return `{${Object.entries(value).sort(([a],[b])=>a.localeCompare(b,'en')).map(([key,item])=>`${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  return JSON.stringify(value);
}

export async function signOfflineManifest(manifest:OfflineManifest,privateJwk:JsonWebKey):Promise<{payload:string;signature:string;algorithm:'Ed25519';key_id:string}> {
  const duration=Date.parse(manifest.expires_at)-Date.parse(manifest.issued_at);
  if(!Number.isFinite(duration) || duration<=0 || duration>86400000) throw new Error('Offline manifest lifetime must be positive and at most 24 hours');
  if(manifest.vehicle_id!=='EV-01' || !Number.isInteger(manifest.version) || manifest.version<1 || !manifest.key_id) throw new Error('Manifest vehicle, monotonic version and key id are required');
  const payload=canonical(manifest);
  const key=await crypto.subtle.importKey('jwk',privateJwk,'Ed25519',false,['sign']);
  const bytes=new Uint8Array(await crypto.subtle.sign('Ed25519',key,new TextEncoder().encode(payload)));
  return {payload,signature:btoa(String.fromCharCode(...bytes)),algorithm:'Ed25519',key_id:manifest.key_id};
}
