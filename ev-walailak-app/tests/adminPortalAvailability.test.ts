import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { createServer } from 'vite';

test('Admin sections remain visible while portal data is unavailable', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { default: AdminPortalPanels } = await vite.ssrLoadModule('/src/pages/AdminPortalPanels.tsx');
    const html = renderToStaticMarkup(createElement(AdminPortalPanels, { isDemo: false, onShowToast: () => undefined }));

    for (const section of ['Driving Permission', 'เวลาเริ่ม Session', 'Cancellation / No-show', 'คำขอข้อมูลส่วนบุคคล', 'ประกาศโครงการ', 'Audit Log', 'สถานะการให้บริการรถ', 'Dashboard']) {
      assert.ok(html.includes(section), `${section} should remain discoverable`);
    }
    assert.match(html, /ยังโหลดบัญชี Approved ไม่ได้/);
    assert.match(html, /disabled=""/);
  } finally {
    await vite.close();
  }
});
