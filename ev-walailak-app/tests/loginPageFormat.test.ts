import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { createServer } from 'vite';

test('login renders demo shortcuts without account switching or the real-login link', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { default: LoginPage } = await vite.ssrLoadModule('/src/pages/LoginPage.tsx');
    const html = renderToStaticMarkup(createElement(LoginPage, { onLogin: () => undefined }));

    assert.doesNotMatch(html, /auth-mode-switch|เลือกประเภทบัญชี/);
    assert.doesNotMatch(html, /เข้าสู่ระบบบัญชีจริง/);
    assert.match(html, /บัญชีทดลอง/);
    for (const label of ['นักศึกษา', 'บุคลากร', 'ผู้จัดการ', 'ผู้ดูแลระบบ']) {
      assert.ok(html.includes(label), `Expected the original ${label} shortcut to render`);
    }
  } finally {
    await vite.close();
  }
});
