import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { createServer } from 'vite';

test('AppShell labels authenticated vehicle state as awaiting verified data', async () => {
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
    assert.match(html, /สถานะรถและ Session จะแสดงเมื่อมีข้อมูลที่ยืนยันจากระบบ/);
    assert.doesNotMatch(html, /หน้าจอนี้ใช้ข้อมูลจำลอง/);
  } finally {
    await vite.close();
  }
});
