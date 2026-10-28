-- Extend deletion minimization to every user-linked Admin audit target.
create or replace function public.privacy_worker_purge(p_job_id uuid,p_lease_token uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.ops_privacy_jobs%rowtype;uid uuid;session_ids uuid[];event_ids uuid[];request_ids uuid[];related_ids text[];
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
  select array_agg(id::text) into related_ids from (
    select id from public.ops_privacy_holds where user_id=uid
    union all select id from public.ops_account_appeals where user_id=uid
    union all select id from public.ops_nfc_cards where user_id=uid
    union all select id from public.ops_issue_reports where user_id=uid
    union all select id from public.ops_gps_reviews where user_id=uid
    union all select id from public.ops_return_location_checks where user_id=uid
    union all select id from public.ops_trip_reports where user_id=uid
    union all select id from public.ops_behavior_cycles where user_id=uid
    union all select id from public.ops_inspection_attestations where user_id=uid
    union all select id from public.ops_user_notices where user_id=uid
    union all select id from public.ops_privacy_jobs where subject_id=uid
    union all select c.id from public.ops_commands c join public.ops_sessions s on s.id=c.session_id where s.user_id=uid
  ) records;
  insert into public.ops_anonymous_daily_stats(day,session_count,total_duration_seconds,duration_count,total_distance_km,distance_count,unique_users)
    select (started_at at time zone 'Asia/Bangkok')::date,count(*),coalesce(sum(extract(epoch from ended_at-started_at)),0),count(ended_at),coalesce(sum(distance_km),0),count(distance_km),1
    from public.ops_sessions where user_id=uid and status='Completed' group by (started_at at time zone 'Asia/Bangkok')::date
    on conflict(day) do update set session_count=ops_anonymous_daily_stats.session_count+excluded.session_count,
      total_duration_seconds=ops_anonymous_daily_stats.total_duration_seconds+excluded.total_duration_seconds,duration_count=ops_anonymous_daily_stats.duration_count+excluded.duration_count,
      total_distance_km=ops_anonymous_daily_stats.total_distance_km+excluded.total_distance_km,distance_count=ops_anonymous_daily_stats.distance_count+excluded.distance_count,
      unique_users=ops_anonymous_daily_stats.unique_users+excluded.unique_users;
  update public.admin_portal_audit set reason='ข้อมูลส่วนบุคคลถูกลบตามนโยบาย',before_value='{}',after_value='{}',target_id='anonymized'
    where actor_id=uid or target_id=uid::text or target_id in(select unnest(session_ids)::text) or target_id in(select unnest(event_ids)::text) or target_id in(select unnest(request_ids)::text) or target_id=any(related_ids)
      or position(uid::text in coalesce(before_value::text,''))>0
      or position(uid::text in coalesce(after_value::text,''))>0
      or position(uid::text in coalesce(reason,''))>0;
  update public.admin_account_review_audit set reason='ข้อมูลส่วนบุคคลถูกลบตามนโยบาย',actor_id=case when actor_id=uid then '00000000-0000-0000-0000-000000000000'::uuid else actor_id end,
    target_account_id=case when target_account_id=uid then '00000000-0000-0000-0000-000000000000'::uuid else target_account_id end where actor_id=uid or target_account_id=uid;
  update public.ops_alert_episodes set details='ข้อมูลส่วนบุคคลในรายงานถูกลบตามนโยบาย; สถานะความปลอดภัยยังคงเดิม'
    where kind in(select 'issue:'||category from public.ops_issue_reports where user_id=uid);
  delete from public.ops_alert_episodes where kind in(select 'no_show_review:'||unnest(event_ids)::text) or kind='gps_review:'||uid::text;
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
