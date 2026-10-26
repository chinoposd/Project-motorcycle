const encoder = new TextEncoder();

export async function signGatewayRequest(secret: string, timestamp: string, method: string, path: string, body: string): Promise<string> {
  if (secret.length < 32) throw new Error('A vehicle secret of at least 32 characters is required');
  const key = await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(`${timestamp}\n${method.toUpperCase()}\n${path}\n${body}`)));
  return Array.from(bytes,byte=>byte.toString(16).padStart(2,'0')).join('');
}

export async function verifyGatewayRequest(secret:string,timestamp:string,signature:string,method:string,path:string,body:string,now=Date.now()):Promise<boolean> {
  if (!/^\d{13}$/.test(timestamp) || Math.abs(now-Number(timestamp))>300000 || !/^[a-f0-9]{64}$/.test(signature) || secret.length<32) return false;
  const expected=await signGatewayRequest(secret,timestamp,method,path,body);
  let difference=0; for(let i=0;i<expected.length;i++) difference|=expected.charCodeAt(i)^signature.charCodeAt(i);
  return difference===0;
}
