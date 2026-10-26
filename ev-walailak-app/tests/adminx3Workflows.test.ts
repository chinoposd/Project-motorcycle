import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { ids, operationsDb } from './helpers/operationsDb.ts';
let store:Awaited<ReturnType<typeof operationsDb>>;
before(async()=>{store=await operationsDb();});
after(async()=>{await store?.db.close();});

async function completeTrip(user=ids.student,distance:number|null=4) {
  const id=randomUUID();
  await store.db.query(`insert into ops_sessions(id,user_id,request_id,status,created_at,expires_at,started_at,ended_at,distance_km)
    values($1,$2,$1,'Completed','2026-10-26T03:00:00Z','2026-10-26T03:05:00Z','2026-10-26T03:00:00Z','2026-10-26T03:30:00Z',$3)`,[id,user,distance]);
  return id;
}

test('zone edits require trusted stopped evidence and preserve version/history',async()=>{
  const geometry={type:'Polygon',coordinates:[[[99,8],[100,8],[100,9],[99,8]]]};
  const payload={kind:'return',geometry,reason:'Advisor approved parking area',expected_version:0};
  await assert.rejects(store.rpc(ids.admin,'admin_operations_action',['save_zone',payload]),/stopped|evidence/i);
  await store.db.exec("update ops_vehicle_state set telemetry_at=now(),valid_until=now()+interval '1 minute',stopped=true,motor_ready=false,online=true,protocol_verified=true");
  await store.rpc(ids.admin,'admin_operations_action',['save_zone',payload]);
  await assert.rejects(store.rpc(ids.manager,'admin_operations_action',['save_zone',{...payload,expected_version:1}]),/Admin access required/i);
  await assert.rejects(store.rpc(ids.admin,'admin_operations_action',['save_zone',payload]),/changed/i);
  const session=randomUUID();
  await store.db.query('insert into ops_sessions(id,user_id,request_id) values($1,$2,$1)',[session,ids.student]);
  await assert.rejects(store.rpc(ids.admin,'admin_operations_action',['save_zone',{...payload,expected_version:1}]),/Session|lease/i);
  await store.db.query("update ops_sessions set status='Cancelled' where id=$1",[session]);
});

test('daily statistics disclose missing distance and Admin trip corrections preserve audit',async()=>{
  const trip=await completeTrip();await completeTrip(ids.employee,null);
  const report=await store.rpc(ids.student,'user_operations_action',['report_trip',{session_id:trip,details:'The reported distance was too short'}]);
  await assert.rejects(store.rpc(ids.employee,'user_operations_action',['report_trip',{session_id:trip,details:'Not my trip report attempt'}]),/owned|owner/i);
  await assert.rejects(store.rpc(ids.manager,'admin_operations_action',['correct_trip',{id:trip,distance_km:5,reason:'Manager cannot edit trip',version:1}]),/Admin access required/i);
  await store.rpc(ids.admin,'admin_operations_action',['correct_trip',{id:trip,report_id:report.id,distance_km:5,reason:'Compared source distance measurement',version:1}]);
  const snapshot=await store.rpc(ids.manager,'admin_operations_snapshot',['2026-10-26']);
  const stats=snapshot.daily_report as {session_count:number;distance_missing:number;total_distance_km:number;average_distance_km:number;unique_users:number};
  assert.equal(stats.session_count,2);assert.equal(stats.distance_missing,1);assert.equal(Number(stats.total_distance_km),5);assert.equal(Number(stats.average_distance_km),5);assert.equal(stats.unique_users,2);
  assert.equal(JSON.stringify(snapshot).includes('0812345678'),false);
  const audit=await store.db.query<{before_value:{distance_km:number};after_value:{distance_km:number}}>("select before_value,after_value from admin_portal_audit where action='correct_trip'");
  assert.equal(Number(audit.rows[0]?.before_value.distance_km),4);assert.equal(Number(audit.rows[0]?.after_value.distance_km),5);
});

