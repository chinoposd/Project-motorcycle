import assert from 'node:assert/strict';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { createServer } from 'vite';

function renderWithLoginBrowserGlobals(element: ReactElement): string {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      location: { pathname: '/LoginPage', search: '', hash: '' },
      history: { state: null },
    },
  });

  try {
    return renderToStaticMarkup(element);
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
}

test('login renders demo shortcuts without account switching or the real-login link', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { default: LoginPage } = await vite.ssrLoadModule('/src/pages/LoginPage.tsx');
    const html = renderWithLoginBrowserGlobals(createElement(LoginPage, { onLogin: () => undefined }));

    assert.doesNotMatch(html, /auth-mode-switch|เลือกประเภทบัญชี/);
    assert.doesNotMatch(html, /เข้าสู่ระบบบัญชีจริง/);
    assert.match(html, /<input(?=[^>]*id="login-password")(?=[^>]*placeholder="xxxxxxxx")[^>]*>/);
    assert.match(html, /บัญชีทดลอง/);
    for (const label of ['นักศึกษา', 'บุคลากร', 'ผู้จัดการ', 'ผู้ดูแลระบบ']) {
      assert.ok(html.includes(label), `Expected the original ${label} shortcut to render`);
    }
  } finally {
    await vite.close();
  }
});

test('login exposes forgot-password without removing registration or demo shortcuts', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { default: LoginPage } = await vite.ssrLoadModule('/src/pages/LoginPage.tsx');
    const html = renderWithLoginBrowserGlobals(createElement(LoginPage, { onLogin: () => undefined }));

    assert.match(html, /<button(?=[^>]*type="button")(?=[^>]*>)[^<]*ลืมรหัสผ่าน\?/);
    assert.match(html, /ยังไม่มีบัญชีใช่ไหม\? สมัครสมาชิก/);
    for (const label of ['นักศึกษา', 'บุคลากร', 'ผู้จัดการ', 'ผู้ดูแลระบบ']) {
      assert.ok(html.includes(label), `Expected the ${label} demo shortcut to remain visible`);
    }
  } finally {
    await vite.close();
  }
});
