import {verifyGatewayRequest} from '../_shared/gateway-auth.ts';
import {signOfflineManifest,type OfflineManifest} from '../_shared/offline-manifest.ts';
import {serverRpc} from '../_shared/server-rpc.ts';

Deno.serve(async(request:Request)=>{
  const path=new URL(request.url).pathname;
  const secret=Deno.env.get('VEHICLE_GATEWAY_SECRET')??'';
  const url=Deno.env.get('SUPABASE_URL')??'';const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??'';
  const body=await request.text();
  if(body.length>65536) return Response.json({error:'Payload too large'},{status:413});
  if(!await verifyGatewayRequest(secret,request.headers.get('x-vehicle-timestamp')??'',request.headers.get('x-vehicle-signature')??'',request.method,path,body)) return Response.json({error:'Unauthorized vehicle'},{status:401});
  try {
    if(request.method==='GET' && path.endsWith('/commands')) return Response.json(await serverRpc(url,key,'gateway_pending_commands',{}));
    if(request.method==='POST' && path.endsWith('/events')) {
      const event=JSON.parse(body);
      if(event.kind==='telemetry') {
        event.protocol_verified=Deno.env.get('HARDWARE_PROTOCOL_APPROVED')==='true';
        event.offline_protocol_verified=Deno.env.get('HARDWARE_OFFLINE_PROTOCOL_APPROVED')==='true';
      }
      return Response.json(await serverRpc(url,key,'vehicle_ingest_event',{p_event:event}));
    }
    if(request.method==='POST' && path.endsWith('/manifest')) {
      if(Deno.env.get('HARDWARE_OFFLINE_PROTOCOL_APPROVED')!=='true') return Response.json({error:'Offline protocol awaits physical validation'},{status:409});
      const lifetime=Number(Deno.env.get('OFFLINE_MANIFEST_LIFETIME_SECONDS'));
      const keyId=Deno.env.get('OFFLINE_MANIFEST_KEY_ID');const jwk=Deno.env.get('OFFLINE_MANIFEST_PRIVATE_JWK');
      if(!keyId||!jwk||!Number.isInteger(lifetime)||lifetime<=0||lifetime>86400) return Response.json({error:'Signing configuration is not ready'},{status:503});
      const payload=await serverRpc(url,key,'gateway_prepare_manifest',{p_lifetime_seconds:lifetime,p_key_id:keyId}) as OfflineManifest;
      return Response.json(await signOfflineManifest(payload,JSON.parse(jwk)));
    }
    return Response.json({error:'Route not found'},{status:404});
  }catch(error){return Response.json({error:error instanceof Error?error.message:'Vehicle operation failed'},{status:400});}
});
