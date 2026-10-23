import { Check } from 'lucide-react';
import type { SessionStatus } from '../types';

interface SessionWorkflowProps {
  status: SessionStatus;
}

const workflowSteps = [
  {
    title: 'ตรวจสิทธิ์และความพร้อม',
    description: 'ตรวจสิทธิ์ผู้ขับ สถานะรถ และ Safety Block ก่อนเริ่ม',
  },
  {
    title: 'กำลังใช้งาน',
    description: 'ติดตามผู้ขับ Session และข้อมูลรถล่าสุด',
  },
  {
    title: 'รอจบ Session',
    description: 'คำขอจบยังไม่ใช่การปิดรอบหรือคืนรถสำเร็จ',
  },
  {
    title: 'ตรวจรถจริงและยืนยันปิดรอบ',
    description: 'Manager ตรวจรถและยืนยัน Pending End ก่อนคืนสถานะพร้อมใช้',
  },
];

export default function SessionWorkflow({ status }: SessionWorkflowProps) {
  const currentStep = status === 'idle' ? 0 : 1;
  const currentStatus = status === 'idle'
    ? 'รอตรวจสิทธิ์ก่อนเริ่ม'
    : status === 'paused'
      ? 'พักชั่วคราว · ยังเป็น Session เดิม'
      : 'กำลังใช้งาน · ติดตามข้อมูลรถล่าสุด';

  return (
    <section className="session-workflow" aria-labelledby="session-workflow-title">
      <div className="session-workflow-heading">
        <h3 id="session-workflow-title">ลำดับการทำงาน Session</h3>
        <span>ตัวอย่าง</span>
      </div>
      <p className="session-workflow-status">สถานะปัจจุบัน: <strong>{currentStatus}</strong></p>
      <ol className="session-workflow-steps" aria-label="ลำดับการทำงาน Session">
        {workflowSteps.map((step, index) => {
          const state = index < currentStep ? 'complete' : index === currentStep ? 'current' : 'upcoming';
          return (
            <li
              className={`session-workflow-step ${state}`}
              key={step.title}
              aria-current={state === 'current' ? 'step' : undefined}
            >
              <div className="session-workflow-step-heading">
                <span className="session-workflow-marker" aria-hidden="true">
                  {state === 'complete' ? <Check size={13} /> : index + 1}
                </span>
                <span className="session-workflow-state">{state === 'complete' ? 'เสร็จแล้ว' : state === 'current' ? 'ขั้นตอนปัจจุบัน' : 'ขั้นตอนถัดไป'}</span>
              </div>
              <strong>{step.title}</strong>
              <p>{step.description}</p>
            </li>
          );
        })}
      </ol>
      <p className="session-workflow-note">ตัวอย่างเท่านั้น · ไม่เปลี่ยนสถานะหรือสั่งรถจริง การรับทราบ Alert ไม่ได้ปลด Safety Block</p>
    </section>
  );
}

