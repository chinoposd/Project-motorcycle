import { useEffect, useState } from 'react';
import { cancelDrivingRequest, loadMyDrivingRequest, submitDrivingRequest, type DrivingPermissionRequest } from './drivingPermissionRequests';

export default function DrivingPermissionRequestPanel({ userId, approved, permitted }: { userId: string; approved: boolean; permitted: boolean }) {
  const [request, setRequest] = useState<DrivingPermissionRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const refresh = () => { void loadMyDrivingRequest().then((result) => {
      if (!active) return;
      setRequest(result.data);
      setError(result.error ?? '');
      setLoading(false);
    }); };
    refresh();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 10000);
    return () => { active = false; window.clearInterval(timer); };
  }, [userId]);

  async function submit() {
    if (busy || !approved || permitted) return;
    setBusy(true);
    setError('');
    const result = await submitDrivingRequest();
    if (result) setError(result);
    else {
      const refreshed = await loadMyDrivingRequest();
      setRequest(refreshed.data);
      setError(refreshed.error ?? '');
    }
    setBusy(false);
  }

  async function cancel() {
    if (busy || request?.status !== 'Pending' || !window.confirm('ยืนยันยกเลิกคำขอสิทธิ์ขับรถ?')) return;
    setBusy(true);
    setError('');
    const result = await cancelDrivingRequest();
    if (result) setError(result);
    else {
      const refreshed = await loadMyDrivingRequest();
      setRequest(refreshed.data);
      setError(refreshed.error ?? '');
    }
    setBusy(false);
  }

  if (permitted) return null;
  return <div className="driving-request-panel">
    {!approved ? <small>ยื่นขอสิทธิ์ขับรถได้หลังบัญชีได้รับอนุมัติ</small>
      : loading ? <small role="status">กำลังตรวจสถานะคำขอ…</small>
      : <>
        {request?.status === 'Pending' && <><small role="status">ส่งคำขอแล้ว · กรุณานำเอกสารการขับรถมายื่นให้ทีมงานตรวจสอบ เมื่อทีมงานตรวจเอกสารแล้ว Admin จึงจะพิจารณาให้สิทธิ์ขับรถ</small><button className="button button-outline button-small" type="button" disabled={busy} onClick={() => void cancel()}>{busy ? 'กำลังดำเนินการ…' : 'ยกเลิกคำขอ'}</button></>}
        {request?.status === 'Rejected' && <small>คำขอถูกปฏิเสธ: {request.decision_reason} · สามารถยื่นใหม่ได้</small>}
        {request?.status === 'Cancelled' && <small>คุณยกเลิกคำขอแล้ว · สามารถยื่นใหม่ได้</small>}
        {request?.status !== 'Pending' && <><small>หลังส่งคำขอ กรุณานำเอกสารการขับรถมายื่นให้ทีมงานตรวจสอบ</small><button className="button button-outline button-small" type="button" disabled={busy} onClick={() => void submit()}>{busy ? 'กำลังส่ง…' : 'ยื่นขอสิทธิ์ขับรถ'}</button></>}
      </>}
    {error && <small className="ops-warning" role="alert">{error}</small>}
  </div>;
}
