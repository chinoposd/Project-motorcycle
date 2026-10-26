import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { createServer } from 'vite';

test('Adminx3 keeps every workspace visible in an honest unavailable state',async()=>{
  const vite=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
  try{
    const {default:AdminPage}=await vite.ssrLoadModule('/src/pages/AdminPage.tsx');
    const html=renderToStaticMarkup(createElement(AdminPage,{authSource:'supabase',currentAdminId:'admin',onShowToast:()=>undefined}));
    for(const label of ['คำขออุทธรณ์บัญชี','ปฏิบัติการ','พื้นที่และติดต่อ','ข้อมูลส่วนบุคคล','ลงทะเบียน NFC','ตรวจสภาพก่อนขับ','รายงานรายวัน'])assert.ok(html.includes(label),label);
    assert.equal(html.includes('นภัส'),false);
    assert.match(html,/ยังไม่มีข้อมูลยืนยันจากรถ|กำลังโหลดข้อมูล/);
  }finally{await vite.close();}
});
