import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { createServer } from 'vite';
import type { PageId, UserRole } from '../src/types.ts';

test('AppShell shows navigable breadcrumb for a manager profile', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { default: AppShell } = await vite.ssrLoadModule('/src/components/AppShell.tsx');
    const html = renderToStaticMarkup(createElement(AppShell, {
      authSource: 'demo',
      page: 'manager-profile',
      user: { id: 'manager-1', name: 'ผู้จัดการทดสอบ', email: 'manager@example.com', role: 'Manager' },
      profilePhoto: null,
      onNavigate: () => undefined,
      onLogout: () => undefined,
      children: createElement('p', null, 'เนื้อหา'),
    }));

    assert.match(html, /<nav[^>]+aria-label="เส้นทางนำทาง"/);
    assert.match(html, /class="breadcrumb-link"[^>]*>Manager</);
    assert.match(html, /aria-current="page">โปรไฟล์ผู้จัดการ</);
  } finally {
    await vite.close();
  }
});

test('AppShell allows a subview label to identify the manager ride tab', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { default: AppShell } = await vite.ssrLoadModule('/src/components/AppShell.tsx');
    const html = renderToStaticMarkup(createElement(AppShell, {
      authSource: 'demo',
      page: 'manager',
      breadcrumbLabel: 'ขับขี่รถ',
      user: { id: 'manager-1', name: 'ผู้จัดการทดสอบ', email: 'manager@example.com', role: 'Manager' },
      profilePhoto: null,
      onNavigate: () => undefined,
      onLogout: () => undefined,
      children: createElement('p', null, 'เนื้อหา'),
    }));

    assert.match(html, /aria-current="page">ขับขี่รถ</);
  } finally {
    await vite.close();
  }
});

test('breadcrumb labels and parents cover each role landing page and profile page', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { default: AppShell } = await vite.ssrLoadModule('/src/components/AppShell.tsx');
    const cases: { role: UserRole; page: PageId; parent?: string; current: string }[] = [
      { role: 'Student', page: 'home', current: 'ภาพรวม' },
      { role: 'Employee', page: 'home', current: 'ภาพรวม' },
      { role: 'Manager', page: 'manager', current: 'ภาพรวมการปฏิบัติงาน' },
      { role: 'Admin', page: 'admin', current: 'จัดการระบบ' },
      { role: 'Student', page: 'ride', parent: 'ภาพรวม', current: 'ระหว่างใช้งาน' },
      { role: 'Employee', page: 'ride', parent: 'ภาพรวม', current: 'ระหว่างใช้งาน' },
      { role: 'Manager', page: 'ride', parent: 'Manager', current: 'ระหว่างใช้งาน' },
      { role: 'Student', page: 'profile-settings', parent: 'ภาพรวม', current: 'ตั้งค่าโปรไฟล์' },
      { role: 'Employee', page: 'profile-settings', parent: 'ภาพรวม', current: 'ตั้งค่าโปรไฟล์' },
      { role: 'Manager', page: 'manager-profile', parent: 'Manager', current: 'โปรไฟล์ผู้จัดการ' },
      { role: 'Admin', page: 'profile-settings', parent: 'จัดการระบบ', current: 'ตั้งค่าโปรไฟล์' },
    ];

    for (const { role, page, parent, current } of cases) {
      const html = renderToStaticMarkup(createElement(AppShell, {
        authSource: 'demo',
        page,
        ...(page === 'manager' ? { breadcrumbLabel: current } : {}),
        user: { id: `user-${role}`, name: 'ผู้ใช้ทดสอบ', email: `${role.toLowerCase()}@example.com`, role },
        profilePhoto: null,
        onNavigate: () => undefined,
        onLogout: () => undefined,
        children: createElement('p', null, 'เนื้อหา'),
      }));

      assert.match(html, /<nav[^>]+aria-label="เส้นทางนำทาง"/);
      assert.match(html, new RegExp(`aria-current="page">${current}</`));
      if (parent) assert.match(html, new RegExp(`class="breadcrumb-link"[^>]*>${parent}</`));
      else assert.doesNotMatch(html, /class="breadcrumb-link"/);
    }
  } finally {
    await vite.close();
  }
});

test('Manager ride-tab breadcrumb returns to the operational overview', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { default: AppShell } = await vite.ssrLoadModule('/src/components/AppShell.tsx');
    const html = renderToStaticMarkup(createElement(AppShell, {
      authSource: 'demo',
      page: 'manager',
      breadcrumbLabel: 'ขับขี่รถ',
      breadcrumbParent: { label: 'ภาพรวมการปฏิบัติงาน', onNavigate: () => undefined },
      user: { id: 'manager-1', name: 'ผู้จัดการทดสอบ', email: 'manager@example.com', role: 'Manager' },
      profilePhoto: null,
      onNavigate: () => undefined,
      onLogout: () => undefined,
      children: createElement('p', null, 'เนื้อหา'),
    }));

    assert.match(html, /class="breadcrumb-link"[^>]*>ภาพรวมการปฏิบัติงาน</);
    assert.match(html, /aria-current="page">ขับขี่รถ</);
  } finally {
    await vite.close();
  }
});
