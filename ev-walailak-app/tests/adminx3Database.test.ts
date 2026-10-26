import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { ids, operationsDb } from './helpers/operationsDb.ts';

let store: Awaited<ReturnType<typeof operationsDb>>;
before(async () => { store = await operationsDb(); });
after(async () => { await store?.db.close(); });

test('Admin operations deny anonymous and ordinary account access', async () => {
  await assert.rejects(store.rpc(null, 'admin_operations_snapshot', ['2026-10-26']), /permission denied/i);
  await assert.rejects(store.rpc(ids.student, 'admin_operations_snapshot', ['2026-10-26']), /access required/i);
  const snapshot = await store.rpc(ids.admin, 'admin_operations_snapshot', ['2026-10-26']);
  assert.ok(Array.isArray(snapshot.appeals));
});

test('an account appeal is owned, deduplicated and never grants driving access', async () => {
  await assert.rejects(store.rpc(ids.student, 'user_operations_action', ['appeal', { details: 'Please reconsider my account' }]), /Rejected|Suspended/);
  const appeal = await store.rpc(ids.rejected, 'user_operations_action', ['appeal', { details: 'New university affiliation evidence' }]);
  assert.equal(appeal.status, 'Pending');
  await assert.rejects(store.rpc(ids.rejected, 'user_operations_action', ['appeal', { details: 'Another open appeal' }]), /open appeal/i);
  const mine = await store.rpc(ids.suspended, 'my_operations_snapshot');
  assert.deepEqual(mine.appeals, []);
  await assert.rejects(store.rpc(ids.manager, 'admin_operations_action', ['review_appeal', { id: appeal.id, decision: 'accept', reason: 'Verified new evidence', version: 1 }]), /Admin access required/i);
  await store.rpc(ids.admin, 'admin_operations_action', ['review_appeal', { id: appeal.id, decision: 'accept', reason: 'Verified new evidence', version: 1 }]);
  const profile = await store.db.query<{ account_status: string; driving_permission: boolean }>('select account_status,driving_permission from profiles where id=$1', [ids.rejected]);
  assert.deepEqual(profile.rows[0], { account_status: 'Pending', driving_permission: false });
  await assert.rejects(store.rpc(ids.admin, 'admin_operations_action', ['review_appeal', { id: appeal.id, decision: 'reject', reason: 'Stale review must fail', version: 1 }]), /changed|reviewed/i);
});

test('replacing one NFC card revokes the old card and cannot bind a second account', async () => {
  const first = await store.rpc(ids.admin, 'admin_operations_action', ['register_nfc', { user_id: ids.student, card_ref: 'CARD-111111', reason: 'Checked card in person' }]);
  await assert.rejects(store.rpc(ids.manager, 'admin_operations_action', ['register_nfc', { user_id: ids.employee, card_ref: 'CARD-222222', reason: 'Not an Admin' }]), /Admin access required/i);
  await store.rpc(ids.admin, 'admin_operations_action', ['register_nfc', { user_id: ids.student, card_ref: 'CARD-222222', reason: 'Replace lost physical card' }]);
  const old = await store.db.query<{ revoked_at: string | null }>('select revoked_at from ops_nfc_cards where id=$1', [first.id]);
  assert.ok(old.rows[0]?.revoked_at);
  await assert.rejects(store.rpc(ids.admin, 'admin_operations_action', ['register_nfc', { user_id: ids.employee, card_ref: 'CARD-222222', reason: 'Duplicate card rejected' }]), /registered|unique/i);
  await assert.rejects(store.rpc(ids.admin, 'admin_operations_action', ['register_nfc', { user_id: ids.admin, card_ref: 'CARD-333333', reason: 'Admin cannot drive' }]), /driver|Approved/i);
});

test('project phone and Pilot parameters are audited and remain unset by default', async () => {
  const initial = await store.rpc(ids.admin, 'admin_operations_snapshot', ['2026-10-26']);
  const config = initial.config as Record<string, unknown>;
  assert.equal(config.cancellation_window_hours, null);
  assert.equal(config.no_show_warning_remaining, null);
  await store.rpc(ids.admin, 'admin_operations_action', ['update_operations_config', { project_phone: '075123456', reason: 'Advisor confirmed contact number', version: config.version }]);
  const result = await store.db.query<{ action: string }>("select action from admin_portal_audit where action='update_operations_config'");
  assert.equal(result.rows.length, 1);
  await assert.rejects(store.rpc(ids.student, 'admin_operations_action', ['update_operations_config', { project_phone: '0999999999', reason: 'No authority' }]), /access required/i);
});

test('the current account snapshot is scoped to its authenticated owner',async()=>{
  const student=await store.rpc(ids.student,'my_operations_snapshot');
  assert.deepEqual(student.account,{id:ids.student,name:'student',phone:'0812345678',role:'Student',status:'Approved',account_status_reason:'',driving_permission:true,induction_confirmed:true});
  const manager=await store.rpc<{account:{id:string;role:string}}>(ids.manager,'my_operations_snapshot');
  assert.equal(manager.account.id,ids.manager);
  assert.equal(manager.account.role,'Manager');
  assert.equal(JSON.stringify(student).includes(ids.manager),false);
});
