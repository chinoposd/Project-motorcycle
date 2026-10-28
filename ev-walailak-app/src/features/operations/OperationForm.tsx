import {useState,type FormEvent,type ReactNode} from 'react';
export interface FormField {name:string;label:string;type?:'text'|'tel'|'textarea'|'number'|'datetime-local'|'date'|'checkbox'|'select';required?:boolean;min?:number;max?:number;options?:{value:string;label:string}[];placeholder?:string}
interface Props {fields:FormField[];initial?:Record<string,string|number|boolean|null|undefined>;onSubmit:(values:Record<string,unknown>)=>Promise<boolean>;disabled:boolean;label?:string;confirm?:string;children?:ReactNode}
export default function OperationForm({fields,initial={},onSubmit,disabled,label='บันทึกพร้อมเหตุผล',confirm,children}:Props){
  const [values,setValues]=useState<Record<string,string|number|boolean>>(()=>Object.fromEntries(fields.map(field=>[field.name,initial[field.name]??(field.type==='checkbox'?false:'')])));
  async function submit(event:FormEvent){event.preventDefault();if(disabled||(confirm&&!window.confirm(confirm)))return;await onSubmit(values);}
  return <form className="ops-form" onSubmit={event=>{void submit(event);}}><fieldset disabled={disabled}>
    {fields.map(field=><label className={field.type==='checkbox'?'ops-check':'ops-field'} key={field.name}>
      {field.type==='checkbox'?<><input type="checkbox" checked={Boolean(values[field.name])} required={field.required} onChange={event=>setValues({...values,[field.name]:event.target.checked})}/><span>{field.label}</span></>:<><span>{field.label}{field.required&&' *'}</span>{field.type==='textarea'?<textarea rows={3} required={field.required} minLength={field.required?5:undefined} maxLength={2000} value={String(values[field.name])} onChange={event=>setValues({...values,[field.name]:event.target.value})}/>:field.type==='select'?<select required={field.required} value={String(values[field.name])} onChange={event=>setValues({...values,[field.name]:event.target.value})}><option value="">เลือก…</option>{field.options?.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select>:<input type={field.type??'text'} required={field.required} min={field.min} max={field.max} step={field.type==='number'?'any':undefined} maxLength={2000} placeholder={field.placeholder} value={String(values[field.name])} onChange={event=>setValues({...values,[field.name]:event.target.value})}/>}</>}
    </label>)}{children}<button className="button button-primary" type="submit">{label}</button>
  </fieldset></form>;
}
export const reasonField:FormField={name:'reason',label:'เหตุผล / หลักฐานการดำเนินการ',type:'textarea',required:true};
export const inspectionField:FormField={name:'physical_inspection_confirmed',label:'ตรวจรถจริงและตรวจหลักฐานความปลอดภัยแล้ว',type:'checkbox',required:true};
