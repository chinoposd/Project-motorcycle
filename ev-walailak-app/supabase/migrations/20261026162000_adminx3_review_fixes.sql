-- Adminx3 review fixes; all previously installed migrations remain immutable.

create or replace function app_ops.expire_reservation()
returns void language plpgsql set search_path='' as $$
declare s public.ops_sessions%rowtype;e uuid;blocked boolean;
begin
  -- Check availability against each reservation deadline, including whether newer telemetry erased the historical view.
  for s in select * from public.ops_sessions where status='Reserved' and expires_at<=now() for update loop
    select (service.manual_out_of_service or service.safety_block_active or service.final_confirmation_required
      or v.valid_until is null or v.valid_until<s.expires_at or v.telemetry_at is null or v.telemetry_at>s.expires_at
      or v.online is distinct from true or v.protocol_verified is distinct from true or v.offline_reconciliation_required) into blocked
      from public.admin_vehicle_service service cross join public.ops_vehicle_state v where service.singleton;
    update public.ops_sessions set status='Expired',version=version+1 where id=s.id;
    insert into public.ops_behavior_events(user_id,session_id,kind,occurred_at,counted,fault_status)
      values(s.user_id,s.id,'NoShow',s.expires_at,not blocked,case when blocked then 'Exempt' else 'Counted' end)
      on conflict do nothing returning id into e;
    if e is not null and not blocked then perform app_ops.evaluate_event(e);end if;
  end loop;
  -- PendingStart is deliberately not expired: an ambiguous motor result must reconcile first.
end $$;

create or replace function app_ops.user_session_snapshot()
returns jsonb language plpgsql set search_path='' as $$
declare approved boolean;pending boolean;state text;
begin
  select account_status='Approved',account_status='Pending' into approved,pending from public.profiles where id=auth.uid();
  perform app_ops.expire_cycles(auth.uid());
  state:=case when not approved and not pending then null
    when exists(select 1 from public.admin_vehicle_service where manual_out_of_service or safety_block_active or final_confirmation_required) then 'unavailable'
    when exists(select 1 from public.ops_sessions where status not in ('Completed','Cancelled','Expired','Conflict')) then 'in_use'
    when exists(select 1 from public.ops_vehicle_state where online and protocol_verified and not offline_reconciliation_required and valid_until>now() and stopped and throttle_zero and bms_ok and motor_ready=false) then 'available'
    else 'unknown' end;
  return jsonb_build_object('vehicle_availability',state,
    'own_vehicle',case when approved and exists(select 1 from public.ops_sessions where user_id=auth.uid() and status in ('Active','Paused','PendingEnd','PendingPause','PendingResume'))
      then (select jsonb_build_object('latitude',latitude,'longitude',longitude,'gps_at',gps_at,'battery_percent',battery_percent,'fresh',valid_until>now()) from public.ops_vehicle_state) else null end,
    'session',(select to_jsonb(s) from public.ops_sessions s where user_id=auth.uid() and status not in ('Completed','Cancelled','Expired','Conflict') limit 1),
    'trips',coalesce((select jsonb_agg(jsonb_build_object('id',id,'started_at',started_at,'ended_at',ended_at,'distance_km',distance_km) order by started_at desc)
      from public.ops_sessions where user_id=auth.uid() and status='Completed'),'[]'::jsonb),
    'no_show_events',coalesce((select jsonb_agg(to_jsonb(e) order by occurred_at desc) from public.ops_behavior_events e where user_id=auth.uid() and kind='NoShow'),'[]'::jsonb),
    'cycles',coalesce((select jsonb_agg(to_jsonb(c)) from public.ops_behavior_cycles c where user_id=auth.uid() and closed_at is null),'[]'::jsonb),
    'warnings',coalesce((select jsonb_agg(jsonb_build_object('kind',kind,'remaining',(policy->>'limit')::integer-count_value)) from public.ops_behavior_cycles where user_id=auth.uid() and closed_at is null
      and (restricted_until is null or restricted_until<=now()) and (policy->>'window_hours') is not null
      and (policy->>'limit')::integer-count_value between 1 and (policy->>'warning_remaining')::integer),'[]'::jsonb),
    'notices',coalesce((select jsonb_agg(to_jsonb(n) order by created_at desc) from public.ops_user_notices n where user_id=auth.uid() and (expires_at is null or expires_at>now())),'[]'::jsonb),
    'zones',case when approved then coalesce((select jsonb_agg(jsonb_build_object('kind',kind,'version',version,'geometry',geometry)) from public.ops_zones where active),'[]'::jsonb) else '[]'::jsonb end,
    'consent_versions',(select jsonb_build_object('privacy',privacy_notice_version,'terms',terms_version,'privacy_text',privacy_notice_text,'terms_text',terms_text) from public.ops_project_config));
