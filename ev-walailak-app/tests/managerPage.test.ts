import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer, type ViteDevServer } from 'vite';

let viteServer: ViteDevServer | undefined;

after(async () => {
  await viteServer?.close();
});

test('manager overview avoids duplicate summaries and shows the Session workflow', async () => {
  viteServer ??= await createServer({
    configFile: './vite.config.ts',
    server: { middlewareMode: true },
    appType: 'custom',
  });
  const { default: ManagerPage } = await viteServer.ssrLoadModule('/src/pages/ManagerPage.tsx');
  const markup = renderToStaticMarkup(createElement(ManagerPage, {
    view: 'overview',
    onViewChange: () => {},
    alerts: [],
    issues: [],
    trips: [],
    monitoredSession: null,
    ownSession: null,
    onAcknowledge: () => {},
    sessionStatus: 'idle',
    onStartPause: () => {},
    onCancelReservation: () => {},
    onEnd: () => {},
    onLock: () => {},
    onOpenUtility: () => {},
    onShowToast: () => {},
  }));

  assert.equal(markup.includes('aria-label="สรุปสถานะการปฏิบัติงาน"'), false);
  assert.match(markup, /Session ปัจจุบัน/);
  assert.match(markup, /สถานะระบบรถ/);
  assert.match(markup, /สถิติรายวัน/);
  assert.match(markup, /ศูนย์แจ้งเตือน/);
  assert.match(markup, /ปัญหาและ Safety Block/);
  assert.match(markup, /ลำดับการทำงาน Session/);
  assert.match(markup, /ตรวจสิทธิ์และความพร้อม/);
  assert.match(markup, /รอจบ Session/);
  assert.match(markup, /ตรวจรถจริงและยืนยันปิดรอบ/);
  assert.match(markup, /ตัวอย่างเท่านั้น · ไม่เปลี่ยนสถานะหรือสั่งรถจริง/);
  assert.match(markup, /aria-current="step"/);
});