test('closing a privacy ticket cannot bypass identity verification and real fulfillment',async()=>{
  await store.db.query("insert into ops_issue_reports(user_id,category,details,high_risk) values($1,'network','Network dropped during the ride',false)",[ids.student]);
  await store.db.query('insert into ops_nfc_cards(user_id,card_ref,registered_by) values($1,$2,$3)',[ids.student,'ACCESS-PACKAGE-CARD',ids.admin]);
  const id=await store.rpc<string>(ids.student,'submit_data_subject_request',['access','Please provide a copy of my personal data']);
  await assert.rejects(store.rpc(ids.admin,'admin_portal_action',['review_privacy_request',{id,status:'Completed',admin_note:'Ticket closure is not fulfillment'}]),/identity|fulfillment|workflow/i);
  await assert.rejects(store.rpc(ids.admin,'admin_operations_action',['review_privacy',{id,version:1,decision:'approve',reason:'Reviewed lawful request',legal_basis:'Project policy access right'}]),/identity/i);
  await store.rpc(ids.admin,'admin_operations_action',['review_privacy',{id,version:1,decision:'approve',identity_verified:true,identity_method:'Verified the person using university affiliation records',reason:'Approved scoped access request',legal_basis:'Reviewed project privacy policy'}]);
  const job=await store.rpc(null,'privacy_worker_claim',[],true);
  assert.equal(job.kind,'access');
  await store.rpc(null,'privacy_worker_finish',[job.id,job.lease_token,{ok:true}],true);
  const mine=await store.rpc(ids.student,'my_operations_snapshot');
  const exports=mine.privacy_exports as {request_id:string;data:{profile:{id:string};trips:unknown[];issue_reports:unknown[];nfc_cards:unknown[];trip_reports:unknown[]}}[];
  assert.equal(exports[0]?.request_id,id);assert.equal(exports[0]?.data.profile.id,ids.student);
  assert.equal(exports[0]?.data.issue_reports.length,1);
  assert.equal(exports[0]?.data.nfc_cards.length,1);
  assert.equal(exports[0]?.data.trip_reports.length,1);
  const other=await store.rpc(ids.employee,'my_operations_snapshot');assert.deepEqual(other.privacy_exports,[]);
});

test('deletion fulfillment requires policy review and does not run against an active Session',async()=>{
  const id=await store.rpc<string>(ids.employee,'submit_data_subject_request',['deletion','Please erase my personal information']);
  await assert.rejects(store.rpc(ids.admin,'admin_operations_action',['review_privacy',{id,version:1,decision:'approve',identity_verified:true,identity_method:'Checked applicant identity in person',reason:'Reviewed lawful deletion request',legal_basis:'No remaining retention requirement'}]),/policy|reviewed/i);
});

test('GPS summaries are owner-scoped, edits create separate acknowledgment notices and raw data expires',async()=>{
  const opened=await store.rpc(ids.admin,'admin_operations_action',['open_gps_review',{user_id:ids.student,reason:'Trusted location evidence requires review'}]);
  await store.rpc(ids.admin,'admin_operations_action',['record_gps_call',{id:opened.id,version:1,summary:'User explained the phone had poor reception',called_at:new Date().toISOString(),reason:'Recorded phone explanation'}]);
  await store.rpc(ids.admin,'admin_operations_action',['record_gps_call',{id:opened.id,version:2,summary:'User explained GPS accuracy, corrected call details',called_at:new Date().toISOString(),reason:'Corrected the recorded explanation'}]);
  const mine=await store.rpc(ids.student,'my_operations_snapshot');
  assert.equal((mine.gps_reviews as unknown[]).length,1);
  const notices=(mine.notices as {id:string;acknowledgment_required:boolean}[]).filter(x=>x.acknowledgment_required);
  assert.equal(notices.length,1);
  const other=await store.rpc(ids.employee,'my_operations_snapshot');assert.deepEqual(other.gps_reviews,[]);
  await store.rpc(ids.student,'user_operations_action',['acknowledge_notice',{id:notices[0]!.id}]);
  await assert.rejects(store.rpc(ids.manager,'admin_operations_action',['record_gps_call',{id:opened.id,version:3,summary:'A Manager cannot edit this summary',reason:'Attempt unauthorized edit'}]),/Admin access required/i);
});

