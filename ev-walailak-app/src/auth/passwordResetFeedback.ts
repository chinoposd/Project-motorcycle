import type { PasswordResetResult } from './passwordResetRequest.ts';

export function getPasswordResetFeedback(result: PasswordResetResult): { tone: 'success' | 'error'; message: string } {
  if (result.ok) {
    return {
      tone: 'success',
      message: 'ถ้าอีเมลนี้เป็นบัญชีผู้ใช้จริงของระบบ เราจะส่งลิงก์รีเซ็ตรหัสผ่านให้',
    };
  }

  switch (result.reason) {
    case 'invalid-email':
      return { tone: 'error', message: 'กรุณากรอกอีเมลให้ถูกต้อง' };
    case 'not-configured':
      return { tone: 'error', message: 'ระบบส่งลิงก์ยังไม่ได้ตั้งค่า · ติดต่อผู้ดูแลระบบ' };
    case 'request-failed':
      return { tone: 'error', message: 'ส่งคำขอไม่สำเร็จ · ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่' };
  }
}
