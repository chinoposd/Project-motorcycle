export function streetViewUrl(latitude:number,longitude:number):string|null {
  if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180)return null;
  const url=new URL('https://www.google.com/maps/@');
  url.searchParams.set('api','1');
  url.searchParams.set('map_action','pano');
  url.searchParams.set('viewpoint',`${latitude},${longitude}`);
  return url.toString();
}

export function streetViewEmbedUrl(latitude:number,longitude:number,key:string|undefined):string|null {
  if(!key?.startsWith('AIza')||key.length<30||!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180)return null;
  const url=new URL('https://www.google.com/maps/embed/v1/streetview');
  url.searchParams.set('key',key);
  url.searchParams.set('location',`${latitude},${longitude}`);
  url.searchParams.set('language','th');
  return url.toString();
}
