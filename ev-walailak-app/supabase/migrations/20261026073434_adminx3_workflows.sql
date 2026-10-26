alter table public.ops_project_config add column retention_cleanup_authorized boolean not null default false;
alter table public.admin_data_subject_requests add column version integer not null default 1,
  add column identity_verified_at timestamptz,add column identity_verified_by uuid references auth.users(id),
  add column identity_method text not null default '',add column decision text,add column legal_basis text not null default '',
  add column fulfillment_evidence text not null default '',add column fulfilled_at timestamptz;
create table public.ops_trip_reports (
  id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),session_id uuid not null references public.ops_sessions(id) on delete cascade,
  details text not null check(length(btrim(details)) between 5 and 2000),status text not null default 'Pending' check(status in ('Pending','Resolved','Rejected')),
  admin_note text not null default '',created_at timestamptz not null default now(),reviewed_at timestamptz
);
create table public.ops_return_location_checks (
  id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),session_id uuid not null references public.ops_sessions(id),
  latitude double precision check(latitude between -90 and 90),longitude double precision check(longitude between -180 and 180),
  checked_at timestamptz not null default now(),result text not null default 'PendingVerification' check(result in ('PendingVerification','Passed','Failed')),
  verified_at timestamptz,raw_deleted_at timestamptz
);
create table public.ops_gps_reviews (
  id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),status text not null default 'Investigating' check(status in ('Investigating','Cleared','Confirmed')),
  start_restricted boolean not null default true,reason text not null,summary text not null default '',version integer not null default 1,
  called_at timestamptz,received_by uuid references auth.users(id),created_by uuid references auth.users(id),created_at timestamptz not null default now(),decision_at timestamptz
);
create unique index ops_open_gps_case on public.ops_gps_reviews(user_id) where status='Investigating';
create table public.ops_privacy_holds (
  id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),reason text not null,created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),released_at timestamptz,released_by uuid references auth.users(id),release_reason text
);
create table public.ops_privacy_jobs (
  id uuid primary key default gen_random_uuid(),request_id uuid references public.admin_data_subject_requests(id),user_id uuid references auth.users(id),subject_id uuid,
  kind text not null check(kind in ('access','deletion','project_cleanup')),status text not null default 'Pending' check(status in ('Pending','Running','Completed','Failed')),
  created_by uuid references auth.users(id),created_at timestamptz not null default now(),lease_token uuid,lease_until timestamptz,attempts integer not null default 0,
  last_error text not null default '',data_purged_at timestamptz,completed_at timestamptz,result jsonb
);
create unique index ops_one_request_job on public.ops_privacy_jobs(request_id) where request_id is not null;
create unique index ops_one_project_cleanup on public.ops_privacy_jobs(subject_id) where kind='project_cleanup';
create table public.ops_privacy_exports (
  id uuid primary key default gen_random_uuid(),request_id uuid not null unique references public.admin_data_subject_requests(id),
  user_id uuid not null references auth.users(id),data jsonb not null,created_at timestamptz not null default now()
);
create table public.ops_anonymous_daily_stats (
  day date primary key,session_count bigint not null,total_duration_seconds numeric not null,duration_count bigint not null,
  total_distance_km numeric not null,distance_count bigint not null,unique_users bigint not null
);

create function app_ops.validate_polygon(p_geometry jsonb)
returns void language plpgsql set search_path='' as $$
declare ring jsonb;point jsonb;previous_point jsonb;area double precision:=0;
begin
  if p_geometry->>'type' is distinct from 'Polygon' or jsonb_typeof(p_geometry->'coordinates') is distinct from 'array'
    or jsonb_array_length(p_geometry->'coordinates')<>1 then raise exception 'A Polygon with one closed ring is required' using errcode='22023';end if;
  ring:=p_geometry->'coordinates'->0;
  if jsonb_array_length(ring) not between 4 and 501 or ring->0 is distinct from ring->(jsonb_array_length(ring)-1) then raise exception 'Close the polygon and use 3 to 500 vertices' using errcode='22023';end if;
  for point in select value from jsonb_array_elements(ring) loop
    if jsonb_typeof(point)<>'array' or jsonb_array_length(point)<>2 or jsonb_typeof(point->0)<>'number' or jsonb_typeof(point->1)<>'number'
      or (point->>0)::double precision not between -180 and 180 or (point->>1)::double precision not between -90 and 90 then raise exception 'Valid longitude/latitude pairs are required' using errcode='22023';end if;
    if previous_point is not null then area:=area+(previous_point->>0)::double precision*(point->>1)::double precision-(point->>0)::double precision*(previous_point->>1)::double precision;end if;
    previous_point:=point;
  end loop;
  if abs(area)<0.000000000001 then raise exception 'Polygon must have a nonzero area' using errcode='22023';end if;
end $$;

