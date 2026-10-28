import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { createServer } from 'vite';

test('Admin all-accounts view exposes every status and keeps demo data read-only', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { default: AdminPage } = await vite.ssrLoadModule('/src/pages/AdminPage.tsx');
    const html = renderToStaticMarkup(createElement(AdminPage, {
      authSource: 'demo', currentAdminId: 'demo-admin', onShowToast: () => undefined,
    }));
    assert.match(html, /บัญชีทั้งหมด/);
    for (const status of ['Pending', 'Approved', 'Rejected', 'Suspended']) {
      assert.match(html, new RegExp(status));
    }
    assert.match(html, /kamonchanok@example.edu/);
    assert.match(html, /thana@example.edu/);
    assert.match(html, /ข้อมูลตัวอย่าง · อ่านได้อย่างเดียว/);

    const { default: ApprovalStatusPage } = await vite.ssrLoadModule('/src/pages/ApprovalStatusPage.tsx');
    const statusHtml = renderToStaticMarkup(createElement(ApprovalStatusPage, {
      user: {
        id: 'suspended-user', email: 'user@example.edu', name: 'ผู้ใช้ทดสอบ', role: 'Student',
        authSource: 'supabase', accountStatus: 'Suspended', accountStatusReason: 'สิทธิ์สังกัดหมดอายุ',
      },
      onLogout: () => undefined,
    }));
    assert.match(statusHtml, /เหตุผล:.*สิทธิ์สังกัดหมดอายุ/);
  } finally {
    await vite.close();
  }
});
