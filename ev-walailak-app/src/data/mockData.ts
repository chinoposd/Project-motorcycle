import type { AccountRecord, AlertRecord, DemoTripRecord, PrototypeAnnouncement } from '../types';

export const vehicle = {
  id: 'EV-01',
  name: 'รถต้นแบบ EV-01',
  battery: 74,
  gps: 'พร้อมใช้งาน',
  location: 'ภายใน Main Geofence',
  updatedAt: '10:42:18',
};

export const announcements: PrototypeAnnouncement[] = [
  { id: 'a1', title: 'ทดลองใช้งานระบบต้นแบบ', detail: 'โปรดตรวจสภาพรถและปฏิบัติตามคู่มือความปลอดภัย', time: 'วันนี้' },
  { id: 'a2', title: 'แนวปฏิบัติการใช้รถช่วงฝนตก', detail: 'ขับขี่ด้วยความระมัดระวังและหลีกเลี่ยงเส้นทางที่มีน้ำขัง', time: 'ประกาศโครงการ' },
  { id: 'a3', title: 'ปรับปรุงจุดคืนรถ', detail: 'ตรวจสอบ Return Zone ก่อนส่งคำขอจบ Session', time: 'ประกาศโครงการ' },
];

export const sessionHistory: DemoTripRecord[] = [
  { sessionId: 'trip-demo-student-1', userId: 'demo-student', driverName: 'นภัส พรหมดี', startedAt: '2026-10-26T10:18:00+07:00', endedAt: '2026-10-26T10:42:00+07:00', durationMinutes: 24, distanceKm: 3.8 },
  { sessionId: 'trip-demo-student-2', userId: 'demo-student', driverName: 'นภัส พรหมดี', startedAt: '2026-10-25T15:42:00+07:00', endedAt: '2026-10-25T16:14:00+07:00', durationMinutes: 32, distanceKm: 4.6 },
  { sessionId: 'trip-demo-employee-1', userId: 'demo-employee', driverName: 'บุคลากรทดลอง', startedAt: '2026-10-18T09:16:00+07:00', endedAt: '2026-10-18T09:35:00+07:00', durationMinutes: 19, distanceKm: 2.9 },
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
  { id: 'u1', name: 'กมลชนก ศรีสุข', email: 'kamonchanok@example.edu', role: 'Student', status: 'Pending', drivingPermission: false },
  { id: 'u2', name: 'นภัส พรหมดี', email: 'napas@example.edu', role: 'Student', status: 'Approved', drivingPermission: true },
  { id: 'u3', name: 'ธนา วัฒนกิจ', email: 'thana@example.edu', role: 'Employee', status: 'Suspended', drivingPermission: false },
];