create or replace function app_ops.user_workflow_action(p_action text,p_payload jsonb)
returns jsonb language plpgsql set search_path='' as $$
declare s public.ops_sessions%rowtype;result jsonb;
begin
  if p_action in ('report_trip','submit_return_location') then
    select * into s from public.ops_sessions where id=(p_payload->>'session_id')::uuid and user_id=auth.uid();
    if not found then raise exception 'Owned Session required' using errcode='42501';end if;
    if p_action='report_trip' then
      if s.status<>'Completed' then raise exception 'Completed personal trip required' using errcode='22023';end if;
      insert into public.ops_trip_reports(user_id,session_id,details) values(auth.uid(),s.id,btrim(p_payload->>'details')) returning to_jsonb(ops_trip_reports) into result;
    else
      if s.status<>'PendingEnd' then raise exception 'Phone location is only accepted for Pending End' using errcode='22023';end if;
      if exists(select 1 from public.ops_vehicle_state where gps_reliable and valid_until>now()) then raise exception 'Reliable vehicle GPS takes priority over phone location' using errcode='22023';end if;
      insert into public.ops_return_location_checks(user_id,session_id,latitude,longitude) values(auth.uid(),s.id,(p_payload->>'latitude')::double precision,(p_payload->>'longitude')::double precision) returning jsonb_build_object('id',id,'result',ops_return_location_checks.result,'checked_at',checked_at) into result;
    end if;return result;
  end if;return null;
end $$;

create or replace function app_ops.workflow_snapshot(p_date date)
returns jsonb language plpgsql set search_path='' as $$
declare stats jsonb;anon public.ops_anonymous_daily_stats%rowtype;
begin
  select * into anon from public.ops_anonymous_daily_stats where day=p_date;
  select jsonb_build_object('date',p_date,'session_count',count(*)+coalesce(anon.session_count,0),
    'duration_missing',count(*) filter(where ended_at is null)+coalesce(anon.session_count-anon.duration_count,0),
    'total_duration_seconds',coalesce(sum(extract(epoch from ended_at-started_at)),0)+coalesce(anon.total_duration_seconds,0),
    'average_duration_seconds',(coalesce(sum(extract(epoch from ended_at-started_at)),0)+coalesce(anon.total_duration_seconds,0))/nullif(count(ended_at)+coalesce(anon.duration_count,0),0),
    'distance_missing',count(*) filter(where distance_km is null)+coalesce(anon.session_count-anon.distance_count,0),
    'total_distance_km',case when count(distance_km)+coalesce(anon.distance_count,0)>0 then coalesce(sum(distance_km),0)+coalesce(anon.total_distance_km,0) else null end,
    'average_distance_km',(coalesce(sum(distance_km),0)+coalesce(anon.total_distance_km,0))/nullif(count(distance_km)+coalesce(anon.distance_count,0),0),
    'unique_users',count(distinct user_id)+coalesce(anon.unique_users,0)) into stats
    from public.ops_sessions where started_at is not null and (started_at at time zone 'Asia/Bangkok')::date=p_date and status<>'Conflict';
  return jsonb_build_object('daily_report',stats,
    'trip_reports',case when public.admin_is_approved() then coalesce((select jsonb_agg(to_jsonb(r)||jsonb_build_object('user_name',p.full_name,'trip',to_jsonb(s)-'user_id') order by r.created_at desc)
      from public.ops_trip_reports r join public.ops_sessions s on s.id=r.session_id join public.profiles p on p.id=r.user_id),'[]'::jsonb) else '[]'::jsonb end,
    'gps_reviews',coalesce((select jsonb_agg(to_jsonb(g)||jsonb_build_object('user_name',p.full_name) order by g.created_at desc) from public.ops_gps_reviews g left join public.profiles p on p.id=g.user_id),'[]'::jsonb),
    'return_checks',coalesce((select jsonb_agg(to_jsonb(c)-'latitude'-'longitude' order by checked_at desc) from public.ops_return_location_checks c),'[]'::jsonb),
    'privacy_requests',case when public.admin_is_approved() then coalesce((select jsonb_agg(to_jsonb(r)||jsonb_build_object('user_name',p.full_name) order by r.created_at desc)
      from public.admin_data_subject_requests r left join public.profiles p on p.id=r.requester_id),'[]'::jsonb) else '[]'::jsonb end,
    'privacy_jobs',case when public.admin_is_approved() then coalesce((select jsonb_agg(to_jsonb(j)-'lease_token' order by created_at desc) from public.ops_privacy_jobs j),'[]'::jsonb) else '[]'::jsonb end,
    'privacy_holds',case when public.admin_is_approved() then coalesce((select jsonb_agg(to_jsonb(h)) from public.ops_privacy_holds h),'[]'::jsonb) else '[]'::jsonb end,
    'manifests',coalesce((select jsonb_agg(jsonb_build_object('version',version,'issued_at',issued_at,'expires_at',expires_at,'key_id',key_id,'invalidated_at',invalidated_at) order by version desc) from public.ops_offline_manifests),'[]'::jsonb));
end $$;

create or replace function app_ops.user_workflow_snapshot()
returns jsonb language sql set search_path='' as $$
  select jsonb_build_object(
    'gps_reviews',coalesce((select jsonb_agg(to_jsonb(g)-'created_by'-'received_by' order by created_at desc) from public.ops_gps_reviews g where user_id=auth.uid()),'[]'::jsonb),
    'trip_reports',coalesce((select jsonb_agg(to_jsonb(r) order by created_at desc) from public.ops_trip_reports r where user_id=auth.uid()),'[]'::jsonb),
    'privacy_exports',coalesce((select jsonb_agg(to_jsonb(e)) from public.ops_privacy_exports e where user_id=auth.uid()),'[]'::jsonb));
