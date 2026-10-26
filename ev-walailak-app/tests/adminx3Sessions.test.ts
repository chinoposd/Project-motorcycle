import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { ids, operationsDb } from './helpers/operationsDb.ts';

let store: Awaited<ReturnType<typeof operationsDb>>;
before(async () => { store = await operationsDb(); });
after(async () => { await store?.db.close(); });
async function ready() {
  await store.db.exec(`update ops_vehicle_state set telemetry_at=now(),valid_until=now()+interval '1 minute',protocol_verified=true,
    stopped=true,throttle_zero=true,bms_ok=true,ai_ready=true,gps_reliable=true,motor_ready=false,online=true;
    insert into ops_zones(kind,geometry,reason,created_by) values('return','{"type":"Polygon","coordinates":[[[99,8],[100,8],[100,9],[99,8]]]}','test fixture','${ids.admin}'),
    ('main','{"type":"Polygon","coordinates":[[[99,8],[100,8],[100,9],[99,8]]]}','test fixture','${ids.admin}') on conflict do nothing;
    update ops_project_config set privacy_notice_version='reviewed-v1',terms_version='reviewed-v1';
    update admin_portal_settings set allowed_weekdays=array[0,1,2,3,4,5,6]::smallint[],session_start='00:00',session_end='23:59:59';`);
}

test('server start authorization rejects Admin, unapproved and missing driving permission', async () => {
  await assert.rejects(store.rpc(ids.admin, 'request_web_session', [true,true,randomUUID()]), /driver|Admin/i);
  await assert.rejects(store.rpc(ids.suspended, 'request_web_session', [true,true,randomUUID()]), /Approved/i);
  await store.db.query('update profiles set driving_permission=false where id=$1', [ids.student]);
  await assert.rejects(store.rpc(ids.student, 'request_web_session', [true,true,randomUUID()]), /Driving Permission/i);
  await store.db.query('update profiles set driving_permission=true where id=$1', [ids.student]);
});

test('missing telemetry or inspection can never produce an Active Session', async () => {
  await assert.rejects(store.rpc(ids.student, 'request_web_session', [true,true,randomUUID()]), /telemetry|vehicle evidence/i);
  await ready();
  await assert.rejects(store.rpc(ids.student, 'request_web_session', [false,true,randomUUID()]), /inspection/i);
  await store.db.exec("update admin_portal_settings set allowed_weekdays=null,session_start=null,session_end=null");
  await assert.rejects(store.rpc(ids.student, 'request_web_session', [true,true,randomUUID()]), /hours/i);
  const reservation = await store.rpc(ids.manager, 'request_web_session', [true,true,randomUUID()]);
  assert.equal(reservation.status, 'Reserved');
  assert.ok(new Date(reservation.expires_at as string).getTime() - Date.now() <= 300000);
  await store.rpc(ids.manager, 'session_owner_action', [reservation.id,'cancel']);
  await ready();
});

test('one vehicle has one reservation and the idempotency key never extends expiry', async () => {
  const key = randomUUID();
  const first = await store.rpc(ids.student, 'request_web_session', [true,true,key]);
  const duplicate = await store.rpc(ids.student, 'request_web_session', [true,true,key]);
  assert.equal(duplicate.id, first.id);
  assert.equal(duplicate.expires_at, first.expires_at);
  await assert.rejects(store.rpc(ids.employee, 'request_web_session', [true,true,randomUUID()]), /busy|reserved/i);
  await assert.rejects(store.rpc(ids.student, 'vehicle_ingest_event', [{ event_id:randomUUID(),vehicle_id:'EV-01',kind:'start_confirmed',session_id:first.id }]), /permission denied/i);
  await store.rpc(ids.student, 'session_owner_action', [first.id,'cancel']);
});

