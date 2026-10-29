export function displayTime(value:string|null|undefined):string{
  return value&&Number.isFinite(Date.parse(value))
    ?new Date(value).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})
    :'—';
}