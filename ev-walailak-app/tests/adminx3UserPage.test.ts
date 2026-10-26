import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {test} from 'node:test';
import {createServer} from 'vite';

test('real driver screens show authoritative empty states and owner controls',async()=>{
  const vite=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
  try{
    const {default:LiveUserPage}=await vite.ssrLoadModule('/src/features/operations/LiveUserPage.tsx');
    const html=renderToStaticMarkup(createElement(LiveUserPage,{user:{id:'driver',name:'Test Driver',role:'Student',email:'driver@example.test',authSource:'supabase',accountStatus:'Approved',drivingPermission:true},data:null,loading:true,error:'',busy:false,onRefresh:async()=>undefined,onRun:async()=>false,onRequestSession:async()=>false,onSessionAction:async()=>false}));
    for(const label of ['Session จริง','ตรวจสภาพก่อนขับ','My Trips','รายงานปัญหารถ','คำเตือนใกล้เกณฑ์','ข้อมูลจากรถ'])assert.ok(html.includes(label),label);
    assert.equal(html.includes('นภัส'),false);
    assert.equal(html.includes('10:42:16'),false);
  }finally{await vite.close();}
});

test('real Manager operations use scoped alerts and report states',async()=>{
  const vite=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
  try{
    const {default:ManagerOperationsPage}=await vite.ssrLoadModule('/src/features/operations/ManagerOperationsPage.tsx');
    const html=renderToStaticMarkup(createElement(ManagerOperationsPage,{view:'overview',onViewChange:()=>undefined,data:null,loading:true,error:'',busy:false,onRefresh:async()=>undefined,onRun:async()=>false}));
    for(const label of ['ภาพรวมการปฏิบัติงาน','ศูนย์แจ้งเตือนปฏิบัติการ','รายงานรายวัน','Safety Block'])assert.ok(html.includes(label),label);
    assert.equal(html.includes('นภัส'),false);
    assert.equal(html.includes('12</strong>'),false);
  }finally{await vite.close();}
});

test('rejected and suspended accounts can reach appeal guidance without a fake success state',async()=>{
  const vite=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
  try{
    const {default:ApprovalStatusPage}=await vite.ssrLoadModule('/src/pages/ApprovalStatusPage.tsx');
    for(const status of ['Rejected','Suspended'] as const){
      const html=renderToStaticMarkup(createElement(ApprovalStatusPage,{user:{id:'blocked',name:'Blocked User',email:'blocked@example.test',role:'Student',authSource:'supabase',accountStatus:status,drivingPermission:false},onLogout:()=>undefined,operations:null}));
      assert.ok(html.includes('ขออุทธรณ์ผลบัญชี'));
      assert.ok(html.includes('ส่งคำขออุทธรณ์'));
      assert.ok(html.includes('disabled'));
      assert.equal(html.includes('อนุมัติอัตโนมัติ'),false);
    }
  }finally{await vite.close();}
});