test('trusted motor confirmation needs matching command, proximity and fresh safety evidence', async () => {
  await ready();
  const pending = await store.rpc(ids.student, 'request_web_session', [true,true,randomUUID()]);
  const event = { event_id:randomUUID(),vehicle_id:'EV-01',kind:'start_confirmed',session_id:pending.id,
    command_id:pending.command_id,occurred_at:new Date().toISOString(),motor_ready:true,stopped:true,
    throttle_zero:true,bms_ok:true,ai_ready:true,gps_reliable:true,proximity_user_id:ids.employee };
  const ambiguous = await store.rpc(null,'vehicle_ingest_event',[event],true);
  assert.equal(ambiguous.conflict,true);
  assert.match(ambiguous.reason as string,/proximity/i);
  event.event_id=randomUUID();
  event.proximity_user_id=ids.student;
  const active = await store.rpc(null,'vehicle_ingest_event',[event],true);
  assert.equal(active.status,'Active');
  const replay = await store.rpc(null,'vehicle_ingest_event',[event],true);
  assert.equal(replay.duplicate,true);
  const unresolved=await store.db.query<{count:string}>("select count(*)::text as count from ops_alert_episodes where kind='confirmation_conflict' and resolved_at is null");
  assert.equal(unresolved.rows[0]?.count,'0');
  await store.db.query("update profiles set driving_permission=false where id=$1", [ids.student]);
  await store.db.exec("update admin_portal_settings set session_start='01:00',session_end='01:01'");
  const current = await store.db.query<{status:string}>('select status from ops_sessions where id=$1',[pending.id]);
  assert.equal(current.rows[0]?.status,'Active');
  await store.db.query("update ops_sessions set status='Completed',ended_at=now() where id=$1",[pending.id]);
  await store.db.query('update profiles set driving_permission=true where id=$1',[ids.student]);
});

test('Cancellation cooldown snapshots are nonretroactive and do not reset No-show', async () => {
  await ready();
  await store.db.exec("update admin_portal_settings set cancellation_limit=2,cancellation_cooldown_hours=4,no_show_limit=3,no_show_cooldown_hours=8; update ops_project_config set cancellation_window_hours=24,cancellation_warning_remaining=1,no_show_window_hours=24,no_show_warning_remaining=1");
  for(let n=0;n<2;n++){
    const reserved=await store.rpc(ids.employee,'request_web_session',[true,true,randomUUID()]);
    await store.rpc(ids.employee,'session_owner_action',[reserved.id,'cancel']);
  }
  const cycle=await store.db.query<{restricted_until:Date;id:string}>("select id,restricted_until from ops_behavior_cycles where user_id=$1 and kind='Cancellation' and closed_at is null",[ids.employee]);
  assert.ok(cycle.rows[0]?.restricted_until);
  const expiry=cycle.rows[0]!.restricted_until;
  await store.db.exec('update admin_portal_settings set cancellation_cooldown_hours=99,cancellation_limit=20');
  await assert.rejects(store.rpc(ids.employee,'request_web_session',[true,true,randomUUID()]),/Cancellation/i);
  const preserved=await store.db.query<{restricted_until:Date}>('select restricted_until from ops_behavior_cycles where id=$1',[cycle.rows[0]!.id]);
  assert.equal(preserved.rows[0]?.restricted_until.getTime(),expiry.getTime());
});

test('server expiry counts a reservation No-show once and exemption releases only that category', async () => {
  await ready();
  await store.db.exec("update admin_portal_settings set no_show_limit=1,no_show_cooldown_hours=8; update ops_project_config set no_show_window_hours=24");
  const reserved=await store.rpc(ids.student,'request_web_session',[true,true,randomUUID()]);
  await store.db.query("update ops_sessions set created_at=now()-interval '6 minutes',expires_at=now()-interval '1 minute' where id=$1",[reserved.id]);
  await store.rpc(null,'operations_maintenance',[],true);
  await store.rpc(null,'operations_maintenance',[],true);
  const events=await store.db.query<{id:string;fault_status:string}>('select id,fault_status from ops_behavior_events where session_id=$1',[reserved.id]);
  assert.equal(events.rows.length,1);
  await assert.rejects(store.rpc(ids.student,'request_web_session',[true,true,randomUUID()]),/NoShow/);
  await store.rpc(ids.manager,'admin_operations_action',['review_no_show',{id:events.rows[0]!.id,expected_status:'Counted',decision:'exempt',evidence:'Gateway log proves communications outage',reason:'Confirmed technical problem'}]);
  const student=await store.rpc(ids.student,'my_operations_snapshot');
  assert.ok((student.notices as {kind:string}[]).some(x=>x.kind==='no_show_corrected'));
  const employee=await store.db.query<{restricted_until:Date}>("select restricted_until from ops_behavior_cycles where user_id=$1 and kind='Cancellation' and closed_at is null",[ids.employee]);
  assert.ok(employee.rows[0]?.restricted_until);
});

