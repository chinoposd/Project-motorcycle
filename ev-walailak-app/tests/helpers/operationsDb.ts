import { PGlite } from '@electric-sql/pglite';
import { readdir, readFile } from 'node:fs/promises';

export const ids = {
  admin: '00000000-0000-4000-8000-000000000001',
  manager: '00000000-0000-4000-8000-000000000002',
  student: '00000000-0000-4000-8000-000000000003',
  employee: '00000000-0000-4000-8000-000000000004',
  rejected: '00000000-0000-4000-8000-000000000005',
  suspended: '00000000-0000-4000-8000-000000000006',
};

export async function operationsDb() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}', raw_app_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true),''),'{}')::jsonb $$;
    create function auth.role() returns text language sql stable as $$ select auth.jwt()->>'role' $$;
    grant usage on schema auth,public to anon,authenticated,service_role;
    grant execute on all functions in schema auth to anon,authenticated,service_role;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
    create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;
  `);
  const migrationDir = new URL('../../supabase/migrations/', import.meta.url);
  for (const file of (await readdir(migrationDir)).filter((name) => name.endsWith('.sql')).sort()) {
    try { await db.exec(await readFile(new URL(file, migrationDir), 'utf8')); }
    catch (error) { throw new Error(`Migration ${file}: ${String(error)}`, { cause: error }); }
  }
  for (const [label, id] of Object.entries(ids)) {
    await db.query('insert into auth.users(id,email) values ($1,$2)', [id, `${label}@example.edu`]);
    const role = label === 'admin' ? 'Admin' : label === 'manager' ? 'Manager' : label === 'employee' ? 'Employee' : 'Student';
    const status = label === 'rejected' ? 'Rejected' : label === 'suspended' ? 'Suspended' : 'Approved';
    await db.query(`update public.profiles set full_name=$2,role=$3,account_status=$4,phone='0812345678',
      driving_permission=$5,induction_confirmed=$5 where id=$1`, [id, label, role, status, status === 'Approved' && role !== 'Admin']);
  }
  async function rpc<T = Record<string, unknown>>(actor: string | null, name: string, args: unknown[] = [], trusted = false): Promise<T> {
    if (!/^[a-z_]+$/.test(name)) throw new Error('Unsafe test RPC name');
    return db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)",
        [actor ?? '', JSON.stringify({ sub: actor, role: trusted ? 'service_role' : actor ? 'authenticated' : 'anon' })]);
      await tx.exec(`set local role ${trusted ? 'service_role' : actor ? 'authenticated' : 'anon'}`);
      const placeholders = args.map((_, i) => `$${i + 1}`).join(',');
      const result = await tx.query<{ result: T }>(`select public.${name}(${placeholders}) as result`, args);
      return result.rows[0]!.result;
    });
  }
  return { db, rpc };
}