test('phone coordinates expire per check and cannot become a start-location substitute',async()=>{
  const session=randomUUID();
  await store.db.query("insert into ops_sessions(id,user_id,request_id,status,started_at) values($1,$2,$1,'PendingEnd',now())",[session,ids.employee]);
  await store.db.exec('update ops_vehicle_state set gps_reliable=false');
  const check=await store.rpc(ids.employee,'user_operations_action',['submit_return_location',{session_id:session,latitude:8.64,longitude:99.89}]);
  assert.equal(check.result,'PendingVerification');
  await assert.rejects(store.rpc(ids.manager,'admin_operations_action',['view_gps_evidence',{id:check.id,reason:'Manager cannot view raw phone GPS'}]),/Admin access required/i);
  await store.db.query("update ops_return_location_checks set checked_at=now()-interval '31 days' where id=$1",[check.id]);
  await store.rpc(null,'operations_maintenance',[],true);
  const raw=await store.db.query<{latitude:number|null;longitude:number|null;result:string}>('select latitude,longitude,result from ops_return_location_checks where id=$1',[check.id]);
  assert.deepEqual(raw.rows[0],{latitude:null,longitude:null,result:'PendingVerification'});
  await store.db.query("update ops_sessions set status='Completed',ended_at=now() where id=$1",[session]);
});

test('deletion jobs preserve anonymous statistics and cannot claim completion while Auth still exists',async()=>{
  const subject=randomUUID();
  await store.db.query('insert into auth.users(id,email) values($1,$2)',[subject,'deletion-subject@example.edu']);
  await completeTrip(subject,7);
  await store.db.exec("update ops_project_config set privacy_policy_reviewed_at=now(),privacy_policy_reference='Advisor reviewed policy reference' ");
  const priorHold=await store.rpc(ids.admin,'admin_operations_action',['privacy_hold',{user_id:subject,enabled:true,reason:'Checking retention obligations'}]);
  await store.rpc(ids.admin,'admin_operations_action',['privacy_hold',{id:priorHold.id,user_id:subject,enabled:false,reason:'No retention obligation remains'}]);
  const request=await store.rpc<string>(subject,'submit_data_subject_request',['deletion','Erase the personal records after policy review']);
  await store.rpc(ids.admin,'admin_operations_action',['review_privacy',{id:request,version:1,decision:'approve',identity_verified:true,identity_method:'Verified this person in project records',reason:'Policy permits requested deletion',legal_basis:'Reviewed policy with no retention hold'}]);
  const job=await store.rpc(null,'privacy_worker_claim',[],true);
  await store.rpc(null,'privacy_worker_purge',[job.id,job.lease_token],true);
  const retainedAudit=await store.db.query<{target_id:string;before_value:unknown;after_value:unknown}>("select target_id,before_value,after_value from admin_portal_audit where action='review_privacy'");
  assert.equal(JSON.stringify(retainedAudit.rows).includes(subject),false,'privacy review audit must not retain the requester UUID');
  assert.equal(JSON.stringify(retainedAudit.rows).includes('Erase the personal records'),false,'privacy review audit must not retain request details');
  const allAudit=await store.db.query<{target_id:string;before_value:unknown;after_value:unknown}>("select target_id,before_value,after_value from admin_portal_audit");
  assert.equal(JSON.stringify(allAudit.rows).includes(subject),false,'other subject-linked audit records must be anonymized too');
  await assert.rejects(store.rpc(null,'privacy_worker_finish',[job.id,job.lease_token,{ok:true}],true),/Auth deletion/i);
  await store.db.query('delete from auth.users where id=$1',[subject]);
  const finished=await store.rpc(null,'privacy_worker_finish',[job.id,job.lease_token,{ok:true}],true);
  assert.equal(finished.status,'Completed');
  const anonymous=await store.db.query<{session_count:bigint;total_distance_km:string}>('select session_count,total_distance_km from ops_anonymous_daily_stats where day=$1',['2026-10-26']);
  assert.equal(Number(anonymous.rows[0]?.session_count),1);assert.equal(Number(anonymous.rows[0]?.total_distance_km),7);
});