test('shared operational acknowledgment records actor/time without clearing a safety block', async () => {
  const report=await store.rpc(ids.student,'user_operations_action',['report_issue',{category:'brakes',details:'Brake lever does not stop vehicle reliably'}]);
  assert.equal(report.received,true);
  const snapshot=await store.rpc(ids.admin,'admin_operations_snapshot',['2026-10-26']);
  const alert=(snapshot.alerts as {id:string;kind:string}[]).find(x=>x.kind==='issue:brakes');
  assert.ok(alert);
  await store.rpc(ids.manager,'admin_operations_action',['acknowledge_alert',{id:alert.id}]);
  const ack=await store.db.query<{acknowledged_by:string}>('select acknowledged_by from ops_alert_episodes where id=$1',[alert.id]);
  assert.equal(ack.rows[0]?.acknowledged_by,ids.manager);
  const blocked=await store.db.query<{safety_block_active:boolean}>('select safety_block_active from admin_vehicle_service');
  assert.equal(blocked.rows[0]?.safety_block_active,true);
});

test('an unvalidated offline protocol cannot issue a manifest or authorize another rider', async () => {
  await assert.rejects(store.rpc(null,'gateway_prepare_manifest',[86401,'test-key'],true),/24 hours/i);
  await assert.rejects(store.rpc(null,'gateway_prepare_manifest',[3600,'test-key'],true),/offline protocol|verified/i);
  await assert.rejects(store.rpc(ids.admin,'gateway_prepare_manifest',[3600,'test-key']),/permission denied/i);
});

test('signed offline lease blocks online starts until ordered events and manifest invalidation reconcile', async () => {
  await ready();
  await store.db.exec('update admin_vehicle_service set safety_block_active=false,final_confirmation_required=false; update ops_vehicle_state set offline_protocol_verified=true');
  await store.rpc(ids.admin,'admin_operations_action',['register_nfc',{user_id:ids.manager,card_ref:'MANAGER-OFFLINE-CARD',reason:'Verified physical NFC card'}]);
  const manifest=await store.rpc(null,'gateway_prepare_manifest',[600,'test-key'],true);
  assert.ok((manifest.cards as unknown[]).length);
  await assert.rejects(store.rpc(ids.student,'request_web_session',[true,true,randomUUID()]),/Offline manifest/i);
  const offlineId=randomUUID();
  const base={vehicle_id:'EV-01',offline_session_id:offlineId,card_ref:'MANAGER-OFFLINE-CARD',manifest_version:manifest.version,
    occurred_at:new Date().toISOString(),stopped:true,throttle_zero:true,bms_ok:true,proximity_user_id:ids.manager,inspection_confirmed:true};
  const started=await store.rpc(null,'vehicle_ingest_event',[{...base,event_id:randomUUID(),kind:'offline_start',sequence:1,motor_ready:true}],true);
  assert.equal(started.status,'Active');
  const ended=await store.rpc(null,'vehicle_ingest_event',[{...base,event_id:randomUUID(),kind:'offline_end',sequence:2,motor_ready:false,return_zone_verified:true}],true);
  assert.equal(ended.status,'EndedPendingSync');
  const sync=await store.rpc(null,'vehicle_ingest_event',[{...base,event_id:randomUUID(),kind:'offline_sync_complete',sequence:3,motor_ready:false,queue_empty:true,invalidated_through:manifest.version}],true);
  assert.equal(sync.reconciled,true);
  const state=await store.db.query<{offline_reconciliation_required:boolean}>('select offline_reconciliation_required from ops_vehicle_state');
  assert.equal(state.rows[0]?.offline_reconciliation_required,false);
});
