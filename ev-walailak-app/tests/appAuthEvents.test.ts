import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { moduleRunnerTransform, transformWithOxc } from 'vite';
import * as accountAccess from '../src/auth/accountAccess.ts';
import * as authRequestEpoch from '../src/auth/authRequestEpoch.ts';
import * as authSessionPolicy from '../src/auth/authSessionPolicy.ts';
import * as demoAuth from '../src/auth/demoAuth.ts';
import * as managerProfile from '../src/auth/managerProfile.ts';
import * as userProfile from '../src/auth/userProfile.ts';
import * as profilePhoto from '../src/auth/profilePhoto.ts';
import type { AppUser, SupabaseAuthResult } from '../src/auth/supabaseAuth.ts';

const admin: AppUser = {
  id: 'account-a', name: 'Admin A', email: 'a@example.com', role: 'Admin',
  authSource: 'supabase', accountStatus: 'Approved', drivingPermission: false,
};
const student: AppUser = {
  id: 'account-b', name: 'Student B', email: 'b@example.com', role: 'Student',
  authSource: 'supabase', accountStatus: 'Approved', drivingPermission: false,
};
const result = (user: AppUser): SupabaseAuthResult => ({ user, error: null });
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

// Execute App's actual registered auth callback. Only React's hook scheduler and
// cloud I/O are replaced; routing, identity policy, and request epochs stay real.
async function mountApp(initialEvent?: { event: string; id: string }) {
  const slots: unknown[] = [];
  let cursor = 0;
  let mounted = false;
  const effects: (() => void | (() => void))[] = [];
  const cleanups: (() => void)[] = [];
  const requests: { resolve: (value: SupabaseAuthResult) => void; reject: (error: Error) => void }[] = [];
  let listener: (event: string, session: { user: { id: string } } | null) => void;
  const modules: Record<string, unknown> = {
    './auth/accountAccess': accountAccess,
    './auth/authRequestEpoch': authRequestEpoch,
    './auth/authSessionPolicy': authSessionPolicy,
    './auth/demoAuth': demoAuth,
    './auth/managerProfile': managerProfile,
    './auth/userProfile': userProfile,
    './auth/profilePhoto': profilePhoto,
    './data/mockData': { initialAlerts: [] },
    './auth/supabaseClient': {
      supabaseConfig: { mode: 'configured' },
      supabase: { auth: { onAuthStateChange(callback: typeof listener) {
        listener = callback;
        if (initialEvent) callback(initialEvent.event, { user: { id: initialEvent.id } });
        return { data: { subscription: { unsubscribe() {} } } };
      } } },
    },
    './auth/supabaseAuth': {
      getCurrentSupabaseUser: () => new Promise<SupabaseAuthResult>((resolve, reject) => requests.push({ resolve, reject })),
      signOutSupabase: async () => undefined,
    },
    react: {
      useState(initial: unknown) {
        const index = cursor++;
        if (!mounted) slots[index] = typeof initial === 'function' ? initial() : initial;
        return [slots[index], (value: unknown) => {
          slots[index] = typeof value === 'function' ? value(slots[index]) : value;
        }];
      },
      useRef(initial: unknown) {
        const index = cursor++;
        if (!mounted) slots[index] = { current: initial };
        return slots[index];
      },
      useCallback: (callback: unknown) => callback,
      useEffect: (effect: () => void | (() => void)) => { if (!mounted) effects.push(effect); },
    },
    'react/jsx-runtime': {
      jsx: (type: string, props: Record<string, unknown>) => ({ type, props }),
      jsxs: (type: string, props: Record<string, unknown>) => ({ type, props }),
    },
  };
  const exports: { default?: () => { type: string; props: Record<string, any> } } = {};
  const source = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const transformed = await transformWithOxc(source, 'App.tsx', { jsx: { runtime: 'automatic' } });
  const transformedModule = await moduleRunnerTransform(transformed.code, null, 'App.tsx', source);
  await runInNewContext(`(async () => { ${transformedModule!.code} })()`, {
    __vite_ssr_exports__: exports,
    __vite_ssr_exportName__: (name: string, getter: () => unknown) => Object.defineProperty(exports, name, { get: getter }),
    queueMicrotask, async __vite_ssr_import__(id: string) {
    if (id in modules) return modules[id];
    if (id.startsWith('./pages/') || id.startsWith('./components/')) return { default: id.split('/').at(-1) };
    throw new Error(`Uninjected App dependency: ${id}`);
  } });
  const screen = () => { cursor = 0; return exports.default!(); };
  screen();
  mounted = true;
  for (const effect of effects) {
    const cleanup = effect();
    if (cleanup) cleanups.push(cleanup);
  }
  return {
    requests, screen,
    event: (event: string, id: string | null) => listener(event, id ? { user: { id } } : null),
    unmount: () => cleanups.forEach((cleanup) => cleanup()),
  };
}

