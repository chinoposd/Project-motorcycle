import {serverRpc} from '../_shared/server-rpc.ts';

function sameSecret(a:string,b:string):boolean {
  if(a.length<32||a.length!==b.length)return false;
  let difference=0;for(let i=0;i<a.length;i++)difference|=a.charCodeAt(i)^b.charCodeAt(i);return difference===0;
}

Deno.serve(async(request:Request)=>{
  const expected=Deno.env.get('PRIVACY_WORKER_SECRET')??'';
  if(request.method!=='POST'||!sameSecret(expected,(request.headers.get('Authorization')??'').replace(/^Bearer /,'')))return Response.json({error:'Unauthorized worker'},{status:401});
  const url=Deno.env.get('SUPABASE_URL')??'';const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??'';
  const headers={apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'};
  const processed:unknown[]=[];
  try {
    await serverRpc(url,key,'operations_maintenance',{});
    for(let attempt=0;attempt<5;attempt++){
      const job=await serverRpc(url,key,'privacy_worker_claim',{}) as {id:string;lease_token:string;kind:string;subject_id:string}|null;
      if(!job)break;
      try {
        if(job.kind!=='access'){
          // Remove storage through its API; direct storage-table deletion does not remove the objects.
          let empty=false;
          for(let batch=0;batch<20;batch++){
            const response=await fetch(`${url}/storage/v1/object/list/profile-photos`,{method:'POST',headers,body:JSON.stringify({prefix:job.subject_id,limit:1000,offset:0})});
            if(!response.ok)throw new Error('Profile storage listing failed');
            const objects=await response.json() as {name:string}[];
            if(!objects.length){empty=true;break;}
            const removed=await fetch(`${url}/storage/v1/object/profile-photos`,{method:'DELETE',headers,body:JSON.stringify({prefixes:objects.map(item=>`${job.subject_id}/${item.name}`)})});
            if(!removed.ok)throw new Error('Profile storage cleanup failed');
          }
          if(!empty)throw new Error('Storage cleanup needs another verified retry');
          await serverRpc(url,key,'privacy_worker_purge',{p_job_id:job.id,p_lease_token:job.lease_token});
          const removed=await fetch(`${url}/auth/v1/admin/users/${job.subject_id}`,{method:'DELETE',headers});
          if(!removed.ok&&removed.status!==404)throw new Error('Auth account deletion failed');
        }
        processed.push(await serverRpc(url,key,'privacy_worker_finish',{p_job_id:job.id,p_lease_token:job.lease_token,p_result:{ok:true}}));
      }catch(error){
        const message=error instanceof Error?error.message:'Privacy worker failed';
        await serverRpc(url,key,'privacy_worker_finish',{p_job_id:job.id,p_lease_token:job.lease_token,p_result:{ok:false,error:message}});
        processed.push({id:job.id,status:'Failed'});
      }
    }
    return Response.json({processed});
  }catch{return Response.json({error:'Maintenance could not finish; inspect the recorded job status'},{status:500});}
});
