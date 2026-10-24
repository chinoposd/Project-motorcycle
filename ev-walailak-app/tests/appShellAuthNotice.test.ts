import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { createServer } from 'vite';

test('AppShell says when Supabase handles the account but vehicle data is still a prototype', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { default: AppShell } = await vite.ssrLoadModule('/src/components/AppShell.tsx');
    const html = renderToStaticMarkup(createElement(AppShell, {
      authSource: 'supabase',
      page: 'home',
      user: { id: 'cloud-user', name: 'ผู้ใช้ทดสอบ', email: 'cloud@example.com', role: 'Student' },
      profilePhoto: null,
      onNavigate: () => undefined,
      onLogout: () => undefined,
      children: createElement('p', null, 'เนื้อหา'),
    }));

    assert.match(html, /บัญชีเชื่อมต่อ Supabase/);
    assert.match(html, /ข้อมูลรถและ Session เป็นข้อมูลตัวอย่าง/);
  } finally {
    await vite.close();
  }
});