test('privacy holds cannot be added after destructive cleanup has started',async()=>{
  const local=await operationsDb();
  try {
    const subject=randomUUID();
    await local.db.query('insert into auth.users(id,email) values($1,$2)',[subject,'hold-race@example.edu']);
    await local.db.exec("update ops_project_config set privacy_policy_reviewed_at=now(),privacy_policy_reference='Reviewed policy'");
    const request=await local.rpc<string>(subject,'submit_data_subject_request',['deletion','Please remove all records after policy review']);
    await local.rpc(ids.admin,'admin_operations_action',['review_privacy',{id:request,version:1,decision:'approve',identity_verified:true,identity_method:'Verified in records',reason:'Approved lawful request',legal_basis:'No retention requirement'}]);
    const job=await local.rpc(null,'privacy_worker_claim',[],true);
    await assert.rejects(local.rpc(ids.admin,'admin_operations_action',['privacy_hold',{user_id:subject,enabled:true,reason:'Late retention hold'}]),/Cleanup is running|irreversible/i);
    await local.rpc(null,'privacy_worker_purge',[job.id,job.lease_token],true);
    await assert.rejects(local.rpc(ids.admin,'admin_operations_action',['privacy_hold',{user_id:subject,enabled:true,reason:'Late retention hold'}]),/Cleanup is running|irreversible/i);
  } finally {await local.db.close();}
});

test('Manager safety clearance never replaces final Admin reopening or trusted evidence',async()=>{
  await store.db.exec("update admin_vehicle_service set safety_block_active=true,final_confirmation_required=true; update ops_vehicle_state set stopped=true,motor_ready=false,online=true,protocol_verified=true,bms_ok=true,throttle_zero=true,valid_until=now()+interval '1 minute'");
  await assert.rejects(store.rpc(ids.manager,'admin_portal_action',['set_manual_service_stop',{enabled:false,reason:'Manager has no manual control'}]),/Admin access required/i);
  await assert.rejects(store.rpc(ids.manager,'admin_operations_action',['close_session_exception',{id:'00000000-0000-4000-8000-000000000099',physical_inspection_confirmed:true,reason:'Manager must not close an exceptional Session'}]),/Admin access required/i);
  await assert.rejects(store.rpc(ids.manager,'admin_operations_action',['resolve_vehicle_conflict',{physical_inspection_confirmed:true,reason:'Manager must not resolve a vehicle conflict'}]),/Admin access required/i);
  await store.rpc(ids.manager,'admin_operations_action',['clear_safety_block',{physical_inspection_confirmed:true,reason:'Physically inspected and verified brake repair'}]);
  const state=await store.db.query<{safety_block_active:boolean;final_confirmation_required:boolean}>('select safety_block_active,final_confirmation_required from admin_vehicle_service');
  assert.deepEqual(state.rows[0],{safety_block_active:false,final_confirmation_required:true});
  await assert.rejects(store.rpc(ids.admin,'admin_portal_action',['confirm_service_reopen',{reason:'Missing physical inspection confirmation'}]),/Physical inspection/i);
  await store.rpc(ids.admin,'admin_portal_action',['confirm_service_reopen',{physical_inspection_confirmed:true,reason:'Final Admin vehicle inspection complete'}]);
});

test('daily totals remain available after all source trips have been anonymized',async()=>{
  await store.db.exec("insert into ops_anonymous_daily_stats values('2026-10-24',3,3600,3,9,3,2)");
  const report=await store.rpc(ids.admin,'admin_operations_snapshot',['2026-10-24']);
  const stats=report.daily_report as {session_count:number;total_distance_km:number;average_distance_km:number};
  assert.equal(stats.session_count,3);assert.equal(Number(stats.total_distance_km),9);assert.equal(Number(stats.average_distance_km),3);
});

test('live account snapshot includes a newly assigned suspension reason',async()=>{
  const local=await operationsDb();
  try {
    await local.db.query("update profiles set account_status='Suspended',account_status_reason='Project review required' where id=$1",[ids.student]);
    const mine=await local.rpc(ids.student,'my_operations_snapshot');
    assert.equal((mine.account as {account_status_reason:string}).account_status_reason,'Project review required');
  } finally {await local.db.close();}
});
