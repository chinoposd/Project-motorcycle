import { useCallback, useEffect, useState } from 'react';
import { displayTime } from './client';
import { loadDrivingRequests, reviewDrivingRequest, type DrivingPermissionRequest } from './drivingPermissionRequests';

export default function DrivingPermissionRequestsAdmin({ onChanged }: { onChanged: () => void }) {
  const [requests, setRequests] = useState<DrivingPermissionRequest[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [induction, setInduction] = useState<Record<string, boolean>>({});
  const [documentsVerified, setDocumentsVerified] = useState<Record<string, boolean>>({});
  const refresh = useCallback(async () => {
    const result = await loadDrivingRequests();
    setRequests(result.data);
    setError(result.error ?? '');
    setLoading(false);
  }, []);
  useEffect(() => { void refresh(); const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 10000); return () => window.clearInterval(timer); }, [refresh]);

  async function review(id: string, decision: 'approve' | 'reject') {
    const reason = reasons[id]?.trim() ?? '';
    if (busy || reason.length < 5 || (decision === 'approve' && (!induction[id] || !documentsVerified[id]))) return;
    setBusy(true);
    setError('');
    const failure = await reviewDrivingRequest(id, decision, reason, induction[id] === true, documentsVerified[id] === true);
    if (failure) setError(failure);
    else { await refresh(); onChanged(); }
    setBusy(false);
  }

  const pending = requests.filter((request) => request.status === 'Pending');
  return <section className="panel ops-panel" aria-labelledby="driving-requests-title">
    <div className="panel-heading"><div><h2 id="driving-requests-title">คำขอสิทธิ์ขับรถ</h2><p className="muted">นักศึกษา บุคลากร และ Manager · ผู้ยื่นนำเอกสารการขับรถมายื่นให้ทีมงานตรวจสอบ</p></div><button className="button button-outline button-small" type="button" onClick={() => void refresh()}>โหลดใหม่</button></div>
    {error && <p className="admin-feedback error" role="alert">{error}</p>}
    {loading && <p role="status">กำลังโหลดคำขอ…</p>}
    {!loading && pending.length === 0 && <p className="ops-empty">ยังไม่มีคำขอรอตรวจ</p>}
    {pending.map((request) => <article className="ops-record" key={request.id}>
      <div className="panel-heading"><strong>{request.user_name} · {request.role}</strong><small>{displayTime(request.created_at)}</small></div>
      <label className="ops-check"><input type="checkbox" checked={documentsVerified[request.id] ?? false} onChange={(event) => setDocumentsVerified((current) => ({ ...current, [request.id]: event.target.checked }))} />ทีมงานตรวจสอบเอกสารการขับรถแล้ว</label>
      <label className="ops-field">เหตุผลผลพิจารณา
        <textarea rows={2} minLength={5} maxLength={1000} required value={reasons[request.id] ?? ''} onChange={(event) => setReasons((current) => ({ ...current, [request.id]: event.target.value }))} />
      </label>
      <label className="ops-check"><input type="checkbox" checked={induction[request.id] ?? false} onChange={(event) => setInduction((current) => ({ ...current, [request.id]: event.target.checked }))} />ยืนยันว่าผ่านการแนะนำการใช้รถแล้ว</label>
      <div className="ops-row"><button className="button button-primary button-small" type="button" disabled={busy || (reasons[request.id]?.trim().length ?? 0) < 5 || !induction[request.id] || !documentsVerified[request.id]} onClick={() => void review(request.id, 'approve')}>อนุมัติสิทธิ์ขับ</button><button className="button button-outline button-small" type="button" disabled={busy || (reasons[request.id]?.trim().length ?? 0) < 5} onClick={() => void review(request.id, 'reject')}>ปฏิเสธ</button></div>
    </article>)}
  </section>;
}