$$;

-- Preserve the existing portal RPC, but route service/Privacy changes through the stronger checks.
alter function public.admin_portal_action(text,jsonb) set schema app_ops;
alter function app_ops.admin_portal_action(text,jsonb) rename to legacy_portal_action;
create function public.admin_portal_action(p_action text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.ops_sessions%rowtype;
begin
  perform app_ops.require_operator(true);
  if p_action='review_privacy_request' then
    raise exception 'Use the verified identity and fulfillment Privacy workflow' using errcode='22023';
  elsif p_action in ('set_manual_service_stop','set_safety_block','confirm_service_reopen') then
    perform pg_advisory_xact_lock(2661003::bigint);
    if (p_action='set_safety_block' and p_payload->>'enabled'='false') or p_action='confirm_service_reopen' then
      if p_payload->>'physical_inspection_confirmed' is distinct from 'true' then raise exception 'Physical inspection confirmation required' using errcode='22023';end if;
      perform app_ops.require_stopped(p_action='confirm_service_reopen');
      if p_action='confirm_service_reopen' and not exists(select 1 from public.ops_vehicle_state where bms_ok and throttle_zero) then raise exception 'Core vehicle safety evidence required' using errcode='22023';end if;
    end if;
    if p_action='set_manual_service_stop' and p_payload->>'enabled'='true' then
      for s in select * from public.ops_sessions where status='Reserved' for update loop
        update public.ops_sessions set status='Cancelled',end_reason='Admin stopped service; no user fault',version=version+1 where id=s.id;
        update public.ops_commands set confirmed_at=now() where id=s.command_id;
      end loop;
    end if;
  end if;
  return app_ops.legacy_portal_action(p_action,p_payload);
end $$;
revoke all on function public.admin_portal_action(text,jsonb) from public,anon,authenticated;
grant execute on function public.admin_portal_action(text,jsonb) to authenticated;

-- Check GPS restrictions on fresh start authorization without affecting an already Active Session.
alter function app_ops.driver_check(uuid,boolean) rename to base_driver_check;
create function app_ops.driver_check(p_user uuid,p_start boolean)
returns void language plpgsql set search_path='' as $$
begin
  if p_start and exists(select 1 from public.ops_gps_reviews where user_id=p_user and start_restricted) then raise exception 'GPS review temporarily restricts new authorization; contact the project' using errcode='42501';end if;
  perform app_ops.base_driver_check(p_user,p_start);
end $$;

create function public.privacy_worker_claim()
returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.ops_privacy_jobs%rowtype;
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'Trusted privacy worker required' using errcode='42501';end if;
  select * into j from public.ops_privacy_jobs where status='Pending' or (status='Running' and lease_until<=now()) order by created_at for update skip locked limit 1;
  if not found then return null;end if;
  if j.kind in ('deletion','project_cleanup') then
    if not exists(select 1 from public.ops_project_config where privacy_policy_reviewed_at is not null)
      or exists(select 1 from public.ops_privacy_holds where user_id=j.subject_id and released_at is null)
      or exists(select 1 from public.ops_sessions where user_id=j.subject_id and status not in ('Completed','Cancelled','Expired','Conflict'))
      or exists(select 1 from public.ops_vehicle_state where offline_reconciliation_required) then
      update public.ops_privacy_jobs set status='Failed',last_error='Policy, legal hold, active Session or offline reconciliation prevents cleanup' where id=j.id;return null;end if;
  end if;
  update public.ops_privacy_jobs set status='Running',lease_token=gen_random_uuid(),lease_until=now()+interval '5 minutes',attempts=attempts+1 where id=j.id returning * into j;
  return to_jsonb(j);
end $$;

create function app_ops.gateway_workflow_event(p_event jsonb)
returns jsonb language plpgsql set search_path='' as $$
declare c public.ops_return_location_checks%rowtype;s public.ops_sessions%rowtype;result jsonb;
begin
  select * into s from public.ops_sessions where id=(p_event->>'session_id')::uuid;
  if not found then raise exception 'Correlated Session required' using errcode='22023';end if;
  if p_event->>'kind'='phone_return_check' then
    select * into c from public.ops_return_location_checks where id=(p_event->>'check_id')::uuid and session_id=s.id for update;
    if not found or s.status<>'PendingEnd' or c.raw_deleted_at is not null then raise exception 'Current Pending End location check required' using errcode='22023';end if;
    if p_event->>'verification_method_validated' is distinct from 'true' then raise exception 'Validated anti-spoofing method required' using errcode='22023';end if;
    update public.ops_return_location_checks set result=case when p_event->>'passed'='true' then 'Passed' else 'Failed' end,verified_at=now() where id=c.id returning to_jsonb(ops_return_location_checks)-'latitude'-'longitude' into result;
  else
    insert into public.ops_gps_reviews(user_id,reason) values(s.user_id,'Trusted vehicle reported a return-location anomaly')
      on conflict(user_id) where status='Investigating' do update set reason=ops_gps_reviews.reason returning to_jsonb(ops_gps_reviews) into result;
    perform app_ops.notice(s.user_id,'gps_review','กำลังตรวจสอบพิกัดและจำกัดการเริ่ม Session ใหม่ชั่วคราว กรุณาโทรหมายเลขกลางโครงการ');
    perform app_ops.alert('gps_review:'||s.user_id::text,'ต้องตรวจสอบพิกัดคืนรถ','ตรวจหลักฐานพิกัดตามสิทธิ์; ไม่ระงับบัญชีอัตโนมัติ',2);
  end if;return result;
end $$;

create function app_ops.account_data_package(p_user uuid)
returns jsonb language sql set search_path='' as $$
  select jsonb_build_object('profile',(select to_jsonb(p) from public.profiles p where id=p_user),
    'email',(select email from auth.users where id=p_user),
    'trips',coalesce((select jsonb_agg(to_jsonb(s)) from public.ops_sessions s where user_id=p_user),'[]'::jsonb),
    'appeals',coalesce((select jsonb_agg(to_jsonb(a)) from public.ops_account_appeals a where user_id=p_user),'[]'::jsonb),
    'privacy_requests',coalesce((select jsonb_agg(to_jsonb(d)) from public.admin_data_subject_requests d where requester_id=p_user),'[]'::jsonb),
    'notices',coalesce((select jsonb_agg(to_jsonb(n)) from public.ops_user_notices n where user_id=p_user),'[]'::jsonb),
    'gps_reviews',coalesce((select jsonb_agg(to_jsonb(g)) from public.ops_gps_reviews g where user_id=p_user),'[]'::jsonb),
    'return_checks',coalesce((select jsonb_agg(to_jsonb(c)) from public.ops_return_location_checks c where user_id=p_user),'[]'::jsonb));
$$;

create function public.privacy_worker_finish(p_job_id uuid,p_lease_token uuid,p_result jsonb)
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
    if j.data_purged_at is null or exists(select 1 from auth.users where id=j.subject_id) then raise exception 'Actual data cleanup and Auth deletion must complete before fulfillment' using errcode='22023';end if;
  end if;
  update public.ops_privacy_jobs set status='Completed',completed_at=now(),lease_until=null,last_error='',subject_id=case when j.kind='access' then subject_id else null end,result=jsonb_build_object('ok',true,'completed_at',now()) where id=j.id;
  update public.admin_data_subject_requests set status='Completed',fulfilled_at=now(),fulfillment_evidence=case when j.kind='access' then 'Account-scoped data package generated and delivered in account' else 'Project records, storage and Auth account cleanup confirmed by worker' end,version=version+1 where id=j.request_id;
  return jsonb_build_object('status','Completed');
end $$;

-- Deleting an Auth identity must anonymize retained actor references rather than prevent fulfillment.
do $$ declare c record;begin
  for c in select con.conname,cl.relname,a.attname from pg_constraint con join pg_class cl on cl.oid=con.conrelid join pg_namespace ns on ns.oid=cl.relnamespace
    join pg_attribute a on a.attrelid=cl.oid and a.attnum=con.conkey[1]
    where con.contype='f' and con.confrelid='auth.users'::regclass and ns.nspname='public'
      and not exists(select 1 from pg_constraint pk where pk.conrelid=cl.oid and pk.contype='p' and a.attnum=any(pk.conkey)) loop
    execute format('alter table public.%I alter column %I drop not null',c.relname,c.attname);
    execute format('alter table public.%I drop constraint %I',c.relname,c.conname);
    execute format('alter table public.%I add constraint %I foreign key(%I) references auth.users(id) on delete set null',c.relname,c.conname,c.attname);
  end loop;
end $$;

create function public.privacy_worker_purge(p_job_id uuid,p_lease_token uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.ops_privacy_jobs%rowtype;uid uuid;session_ids uuid[];event_ids uuid[];
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
  insert into public.ops_anonymous_daily_stats(day,session_count,total_duration_seconds,duration_count,total_distance_km,distance_count,unique_users)
    select (started_at at time zone 'Asia/Bangkok')::date,count(*),coalesce(sum(extract(epoch from ended_at-started_at)),0),count(ended_at),coalesce(sum(distance_km),0),count(distance_km),1
    from public.ops_sessions where user_id=uid and status='Completed' group by (started_at at time zone 'Asia/Bangkok')::date
    on conflict(day) do update set session_count=ops_anonymous_daily_stats.session_count+excluded.session_count,
      total_duration_seconds=ops_anonymous_daily_stats.total_duration_seconds+excluded.total_duration_seconds,duration_count=ops_anonymous_daily_stats.duration_count+excluded.duration_count,
      total_distance_km=ops_anonymous_daily_stats.total_distance_km+excluded.total_distance_km,distance_count=ops_anonymous_daily_stats.distance_count+excluded.distance_count,
      unique_users=ops_anonymous_daily_stats.unique_users+excluded.unique_users;
  update public.admin_portal_audit set reason='ข้อมูลส่วนบุคคลถูกลบตามนโยบาย',before_value='{}',after_value='{}',target_id='anonymized'
    where actor_id=uid or target_id=uid::text or target_id in(select unnest(session_ids)::text) or target_id in(select unnest(event_ids)::text);
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

alter function public.operations_maintenance() set schema app_ops;
alter function app_ops.operations_maintenance() rename to session_maintenance;
create function public.operations_maintenance()
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;cfg public.ops_project_config%rowtype;
begin
  result:=app_ops.session_maintenance();
  update public.ops_return_location_checks set latitude=null,longitude=null,raw_deleted_at=now() where checked_at<=now()-interval '30 days' and raw_deleted_at is null;
  select * into cfg from public.ops_project_config;
  if cfg.retention_cleanup_authorized and cfg.privacy_policy_reviewed_at is not null and cfg.project_ended_at<=now() then
    insert into public.ops_privacy_jobs(user_id,subject_id,kind)
      select id,id,'project_cleanup' from public.profiles p where not exists(select 1 from public.ops_privacy_holds where user_id=p.id and released_at is null)
      on conflict(subject_id) where kind='project_cleanup' do nothing;
  end if;
  return result;
end $$;

do $$ declare t text;begin
  foreach t in array array['ops_trip_reports','ops_return_location_checks','ops_gps_reviews','ops_privacy_holds','ops_privacy_jobs','ops_privacy_exports','ops_anonymous_daily_stats'] loop
    execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated',t);
  end loop;
end $$;
revoke all on all functions in schema app_ops from public,anon,authenticated;
revoke all on function public.privacy_worker_claim(),public.privacy_worker_finish(uuid,uuid,jsonb),public.privacy_worker_purge(uuid,uuid),public.operations_maintenance() from public,anon,authenticated;
grant execute on function public.privacy_worker_claim(),public.privacy_worker_finish(uuid,uuid,jsonb),public.privacy_worker_purge(uuid,uuid),public.operations_maintenance() to service_role;

create function app_ops.require_stopped(p_idle boolean default false)
returns void language plpgsql set search_path='' as $$
begin
  if not exists(select 1 from public.ops_vehicle_state where stopped and motor_ready=false and online and protocol_verified and valid_until>now() and not offline_reconciliation_required) then
    raise exception 'Fresh trusted stopped and motor-off evidence required' using errcode='22023';end if;
  if p_idle and exists(select 1 from public.ops_sessions where status not in ('Completed','Cancelled','Expired','Conflict')) then raise exception 'No outstanding Session or lease is allowed' using errcode='22023';end if;
end $$;

create function app_ops.privacy_review(p_payload jsonb)
returns jsonb language plpgsql set search_path='' as $$
declare r public.admin_data_subject_requests%rowtype;old jsonb;result jsonb;cfg public.ops_project_config%rowtype;
  why text:=btrim(coalesce(p_payload->>'reason',''));choice text:=p_payload->>'decision';verified boolean;
begin
  perform app_ops.require_operator(true);
  select * into r from public.admin_data_subject_requests where id=(p_payload->>'id')::uuid for update;
  if not found or r.status not in ('Pending','InReview') or r.version is distinct from (p_payload->>'version')::integer then raise exception 'Privacy request changed; reload' using errcode='40001';end if;
  if length(why)<5 then raise exception 'A decision reason is required' using errcode='22023';end if;
  old:=to_jsonb(r);
  verified:=r.identity_verified_at is not null or (p_payload->>'identity_verified'='true' and length(coalesce(p_payload->>'identity_method',''))>=5);
  if choice in ('approve','fulfill_correction') then
    if verified is distinct from true then raise exception 'Identity verification is required before fulfillment' using errcode='22023';end if;
    if length(coalesce(p_payload->>'legal_basis',''))<5 then raise exception 'Record the reviewed legal/policy basis' using errcode='22023';end if;
    if r.request_type='deletion' then
      select * into cfg from public.ops_project_config;
      if cfg.privacy_policy_reviewed_at is null then raise exception 'Privacy policy must be reviewed before deletion' using errcode='22023';end if;
      if exists(select 1 from public.ops_privacy_holds where user_id=r.requester_id and released_at is null) then raise exception 'A legal/retention hold blocks deletion' using errcode='22023';end if;
      if exists(select 1 from public.ops_sessions where user_id=r.requester_id and status not in ('Completed','Cancelled','Expired','Conflict')) then raise exception 'Resolve the active Session before deletion' using errcode='22023';end if;
      if exists(select 1 from public.ops_vehicle_state where offline_reconciliation_required) then raise exception 'Reconcile offline rights before deletion' using errcode='22023';end if;
      if exists(select 1 from public.profiles where id=r.requester_id and role='Admin' and account_status='Approved')
        and (select count(*) from public.profiles where role='Admin' and account_status='Approved')<=1 then raise exception 'Cannot delete the final approved Admin during the project' using errcode='22023';end if;
    end if;
    update public.admin_data_subject_requests set identity_verified_at=coalesce(identity_verified_at,now()),identity_verified_by=coalesce(identity_verified_by,auth.uid()),
      identity_method=case when r.identity_verified_at is null then btrim(p_payload->>'identity_method') else identity_method end,
      decision='Approved',legal_basis=btrim(p_payload->>'legal_basis'),status='InReview',admin_note=why,version=version+1,reviewed_by=auth.uid(),reviewed_at=now() where id=r.id;
    if r.request_type='correction' then
      if choice<>'fulfill_correction' or (not (p_payload?'full_name') and not(p_payload?'phone')) or p_payload?'email' then raise exception 'Use the verified name/phone correction workflow; email is immutable' using errcode='22023';end if;
      update public.profiles set full_name=case when p_payload?'full_name' then btrim(p_payload->>'full_name') else full_name end,
        phone=case when p_payload?'phone' then btrim(p_payload->>'phone') else phone end where id=r.requester_id;
      if p_payload?'phone' and length(p_payload->>'phone')>30 then raise exception 'Phone is too long' using errcode='22023';end if;
      update public.admin_data_subject_requests set status='Completed',fulfilled_at=now(),fulfillment_evidence='Verified requested fields updated in profile' where id=r.id;
    else
      insert into public.ops_privacy_jobs(request_id,user_id,subject_id,kind,created_by) values(r.id,r.requester_id,r.requester_id,r.request_type,auth.uid())
        on conflict(request_id) where request_id is not null do nothing;
    end if;
  elsif choice='reject' then
    update public.admin_data_subject_requests set status='Rejected',decision='Rejected',admin_note=why,legal_basis=coalesce(p_payload->>'legal_basis',''),
      reviewed_by=auth.uid(),reviewed_at=now(),version=version+1 where id=r.id;
  elsif choice='review' then
    update public.admin_data_subject_requests set status='InReview',admin_note=why,reviewed_by=auth.uid(),reviewed_at=now(),version=version+1 where id=r.id;
  else raise exception 'Invalid privacy decision' using errcode='22023';end if;
  select to_jsonb(d) into result from public.admin_data_subject_requests d where id=r.id;
  perform app_ops.audit('review_privacy','privacy_request',r.id::text,why,old,result);return result;
end $$;

create or replace function app_ops.workflow_action(p_action text,p_payload jsonb)
returns jsonb language plpgsql set search_path='' as $$
declare old jsonb;result jsonb;s public.ops_sessions%rowtype;g public.ops_gps_reviews%rowtype;latest integer;why text:=btrim(coalesce(p_payload->>'reason',''));target uuid;
begin
  if p_action='review_privacy' then return app_ops.privacy_review(p_payload);end if;
  if p_action='service_control' then
    if p_payload->>'operation' not in ('set_manual_service_stop','set_safety_block','confirm_service_reopen') then raise exception 'Invalid service operation' using errcode='22023';end if;
    return public.admin_portal_action(p_payload->>'operation',p_payload);
  end if;
  if p_action in ('clear_safety_block','close_session_exception','resolve_vehicle_conflict') then
    perform app_ops.require_operator(false);
    if p_payload->>'physical_inspection_confirmed' is distinct from 'true' or length(why)<5 then raise exception 'Physical inspection confirmation and reason required' using errcode='22023';end if;
    perform pg_advisory_xact_lock(2661003::bigint);perform app_ops.require_stopped(false);
    if p_action='clear_safety_block' then
      select to_jsonb(v) into old from public.admin_vehicle_service v for update;
      update public.admin_vehicle_service set safety_block_active=false,final_confirmation_required=true,service_reason=why,updated_by=auth.uid(),updated_at=now() returning to_jsonb(admin_vehicle_service) into result;
      update public.ops_alert_episodes set resolved_at=now(),updated_at=now() where kind in ('issue:brakes','issue:throttle') and resolved_at is null;
    elsif p_action='close_session_exception' then
      select * into s from public.ops_sessions where id=(p_payload->>'id')::uuid and status in ('Active','Paused','PendingEnd','PendingPause','PendingResume','PendingStart') for update;
      if not found then raise exception 'Outstanding Session not found' using errcode='40001';end if;
      old:=to_jsonb(s);
      update public.ops_sessions set status=case when started_at is null then 'Cancelled' else 'Completed' end,
        ended_at=case when started_at is null then null else now() end,end_reason=why,version=version+1 where id=s.id returning to_jsonb(ops_sessions) into result;
      update public.ops_commands set confirmed_at=now() where session_id=s.id and confirmed_at is null;
      update public.admin_vehicle_service set safety_block_active=true,final_confirmation_required=true,service_reason='กรณีพิเศษ ต้องยืนยันรถปลอดภัยก่อนเปิดบริการ: '||why,updated_by=auth.uid(),updated_at=now();
    else
      if exists(select 1 from public.ops_sessions where status not in ('Completed','Cancelled','Expired','Conflict')) then raise exception 'Resolve the outstanding Session before closing a vehicle conflict' using errcode='22023';end if;
      update public.ops_alert_episodes set resolved_at=now(),updated_at=now(),details=why where kind in ('offline_conflict','confirmation_conflict') and resolved_at is null;
      update public.admin_vehicle_service set final_confirmation_required=true,service_reason=why,updated_by=auth.uid(),updated_at=now() returning to_jsonb(admin_vehicle_service) into result;
    end if;
    perform app_ops.audit(p_action,'vehicle',coalesce(p_payload->>'id','EV-01'),why,old,result);return result;
  end if;
  if p_action in ('save_zone','correct_trip','review_trip_report','open_gps_review','record_gps_call','reject_gps_summary_change','decide_gps_review','view_gps_evidence','configure_retention','privacy_hold','retry_privacy_job','publish_ride_policy') then
    perform app_ops.require_operator(true);
    if length(why) not between 5 and 2000 then raise exception 'A reason of 5 to 2000 characters is required' using errcode='22023';end if;
  end if;
  if p_action='save_zone' then
    perform pg_advisory_xact_lock(2661003::bigint);perform app_ops.require_stopped(true);
    if p_payload->>'kind' not in ('main','return') then raise exception 'Invalid zone kind' using errcode='22023';end if;
    perform app_ops.validate_polygon(p_payload->'geometry');
    select coalesce(max(version),0) into latest from public.ops_zones where kind=p_payload->>'kind';
    if latest is distinct from (p_payload->>'expected_version')::integer then raise exception 'Zone changed; reload' using errcode='40001';end if;
    select to_jsonb(z) into old from public.ops_zones z where kind=p_payload->>'kind' and active;
    update public.ops_zones set active=false where kind=p_payload->>'kind' and active;
    insert into public.ops_zones(kind,version,geometry,reason,created_by) values(p_payload->>'kind',latest+1,p_payload->'geometry',why,auth.uid()) returning to_jsonb(ops_zones) into result;
    perform app_ops.audit(p_action,'zone',p_payload->>'kind',why,old,result);return result;
  elsif p_action='correct_trip' then
    select * into s from public.ops_sessions where id=(p_payload->>'id')::uuid for update;
    if not found or s.status<>'Completed' or s.version is distinct from (p_payload->>'version')::integer then raise exception 'Completed trip changed; reload' using errcode='40001';end if;
    old:=jsonb_build_object('started_at',s.started_at,'ended_at',s.ended_at,'distance_km',s.distance_km);
    update public.ops_sessions set started_at=case when p_payload?'started_at' then (p_payload->>'started_at')::timestamptz else started_at end,
      ended_at=case when p_payload?'ended_at' then (p_payload->>'ended_at')::timestamptz else ended_at end,
      distance_km=case when p_payload?'distance_km' then nullif(p_payload->>'distance_km','')::numeric else distance_km end,version=version+1 where id=s.id returning to_jsonb(ops_sessions) into result;
    if nullif(p_payload->>'report_id','') is not null then
      update public.ops_trip_reports set status='Resolved',admin_note=why,reviewed_at=now() where id=(p_payload->>'report_id')::uuid and session_id=s.id;
      if not found then raise exception 'Report must belong to the corrected trip' using errcode='22023';end if;
    end if;
    perform app_ops.audit(p_action,'session',s.id::text,why,old,jsonb_build_object('started_at',result->'started_at','ended_at',result->'ended_at','distance_km',result->'distance_km'));return result;
  elsif p_action='review_trip_report' then
    update public.ops_trip_reports set status='Rejected',admin_note=why,reviewed_at=now() where id=(p_payload->>'id')::uuid and status='Pending' returning to_jsonb(ops_trip_reports) into result;
    if result is null then raise exception 'Open trip report not found' using errcode='40001';end if;
    perform app_ops.audit(p_action,'trip_report',p_payload->>'id',why,null,result);return result;
  elsif p_action='open_gps_review' then
    target:=(p_payload->>'user_id')::uuid;
    if not exists(select 1 from public.profiles where id=target and role<>'Admin') then raise exception 'Driver account required' using errcode='22023';end if;
    insert into public.ops_gps_reviews(user_id,reason,created_by) values(target,why,auth.uid()) returning to_jsonb(ops_gps_reviews) into result;
    perform app_ops.notice(target,'gps_review','กำลังตรวจสอบพิกัดและจำกัดการเริ่ม Session ใหม่ชั่วคราว กรุณาติดต่อหมายเลขกลางโครงการเพื่อชี้แจง');
    perform app_ops.audit(p_action,'gps_review',result->>'id',why,null,result);return result;
  elsif p_action in ('record_gps_call','reject_gps_summary_change','decide_gps_review') then
    select * into g from public.ops_gps_reviews where id=(p_payload->>'id')::uuid for update;
    if not found or g.version is distinct from (p_payload->>'version')::integer then raise exception 'GPS review changed; reload' using errcode='40001';end if;
    old:=to_jsonb(g);
    if p_action='record_gps_call' then
      if length(btrim(coalesce(p_payload->>'summary',''))) not between 5 and 2000 or nullif(p_payload->>'called_at','') is null then raise exception 'Phone-call text and call time required' using errcode='22023';end if;
      update public.ops_gps_reviews set summary=btrim(p_payload->>'summary'),called_at=(p_payload->>'called_at')::timestamptz,received_by=auth.uid(),version=version+1 where id=g.id returning to_jsonb(ops_gps_reviews) into result;
      if g.summary<>'' then perform app_ops.notice(g.user_id,'gps_summary_edited','Admin แก้ไขสรุปคำชี้แจง: '||why,null,true);end if;
    elsif p_action='reject_gps_summary_change' then
      perform app_ops.notice(g.user_id,'gps_summary_change_rejected','ไม่อนุมัติคำขอแก้ไขสรุปคำชี้แจง: '||why);
      update public.ops_gps_reviews set version=version+1 where id=g.id returning to_jsonb(ops_gps_reviews) into result;
    else
      if p_payload->>'decision' not in ('clear','confirm') then raise exception 'GPS decision required' using errcode='22023';end if;
      if p_payload->>'decision'='confirm' then perform public.admin_update_account(g.user_id,'suspend','',why);end if;
      update public.ops_gps_reviews set status=case when p_payload->>'decision'='clear' then 'Cleared' else 'Confirmed' end,start_restricted=p_payload->>'decision'<>'clear',decision_at=now(),reason=why,version=version+1 where id=g.id returning to_jsonb(ops_gps_reviews) into result;
      perform app_ops.notice(g.user_id,'gps_review_decision',case when p_payload->>'decision'='clear' then 'ตรวจสอบเสร็จสิ้น ไม่พบการปลอมแปลงพิกัด และปลดข้อจำกัดพิกัดแล้ว: ' else 'ตรวจสอบเสร็จสิ้นและ Admin ระงับบัญชีตามผลตรวจ: ' end||why);
    end if;
    perform app_ops.audit(p_action,'gps_review',g.id::text,why,old,result);return result;
  elsif p_action='view_gps_evidence' then
    update public.ops_return_location_checks set latitude=null,longitude=null,raw_deleted_at=now()
      where id=(p_payload->>'id')::uuid and checked_at<=now()-interval '30 days' and raw_deleted_at is null;
    select to_jsonb(c) into result from public.ops_return_location_checks c where id=(p_payload->>'id')::uuid;
    if result is null then raise exception 'Return check not found' using errcode='P0002';end if;
    perform app_ops.audit(p_action,'return_check',p_payload->>'id',why,null,jsonb_build_object('accessed',true));return result;
  elsif p_action='privacy_hold' then
    target:=(p_payload->>'user_id')::uuid;
    if p_payload->>'enabled'='true' then insert into public.ops_privacy_holds(user_id,reason,created_by) values(target,why,auth.uid()) returning to_jsonb(ops_privacy_holds) into result;
    else update public.ops_privacy_holds set released_at=now(),released_by=auth.uid(),release_reason=why where id=(p_payload->>'id')::uuid and released_at is null returning to_jsonb(ops_privacy_holds) into result;end if;
    if result is null then raise exception 'Hold not found' using errcode='P0002';end if;
    perform app_ops.audit(p_action,'privacy_hold',result->>'id',why,null,result);return result;
  elsif p_action='configure_retention' then
    select to_jsonb(c) into old from public.ops_project_config c for update;
    if (old->>'version')::integer is distinct from (p_payload->>'version')::integer then raise exception 'Settings changed; reload' using errcode='40001';end if;
    update public.ops_project_config set project_ended_at=nullif(p_payload->>'project_ended_at','')::timestamptz,
      retention_cleanup_authorized=coalesce((p_payload->>'retention_cleanup_authorized')::boolean,false),version=version+1,updated_at=now()
      returning to_jsonb(ops_project_config) into result;
    if result->>'retention_cleanup_authorized'='true' and (result->>'privacy_policy_reviewed_at' is null or result->>'project_ended_at' is null) then raise exception 'Reviewed policy and project end date required before authorizing cleanup' using errcode='22023';end if;
    perform app_ops.audit(p_action,'settings','retention',why,old,result);return result;
  elsif p_action='retry_privacy_job' then
    update public.ops_privacy_jobs set status='Pending',last_error='',lease_token=null,lease_until=null where id=(p_payload->>'id')::uuid and status='Failed' returning to_jsonb(ops_privacy_jobs) into result;
    if result is null then raise exception 'Failed job not found' using errcode='40001';end if;
    perform app_ops.audit(p_action,'privacy_job',p_payload->>'id',why,null,result);return result;
  elsif p_action='publish_ride_policy' then
    if length(coalesce(p_payload->>'privacy_notice_version',''))<1 or length(coalesce(p_payload->>'terms_version',''))<1
      or length(coalesce(p_payload->>'privacy_notice_text',''))<5 or length(coalesce(p_payload->>'terms_text',''))<5
      or p_payload->>'advisor_review_confirmed' is distinct from 'true' then raise exception 'Reviewed notice/terms text, versions and advisor confirmation required' using errcode='22023';end if;
    select to_jsonb(c) into old from public.ops_project_config c for update;
    update public.ops_project_config set privacy_notice_version=p_payload->>'privacy_notice_version',terms_version=p_payload->>'terms_version',privacy_notice_text=p_payload->>'privacy_notice_text',terms_text=p_payload->>'terms_text',version=version+1 returning to_jsonb(ops_project_config) into result;
    perform app_ops.audit(p_action,'settings','ride_policy',why,old,result);return result;
  end if;
  return null;
end $$;

revoke all on all functions in schema app_ops from public,anon,authenticated;
