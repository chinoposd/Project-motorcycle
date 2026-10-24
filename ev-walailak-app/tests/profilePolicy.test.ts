import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const migration = readFileSync(new URL('../supabase/migrations/20261024062207_create_profiles.sql', import.meta.url), 'utf8');

test('profile migration restricts applicants to Student and Employee and uses safe defaults', () => {
  assert.match(migration, /requested_role text not null check \(requested_role in \('Student', 'Employee'\)\)/i);
  assert.match(migration, /account_status text not null default 'Pending'/i);
  assert.match(migration, /driving_permission boolean not null default false/i);
  assert.match(migration, /if requested_role_text not in \('Student', 'Employee'\) then/i);
});

test('profile migration is read-only to users and protects profiles with owner-only RLS', () => {
  assert.match(migration, /alter table public\.profiles enable row level security/i);
  assert.match(migration, /revoke all on table public\.profiles from anon, authenticated/i);
  assert.match(migration, /grant select on table public\.profiles to authenticated/i);
  assert.match(migration, /\(select auth\.uid\(\)\) = id/i);
  assert.doesNotMatch(migration, /grant\s+(insert|update|delete|all)\s+on\s+(table\s+)?public\.profiles\s+to\s+authenticated/i);
});

test('profile creation trigger has a fixed search path and is not executable by browser roles', () => {
  assert.match(migration, /security definer\s+set search_path = ''/i);
  assert.match(migration, /revoke all on function public\.create_profile_for_new_auth_user\(\) from public, anon, authenticated/i);
  assert.match(migration, /after insert on auth\.users/i);
});