test('TOKEN_REFRESHED supersedes an older profile request and the latest profile wins', async () => {
  const app = await mountApp();
  app.event('TOKEN_REFRESHED', admin.id);
  await flush();
  app.requests[0].resolve(result({ ...admin, name: 'Stale A' }));
  await flush();
  assert.notEqual(app.screen().type, 'AppShell', 'older restore cannot display its profile after refresh');
  assert.equal(app.requests.length, 2);
  app.requests[1].resolve(result({ ...admin, name: 'Latest A' }));
  await flush();
  assert.equal(app.screen().props.user.name, 'Latest A');
});

test('same-user TOKEN_REFRESHED updates the profile and preserves an allowed route', async () => {
  const app = await mountApp();
  app.requests[0].resolve(result(student));
  await flush();
  app.screen().props.onNavigate('ride');
  app.event('TOKEN_REFRESHED', student.id);
  await flush();
  assert.equal(app.requests.length, 2);
  app.requests[1].resolve(result({ ...student, name: 'Refreshed B' }));
  await flush();
  assert.equal(app.screen().props.user.name, 'Refreshed B');
  assert.equal(app.screen().props.page, 'ride');
});

for (const failure of ['error-result', 'rejection'] as const) {
  test(`switching A to B immediately gates A and never restores A on ${failure}`, async () => {
    const app = await mountApp();
    app.requests[0].resolve(result(admin));
    await flush();
    assert.equal(app.screen().props.page, 'admin');
    app.event('SIGNED_IN', student.id);
    assert.notEqual(app.screen().type, 'AppShell', 'old privileged shell must disappear synchronously');
    await flush();
    if (failure === 'rejection') app.requests[1].reject(new Error('network unavailable'));
    else app.requests[1].resolve({ user: null, error: 'request-failed' });
    await flush();
    assert.equal(app.screen().type, 'LoginPage');
  });
}

test('USER_UPDATED switches identity to validated B at B landing route', async () => {
  const app = await mountApp();
  app.requests[0].resolve(result(admin));
  await flush();
  app.event('USER_UPDATED', student.id);
  assert.notEqual(app.screen().type, 'AppShell');
  await flush();
  assert.equal(app.requests.length, 2);
  app.requests[1].resolve(result(student));
  await flush();
  assert.equal(app.screen().props.user.id, 'account-b');
  assert.equal(app.screen().props.page, 'home');
});

test('SIGNED_OUT invalidates the pending profile and leaves the login displayed', async () => {
  const app = await mountApp();
  app.event('SIGNED_IN', admin.id);
  await flush();
  app.event('SIGNED_OUT', null);
  for (const request of app.requests) request.resolve(result(admin));
  await flush();
  assert.equal(app.screen().type, 'LoginPage');
});

test('a profile result for a different session identity cannot be displayed', async () => {
  const app = await mountApp();
  app.event('SIGNED_IN', student.id);
  await flush();
  app.requests[1].resolve(result(admin));
  await flush();
  assert.equal(app.screen().type, 'LoginPage');
});

test('queued auth work cannot display a profile after unmount', async () => {
  const app = await mountApp();
  app.event('SIGNED_IN', admin.id);
  app.unmount();
  await flush();
  for (const request of app.requests) request.resolve(result(admin));
  await flush();
  assert.notEqual(app.screen().type, 'AppShell');
});

test('a synchronous INITIAL_SESSION event supersedes the startup restore request', async () => {
  const app = await mountApp({ event: 'INITIAL_SESSION', id: student.id });
  await flush();
  assert.equal(app.requests.length, 2);
  app.requests[0].resolve(result(admin));
  await flush();
  assert.notEqual(app.screen().type, 'AppShell');
  app.requests[1].resolve(result(student));
  await flush();
  assert.equal(app.screen().props.user.id, 'account-b');
  assert.equal(app.screen().props.page, 'home');
});
