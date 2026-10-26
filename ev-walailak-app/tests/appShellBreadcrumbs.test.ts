import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { createServer } from 'vite';

test('AppShell shows a navigable breadcrumb for profile pages and the current manager subpage', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { default: AppShell } = await vite.ssrLoadModule('/src/components/AppShell.tsx');
    const sharedProps = {
      authSource: 'demo' as const,
      user: { id: 'manager-1', name: 'ผู้จัดการทดสอบ', email: 'manager@example.com', role: 'Manager' as const },
      profilePhoto: null,
      onNavigate: () => undefined,
      onLogout: () => undefined,
      children: createElement('p', null, 'เนื้อหา'),
    };

    const profileHtml = renderToStaticMarkup(createElement(AppShell, { ...sharedProps, page: 'manager-profile' }));
    assert.match(profileHtml, /<nav[^>]*aria-label="เส้นทางนำทาง"/);
    assert.match(profileHtml, /class="breadcrumb-link"[^>]*>Manager<\/button>/);
    assert.match(profileHtml, /class="breadcrumb-current" aria-current="page">โปรไฟล์ผู้จัดการ<\/span>/);

    const managerHtml = renderToStaticMarkup(createElement(AppShell, {
      ...sharedProps,
      page: 'manager',
      breadcrumbLabel: 'ขับขี่รถ',
    }));
    assert.match(managerHtml, /class="breadcrumb-current" aria-current="page">ขับขี่รถ<\/span>/);
  } finally {
    await vite.close();
  }
});