end $$;

create or replace function public.gateway_prepare_manifest(p_lifetime_seconds integer,p_key_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.ops_vehicle_state%rowtype;cfg public.ops_project_config%rowtype;s public.admin_portal_settings%rowtype;payload jsonb;expires timestamptz;
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'Trusted vehicle service required' using errcode='42501';end if;
  if p_lifetime_seconds is null or p_lifetime_seconds not between 1 and 86400 then raise exception 'Manifest lifetime must be at most 24 hours' using errcode='22023';end if;
  if length(coalesce(p_key_id,'')) not between 1 and 100 then raise exception 'Signing key id required' using errcode='22023';end if;
  perform pg_advisory_xact_lock(2661003::bigint);
  select * into v from public.ops_vehicle_state for update;
  if not v.offline_protocol_verified or not v.protocol_verified or v.valid_until is null or v.valid_until<=now() then raise exception 'Verified offline protocol and fresh vehicle evidence required' using errcode='22023';end if;
  if v.offline_reconciliation_required or exists(select 1 from public.ops_sessions where status not in ('Completed','Cancelled','Expired','Conflict'))
    or exists(select 1 from public.admin_vehicle_service where manual_out_of_service or safety_block_active or final_confirmation_required)
    or v.stopped is distinct from true or v.motor_ready is distinct from false or v.bms_ok is distinct from true then raise exception 'Resolve leases, Sessions and service blocks before issuing manifest' using errcode='22023';end if;
  select * into cfg from public.ops_project_config;select * into s from public.admin_portal_settings;
  if cfg.privacy_notice_version is null or cfg.terms_version is null then raise exception 'Published terms and privacy versions required' using errcode='22023';end if;
  expires:=now()+make_interval(secs=>p_lifetime_seconds);
  payload:=jsonb_build_object('vehicle_id','EV-01','version',v.offline_manifest_version+1,'issued_at',now(),'expires_at',expires,'key_id',p_key_id,
    'policy_version',cfg.version,'timezone','Asia/Bangkok','allowed_weekdays',s.allowed_weekdays,'session_start',s.session_start,'session_end',s.session_end,
    'require_stopped',true,'require_throttle_zero',true,'require_bms',true,'require_proximity',true,'require_local_inspection',true,
    'main_geofence',(select geometry from public.ops_zones where kind='main' and active),'return_zone',(select geometry from public.ops_zones where kind='return' and active),
    'cards',coalesce((select jsonb_agg(jsonb_build_object('card_ref',c.card_ref,'user_id',p.id,'role',p.role,'allowed_actions',array['START','RESUME'],
      'manager_exemptions',p.role='Manager','card_version',c.version)) from public.ops_nfc_cards c join public.profiles p on p.id=c.user_id
      where c.revoked_at is null and c.enabled and p.account_status='Approved' and p.role<>'Admin' and p.driving_permission and p.induction_confirmed
      and exists(select 1 from public.ops_consents where user_id=p.id and privacy_version=cfg.privacy_notice_version and terms_version=cfg.terms_version)
      and not exists(select 1 from public.ops_behavior_cycles where user_id=p.id and closed_at is null and restricted_until>now())
      and (p.role='Manager' or (s.allowed_weekdays is not null and s.session_start is not null and s.session_end is not null and exists(select 1 from public.ops_zones where kind='main' and active) and exists(select 1 from public.ops_zones where kind='return' and active)))),'[]'::jsonb));
  insert into public.ops_offline_manifests(version,payload,issued_at,expires_at,key_id) values(v.offline_manifest_version+1,payload,now(),expires,p_key_id);
  update public.ops_vehicle_state set offline_manifest_version=offline_manifest_version+1,offline_lease_until=expires,offline_reconciliation_required=true;
  return payload;
end $$;

create or replace function app_ops.offline_ingest(p_event jsonb)
returns jsonb language plpgsql set search_path='' as $$
declare v public.ops_vehicle_state%rowtype;m public.ops_offline_manifests%rowtype;s public.ops_sessions%rowtype;card jsonb;
  occurred timestamptz:=(p_event->>'occurred_at')::timestamptz;sid uuid:=(p_event->>'offline_session_id')::uuid;
  event_kind text:=p_event->>'kind';uid uuid;new_status text;conflict boolean:=false;local_time timestamp;
begin
  select * into v from public.ops_vehicle_state for update;
  if not v.offline_protocol_verified or not v.protocol_verified then raise exception 'Offline protocol not verified' using errcode='22023';end if;
  if (p_event->>'sequence')::bigint is distinct from v.last_sequence+1 then raise exception 'Offline queue must reconcile in order, without sequence gaps' using errcode='22023';end if;
  if occurred>clock_timestamp() then raise exception 'Offline event cannot be in the future' using errcode='22023';end if;
  if event_kind='offline_sync_complete' then
    if p_event->>'queue_empty' is distinct from 'true' or (p_event->>'invalidated_through')::bigint is null
      or (p_event->>'invalidated_through')::bigint<v.offline_manifest_version or p_event->>'motor_ready' is distinct from 'false'
      or p_event->>'stopped' is distinct from 'true' then raise exception 'Queue reconciliation, manifest invalidation and motor-off evidence required' using errcode='22023';end if;
    if exists(select 1 from public.ops_sessions where status not in ('Completed','Cancelled','Expired','Conflict','EndedPendingSync'))
      or exists(select 1 from public.ops_alert_episodes where kind in ('offline_conflict','confirmation_conflict') and resolved_at is null) then raise exception 'Unresolved Session/conflict prevents releasing offline lease' using errcode='22023';end if;
    update public.ops_sessions set status='Completed',version=version+1 where source='nfc_offline' and status='EndedPendingSync';
    update public.ops_offline_manifests set invalidated_at=now() where version<=(p_event->>'invalidated_through')::bigint and invalidated_at is null;
    update public.ops_vehicle_state set offline_reconciliation_required=false,offline_lease_until=null,last_sequence=(p_event->>'sequence')::bigint,motor_ready=false,stopped=true;
    return jsonb_build_object('accepted',true,'reconciled',true,'ack_event_id',p_event->>'event_id');
  end if;
  select * into m from public.ops_offline_manifests where version=(p_event->>'manifest_version')::bigint;
  if not found or m.invalidated_at is not null then raise exception 'Unknown/invalidated signed manifest' using errcode='22023';end if;
  select value into card from jsonb_array_elements(m.payload->'cards') where value->>'card_ref'=p_event->>'card_ref';
  if card is null or sid is null then raise exception 'Manifest card and offline Session id required' using errcode='22023';end if;
  uid:=(card->>'user_id')::uuid;local_time:=occurred at time zone 'Asia/Bangkok';
  select * into s from public.ops_sessions where id=sid for update;
  if event_kind in ('offline_start','offline_resume') then
    if occurred<m.issued_at or occurred>=m.expires_at then raise exception 'Manifest expired at Start/Resume' using errcode='22023';end if;
    if p_event->>'stopped' is distinct from 'true' or p_event->>'throttle_zero' is distinct from 'true' or p_event->>'bms_ok' is distinct from 'true'
      or p_event->>'proximity_user_id' is distinct from uid::text or p_event->>'motor_ready' is distinct from 'true' then raise exception 'Offline safety/proximity/Motor Ready proof required' using errcode='22023';end if;
    if card->>'role'<>'Manager' and (p_event->>'ai_ready' is distinct from 'true' or p_event->>'gps_reliable' is distinct from 'true') then raise exception 'Offline AI/GPS proof required' using errcode='22023';end if;
  end if;
  if event_kind='offline_start' then
    if p_event->>'inspection_confirmed' is distinct from 'true' then raise exception 'Local inspection attestation required' using errcode='22023';end if;
    if card->>'role'<>'Manager' and (m.payload->'allowed_weekdays' is null or m.payload->>'session_start' is null
      or m.payload->>'session_end' is null or not (m.payload->'allowed_weekdays' @> to_jsonb(extract(dow from local_time)::integer))
      or local_time::time<(m.payload->>'session_start')::time or local_time::time>=(m.payload->>'session_end')::time) then raise exception 'Offline Start is outside signed hours' using errcode='22023';end if;
    if s.id is not null or exists(select 1 from public.ops_sessions where status not in ('Completed','Cancelled','Expired','Conflict')) then conflict:=true;
    else
      insert into public.ops_sessions(id,user_id,request_id,status,source,created_at,expires_at,started_at)
        values(sid,uid,sid,'Active','nfc_offline',occurred,occurred+interval '5 minutes',occurred) returning * into s;
      insert into public.ops_inspection_attestations(session_id,user_id,confirmed_at,source) values(sid,uid,occurred,'nfc_offline');
    end if;
  else
    if s.id is null or s.user_id<>uid or s.source<>'nfc_offline' then conflict:=true;
    elsif event_kind='offline_resume' and s.status='Paused' then new_status:='Active';
    elsif event_kind='offline_pause' and s.status='Active' and p_event->>'stopped'='true' and p_event->>'motor_ready'='false' then new_status:='Paused';
    elsif event_kind='offline_end' and s.status in ('Active','Paused') and p_event->>'stopped'='true' and p_event->>'motor_ready'='false'
      and (p_event->>'return_zone_verified'='true' or (card->>'role'='Manager' and m.payload->'return_zone'='null'::jsonb and length(coalesce(p_event->>'reason',''))>=5)) then new_status:='EndedPendingSync';
    else conflict:=true;end if;
    if not conflict then update public.ops_sessions set status=new_status,ended_at=case when new_status='EndedPendingSync' then occurred else ended_at end,
      distance_km=case when new_status='EndedPendingSync' then (p_event->>'distance_km')::numeric else distance_km end,version=version+1 where id=sid returning * into s;end if;
  end if;
  update public.ops_vehicle_state set last_sequence=(p_event->>'sequence')::bigint,offline_reconciliation_required=true,motor_ready=(p_event->>'motor_ready')::boolean,stopped=(p_event->>'stopped')::boolean;
  if conflict then perform app_ops.alert('offline_conflict','เหตุการณ์ NFC ออฟไลน์ชนกับสถานะ Session','เก็บเหตุการณ์ไว้แล้ว ต้องตรวจรถและประสานสถานะก่อนเปิดสิทธิ์ใหม่',1);
    return jsonb_build_object('conflict',true,'ack_event_id',p_event->>'event_id');end if;
  return to_jsonb(s)||jsonb_build_object('ack_event_id',p_event->>'event_id');
end $$;

create or replace function app_ops.account_data_package(p_user uuid)
returns jsonb language sql set search_path='' as $$
  select jsonb_build_object('profile',(select to_jsonb(p) from public.profiles p where id=p_user),
    'email',(select email from auth.users where id=p_user),
    'trips',coalesce((select jsonb_agg(to_jsonb(s)) from public.ops_sessions s where user_id=p_user),'[]'::jsonb),
    'appeals',coalesce((select jsonb_agg(to_jsonb(a)) from public.ops_account_appeals a where user_id=p_user),'[]'::jsonb),
    'privacy_requests',coalesce((select jsonb_agg(to_jsonb(d)) from public.admin_data_subject_requests d where requester_id=p_user),'[]'::jsonb),
    'notices',coalesce((select jsonb_agg(to_jsonb(n)) from public.ops_user_notices n where user_id=p_user),'[]'::jsonb),
    'gps_reviews',coalesce((select jsonb_agg(to_jsonb(g)) from public.ops_gps_reviews g where user_id=p_user),'[]'::jsonb),
    'return_checks',coalesce((select jsonb_agg(to_jsonb(c)) from public.ops_return_location_checks c where user_id=p_user),'[]'::jsonb),
    'issue_reports',coalesce((select jsonb_agg(to_jsonb(i)) from public.ops_issue_reports i where user_id=p_user),'[]'::jsonb),
    'behavior_events',coalesce((select jsonb_agg(to_jsonb(e)) from public.ops_behavior_events e where user_id=p_user),'[]'::jsonb),
    'behavior_cycles',coalesce((select jsonb_agg(to_jsonb(c)) from public.ops_behavior_cycles c where user_id=p_user),'[]'::jsonb),
    'nfc_cards',coalesce((select jsonb_agg(to_jsonb(c)) from public.ops_nfc_cards c where user_id=p_user),'[]'::jsonb),
    'trip_reports',coalesce((select jsonb_agg(to_jsonb(r)) from public.ops_trip_reports r where user_id=p_user),'[]'::jsonb),
    'inspections',coalesce((select jsonb_agg(to_jsonb(i)) from public.ops_inspection_attestations i where user_id=p_user),'[]'::jsonb),
    'consents',coalesce((select jsonb_agg(to_jsonb(c)) from public.ops_consents c where user_id=p_user),'[]'::jsonb),
    'commands',coalesce((select jsonb_agg(to_jsonb(c)) from public.ops_commands c join public.ops_sessions s on s.id=c.session_id where s.user_id=p_user),'[]'::jsonb),
    'privacy_jobs',coalesce((select jsonb_agg(to_jsonb(j)-'lease_token') from public.ops_privacy_jobs j where subject_id=p_user),'[]'::jsonb),
    'shared_record_exclusions',jsonb_build_array('Raw offline manifests and Admin audit entries containing other people are handled by project policy'));
$$;

create or replace function public.privacy_worker_purge(p_job_id uuid,p_lease_token uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.ops_privacy_jobs%rowtype;uid uuid;session_ids uuid[];event_ids uuid[];request_ids uuid[];
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'Trusted privacy worker required' using errcode='42501';end if;
  perform pg_advisory_xact_lock(2661003::bigint);
  select * into j from public.ops_privacy_jobs where id=p_job_id and lease_token=p_lease_token and status='Running' and lease_until>now() for update;
  if not found or j.kind not in ('deletion','project_cleanup') then raise exception 'Current deletion worker lease required' using errcode='42501';end if;
  if j.data_purged_at is not null then return jsonb_build_object('purged',true,'duplicate',true);end if;
  uid:=j.subject_id;
  if exists(select 1 from public.ops_privacy_holds where user_id=uid and released_at is null) or exists(select 1 from public.ops_sessions where user_id=uid and status not in ('Completed','Cancelled','Expired','Conflict'))
    or exists(select 1 from public.ops_vehicle_state where offline_reconciliation_required) then raise exception 'Hold/Session/offline rights prevent cleanup' using errcode='22023';end if;
  if j.kind='deletion' and exists(select 1 from public.profiles where id=uid and role='Admin' and account_status='Approved') and (select count(*) from public.profiles where role='Admin' and account_status='Approved')<=1 then raise exception 'Final Admin cannot be deleted during the project' using errcode='22023';end if;
  update public.profiles set account_status='Suspended',driving_permission=false,account_status_reason='คำขอลบข้อมูลที่ผ่านการตรวจสอบแล้วกำลังดำเนินการ' where id=uid;
  select array_agg(id) into session_ids from public.ops_sessions where user_id=uid;
  select array_agg(id) into event_ids from public.ops_behavior_events where user_id=uid;
  select array_agg(id) into request_ids from public.admin_data_subject_requests where requester_id=uid;
  insert into public.ops_anonymous_daily_stats(day,session_count,total_duration_seconds,duration_count,total_distance_km,distance_count,unique_users)
    select (started_at at time zone 'Asia/Bangkok')::date,count(*),coalesce(sum(extract(epoch from ended_at-started_at)),0),count(ended_at),coalesce(sum(distance_km),0),count(distance_km),1
    from public.ops_sessions where user_id=uid and status='Completed' group by (started_at at time zone 'Asia/Bangkok')::date
    on conflict(day) do update set session_count=ops_anonymous_daily_stats.session_count+excluded.session_count,
      total_duration_seconds=ops_anonymous_daily_stats.total_duration_seconds+excluded.total_duration_seconds,duration_count=ops_anonymous_daily_stats.duration_count+excluded.duration_count,
      total_distance_km=ops_anonymous_daily_stats.total_distance_km+excluded.total_distance_km,distance_count=ops_anonymous_daily_stats.distance_count+excluded.distance_count,
      unique_users=ops_anonymous_daily_stats.unique_users+excluded.unique_users;
  update public.admin_portal_audit set reason='ข้อมูลส่วนบุคคลถูกลบตามนโยบาย',before_value='{}',after_value='{}',target_id='anonymized'
    where actor_id=uid or target_id=uid::text or target_id in(select unnest(session_ids)::text) or target_id in(select unnest(event_ids)::text) or target_id in(select unnest(request_ids)::text);
  update public.admin_account_review_audit set reason='ข้อมูลส่วนบุคคลถูกลบตามนโยบาย',actor_id=case when actor_id=uid then '00000000-0000-0000-0000-000000000000'::uuid else actor_id end,
    target_account_id=case when target_account_id=uid then '00000000-0000-0000-0000-000000000000'::uuid else target_account_id end where actor_id=uid or target_account_id=uid;
  update public.ops_alert_episodes set details='ข้อมูลส่วนบุคคลในรายงานถูกลบตามนโยบาย; สถานะความปลอดภัยยังคงเดิม'
    where kind in(select 'issue:'||category from public.ops_issue_reports where user_id=uid);
  delete from public.ops_alert_episodes where kind in(select 'no_show_review:'||unnest(event_ids)::text);
  delete from public.ops_behavior_reviews where event_id=any(event_ids);
  delete from public.ops_behavior_events where user_id=uid;
  delete from public.ops_behavior_cycles where user_id=uid;
  delete from public.ops_return_location_checks where user_id=uid;
  delete from public.ops_gps_reviews where user_id=uid;
  delete from public.ops_commands where session_id=any(session_ids);
  delete from public.ops_inspection_attestations where user_id=uid;
  delete from public.ops_issue_reports where user_id=uid;
  delete from public.ops_sessions where user_id=uid;
  delete from public.ops_user_notices where user_id=uid;
  delete from public.ops_consents where user_id=uid;
  delete from public.ops_account_appeals where user_id=uid;
  delete from public.ops_nfc_cards where user_id=uid;
  delete from public.ops_privacy_exports where user_id=uid;
  delete from public.admin_announcement_seen where user_id=uid;
  delete from public.ops_ingest_events where payload->>'user_id'=uid::text or payload->>'proximity_user_id'=uid::text or result->>'user_id'=uid::text
    or payload->>'session_id' in(select unnest(session_ids)::text) or payload->>'offline_session_id' in(select unnest(session_ids)::text);
  update public.admin_data_subject_requests set details='ข้อมูลส่วนบุคคลถูกลบตามนโยบาย',admin_note='',identity_method='',legal_basis='',fulfillment_evidence='' where requester_id=uid;
  update public.ops_privacy_jobs set subject_id=null where subject_id=uid and id<>j.id;
  update public.ops_privacy_jobs set data_purged_at=now() where id=j.id;
  return jsonb_build_object('purged',true,'user_id',uid);
end $$;

create or replace function public.privacy_worker_claim()
returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.ops_privacy_jobs%rowtype;
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'Trusted privacy worker required' using errcode='42501';end if;
  select * into j from public.ops_privacy_jobs where status='Pending' or (status='Running' and lease_until<=now()) order by created_at for update skip locked limit 1;
  if not found then return null;end if;
  if j.kind in ('deletion','project_cleanup') then
    -- Serialize a hold request against the point where external cleanup begins.
    perform 1 from public.profiles where id=j.subject_id for update;
    if not exists(select 1 from public.ops_project_config where privacy_policy_reviewed_at is not null)
      or exists(select 1 from public.ops_privacy_holds where user_id=j.subject_id and released_at is null)
      or exists(select 1 from public.ops_sessions where user_id=j.subject_id and status not in ('Completed','Cancelled','Expired','Conflict'))
      or exists(select 1 from public.ops_vehicle_state where offline_reconciliation_required) then
      update public.ops_privacy_jobs set status='Failed',last_error='Policy, legal hold, active Session or offline reconciliation prevents cleanup' where id=j.id;return null;end if;
  end if;
  update public.ops_privacy_jobs set status='Running',lease_token=gen_random_uuid(),lease_until=now()+interval '5 minutes',attempts=attempts+1 where id=j.id returning * into j;
  return to_jsonb(j);
end $$;

create or replace function public.privacy_worker_finish(p_job_id uuid,p_lease_token uuid,p_result jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.ops_privacy_jobs%rowtype;data jsonb;
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'Trusted privacy worker required' using errcode='42501';end if;
  select * into j from public.ops_privacy_jobs where id=p_job_id and lease_token=p_lease_token and status='Running' and lease_until>now() for update;
  if not found then raise exception 'Current worker lease required' using errcode='42501';end if;
  if p_result->>'ok' is distinct from 'true' then
    update public.ops_privacy_jobs set status='Failed',last_error=left(coalesce(p_result->>'error','Worker failed'),1000),lease_until=null,result=p_result where id=j.id;
    return jsonb_build_object('status','Failed');end if;
  if j.kind='access' then
    data:=app_ops.account_data_package(j.subject_id);
    insert into public.ops_privacy_exports(request_id,user_id,data) values(j.request_id,j.subject_id,data) on conflict(request_id) do update set data=excluded.data,created_at=now();
  else
    if exists(select 1 from public.ops_privacy_holds where user_id=j.subject_id and released_at is null) then
      raise exception 'Active hold blocks deletion completion' using errcode='22023';end if;
    if j.data_purged_at is null or exists(select 1 from auth.users where id=j.subject_id) then raise exception 'Actual data cleanup and Auth deletion must complete before fulfillment' using errcode='22023';end if;
  end if;
  update public.ops_privacy_jobs set status='Completed',completed_at=now(),lease_until=null,last_error='',subject_id=case when j.kind='access' then subject_id else null end,result=jsonb_build_object('ok',true,'completed_at',now()) where id=j.id;
  update public.admin_data_subject_requests set status='Completed',fulfilled_at=now(),fulfillment_evidence=case when j.kind='access' then 'Account-scoped data package generated and delivered in account' else 'Project records, storage and Auth account cleanup confirmed by worker' end,version=version+1 where id=j.request_id;
  return jsonb_build_object('status','Completed');
end $$;

create function app_ops.guard_privacy_hold_during_cleanup()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.released_at is null then
    perform 1 from public.profiles where id=new.user_id for update;
    if exists(select 1 from public.ops_privacy_jobs where subject_id=new.user_id and kind in ('deletion','project_cleanup') and status='Running') then
      raise exception 'Cleanup is running; a new hold cannot be recorded after the irreversible phase began' using errcode='22023';
    end if;
  end if;
  return new;
end $$;
create trigger guard_privacy_hold_during_cleanup before insert or update of released_at on public.ops_privacy_holds
for each row execute function app_ops.guard_privacy_hold_during_cleanup();

create or replace function public.my_operations_snapshot()
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; own_account jsonb;
begin
  if auth.uid() is null then raise exception 'Sign-in required' using errcode='42501'; end if;
  select jsonb_build_object('id',p.id,'name',p.full_name,'phone',p.phone,'role',p.role,
    'status',p.account_status,'account_status_reason',coalesce(p.account_status_reason,''),'driving_permission',p.driving_permission,'induction_confirmed',p.induction_confirmed)
    into own_account from public.profiles p where p.id=auth.uid();
  if own_account is null then raise exception 'Account not found' using errcode='42501';end if;
  select jsonb_build_object('account',own_account,
    'project_phone',(select project_phone from public.ops_project_config where singleton),
    'appeals',coalesce((select jsonb_agg(to_jsonb(a)-'account_updated_at' order by created_at desc)
      from public.ops_account_appeals a where user_id=auth.uid()),'[]'::jsonb),
    'nfc_card',(select to_jsonb(c)-'card_ref'-'registered_by' from public.ops_nfc_cards c
      where user_id=auth.uid() and revoked_at is null)) into result;
  return result||app_ops.user_session_snapshot()||app_ops.user_workflow_snapshot();
end $$;

revoke all on all functions in schema app_ops from public,anon,authenticated;
revoke all on function public.gateway_prepare_manifest(integer,text),public.privacy_worker_claim(),public.privacy_worker_purge(uuid,uuid),public.privacy_worker_finish(uuid,uuid,jsonb),public.my_operations_snapshot() from public,anon,authenticated;
grant execute on function public.gateway_prepare_manifest(integer,text),public.privacy_worker_claim(),public.privacy_worker_purge(uuid,uuid),public.privacy_worker_finish(uuid,uuid,jsonb) to service_role;
grant execute on function public.my_operations_snapshot() to authenticated;
