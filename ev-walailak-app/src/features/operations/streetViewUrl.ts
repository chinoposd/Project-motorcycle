export function streetViewUrl(latitude:number,longitude:number):string|null {
  if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180)return null;
  const url=new URL('https://www.google.com/maps/@');
  url.searchParams.set('api','1');
  url.searchParams.set('map_action','pano');
  url.searchParams.set('viewpoint',`${latitude},${longitude}`);
  return url.toString();
}
