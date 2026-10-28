// Server functions only. Callers must authenticate before invoking this boundary.
export async function serverRpc(url:string,key:string,name:string,args:Record<string,unknown>):Promise<unknown> {
  const response=await fetch(`${url}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(args)});
  const data=await response.json();
  if(!response.ok) throw new Error(typeof data?.message==='string'?data.message:'Database operation failed');
  return data;
}
