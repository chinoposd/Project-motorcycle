import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readSupabaseConfig } from '../src/auth/supabaseConfig.ts';

test('Supabase configuration accepts a hosted project URL and publishable key', () => {
  assert.deepEqual(readSupabaseConfig({
    url: 'https://example-project.supabase.co',
    publishableKey: 'sb_publishable_test-key-value-0123456789012345',
  }), {
    mode: 'configured',
    url: 'https://example-project.supabase.co',
    publishableKey: 'sb_publishable_test-key-value-0123456789012345',
  });
});

test('Supabase configuration stays in demo mode when values are missing or invalid', () => {
  assert.equal(readSupabaseConfig({ url: '', publishableKey: '' }).mode, 'unconfigured');
  assert.equal(readSupabaseConfig({ url: 'not-a-url', publishableKey: 'sb_publishable_test-key' }).mode, 'unconfigured');
  assert.equal(readSupabaseConfig({ url: 'https://example.com', publishableKey: 'sb_publishable_test-key-value-0123456789012345' }).mode, 'unconfigured');
  assert.equal(readSupabaseConfig({ url: 'https://example-project.supabase.co', publishableKey: 'sb_secret_do-not-use-at-all-0123456789' }).mode, 'unconfigured');
});

test('Supabase configuration diagnostics never include a supplied key', () => {
  const secret = 'sb_secret_sensitive-value';
  const result = readSupabaseConfig({ url: 'not-a-url', publishableKey: secret });
  assert.equal(result.mode, 'unconfigured');
  assert.equal(JSON.stringify(result).includes(secret), false);
});
