import type { AccountRecord, AlertRecord } from '../types';

export const vehicle = {
  id: 'EV-01',
  name: 'รถต้นแบบ EV-01',
  battery: 74,
  gps: 'พร้อมใช้งาน',
  location: 'ภายใน Main Geofence',
  updatedAt: '10:42:18',
};

export const announcements = [
  { id: 'a1', title: 'ทดลองใช้งานระบบต้นแบบ', detail: 'โปรดตรวจสภาพรถและปฏิบัติตามคู่มือความปลอดภัย', time: 'วันนี้' },
  { id: 'a2', title: 'แนวปฏิบัติการใช้รถช่วงฝนตก', detail: 'ขับขี่ด้วยความระมัดระวังและหลีกเลี่ยงเส้นทางที่มีน้ำขัง', time: 'ประกาศโครงการ' },
  { id: 'a3', title: 'ปรับปรุงจุดคืนรถ', detail: 'ตรวจสอบ Return Zone ก่อนส่งคำขอจบ Session', time: 'ประกาศโครงการ' },
];

export const sessionHistory = [
  { date: 'วันนี้ · 10:18', user: 'นภัส พรหมดี', duration: '24 นาที', distance: '3.8 กม.', status: 'เสร็จสมบูรณ์' },
  { date: 'เมื่อวาน · 15:42', user: 'กมลชนก ศรีสุข', duration: '32 นาที', distance: '4.6 กม.', status: 'เสร็จสมบูรณ์' },
  { date: '18 ต.ค. · 09:16', user: 'ธนา วัฒนกิจ', duration: '19 นาที', distance: '2.9 กม.', status: 'เสร็จสมบูรณ์' },
];

export const initialAlerts: AlertRecord[] = [
  {
    id: 'alert-1',
    title: 'รายงานระบบเบรก',
    description: 'ผู้ใช้รายงานปัญหา ต้องตรวจรถก่อนปลด Safety Block',
    time: '10:41 น.',
    severity: 'high',
    category: 'Safety Block',
    state: 'unread',
  },
  {
    id: 'alert-2',
    title: 'รถออกนอก Main Geofence',
    description: 'แจ้งเตือนและบันทึกเหตุการณ์ โดยไม่ลดกำลังมอเตอร์',
    time: '10:42 น.',
    severity: 'warning',
    category: 'Warning',
    state: 'unread',
  },
  {
    id: 'alert-3',
    title: 'GPS ขาดช่วงและกลับมาแล้ว',
    description: 'ระบบกลับมารับข้อมูลได้แล้ว เก็บประวัติเหตุการณ์ไว้',
    time: '10:36 น.',
    severity: 'info',
    category: 'Resolved',
    state: 'unread',
  },
];

export const systemHealth = [
  { name: 'GPS', value: 'พร้อม', detail: 'Fix 8 ดาวเทียม · 2 วินาทีที่แล้ว', state: 'good' },
  { name: 'BMS', value: 'ปกติ', detail: 'แบตเตอรี่ 74% · ไม่ได้ชาร์จ', state: 'good' },
  { name: 'AI / Camera', value: 'พร้อม', detail: 'Inference ทำงาน · ภาพล่าสุดสด', state: 'good' },
  { name: '4G Network', value: 'ออนไลน์', detail: 'Heartbeat 3 วินาทีที่แล้ว', state: 'good' },
  { name: 'Raspberry Pi', value: 'พร้อม', detail: 'Gateway เชื่อมต่อปกติ', state: 'good' },
  { name: 'Audio', value: 'กำลังตรวจสอบ', detail: 'ไม่ใช่เหตุ Block การเริ่มรถ', state: 'checking' },
];

export const initialAccounts: AccountRecord[] = [
  { id: 'u1', name: 'กมลชนก ศรีสุข', email: 'kamonchanok@example.edu', role: 'Student', status: 'Pending' },
  { id: 'u2', name: 'นภัส พรหมดี', email: 'napas@example.edu', role: 'Student', status: 'Approved' },
  { id: 'u3', name: 'ธนา วัฒนกิจ', email: 'thana@example.edu', role: 'Employee', status: 'Suspended' },
];

