-- Web authorization is separate from a trusted motor confirmation.
alter table public.ops_project_config add column privacy_notice_version text, add column terms_version text;
create table public.ops_vehicle_state (
  vehicle_id text primary key check(vehicle_id='EV-01'), telemetry_at timestamptz, valid_until timestamptz,
  online boolean, protocol_verified boolean not null default false,
  stopped boolean, throttle_zero boolean,bms_ok boolean,ai_ready boolean,gps_reliable boolean,motor_ready boolean,
  latitude double precision check(latitude between -90 and 90),longitude double precision check(longitude between -180 and 180),
  gps_at timestamptz,battery_percent numeric check(battery_percent between 0 and 100),last_sequence bigint not null default 0
);
insert into public.ops_vehicle_state(vehicle_id) values('EV-01');
alter table public.ops_vehicle_state add column offline_protocol_verified boolean not null default false,
  add column offline_reconciliation_required boolean not null default false,add column offline_manifest_version bigint not null default 0,
  add column offline_lease_until timestamptz;
create table public.ops_offline_manifests (
  version bigint primary key,payload jsonb not null,issued_at timestamptz not null,expires_at timestamptz not null,key_id text not null,
  invalidated_at timestamptz,check(expires_at<=issued_at+interval '24 hours')
);
create table public.ops_zones (
  kind text not null check(kind in ('return','main')),version integer not null default 1,active boolean not null default true,
  geometry jsonb not null,reason text not null,created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),
  primary key(kind,version)
);
create unique index ops_active_zone on public.ops_zones(kind) where active;
create table public.ops_sessions (
  id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),vehicle_id text not null default 'EV-01' references public.ops_vehicle_state(vehicle_id),
  request_id uuid not null,command_id uuid not null default gen_random_uuid(),
  status text not null default 'Reserved' check(status in ('Reserved','PendingStart','Active','Paused','PendingPause','PendingResume','PendingEnd','Completed','Cancelled','Expired','Conflict','EndedPendingSync')),
  source text not null default 'web' check(source in ('web','nfc_online','nfc_offline')),
  created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '5 minutes',
  started_at timestamptz,ended_at timestamptz,distance_km numeric check(distance_km>=0),version integer not null default 1,
  end_reason text not null default '',unique(user_id,request_id),check(expires_at<=created_at+interval '5 minutes'),check(ended_at is null or started_at is null or ended_at>=started_at)
);
create unique index ops_one_vehicle_lease on public.ops_sessions(vehicle_id) where status not in ('Completed','Cancelled','Expired','Conflict');
create unique index ops_one_rider_lease on public.ops_sessions(user_id) where status not in ('Completed','Cancelled','Expired','Conflict');
create index ops_session_history on public.ops_sessions(user_id,started_at desc);
create table public.ops_commands (
  id uuid primary key,session_id uuid not null references public.ops_sessions(id),action text not null,created_at timestamptz not null default now(),confirmed_at timestamptz
);
create table public.ops_inspection_attestations (
  id uuid primary key default gen_random_uuid(),session_id uuid not null unique references public.ops_sessions(id),
  user_id uuid not null references auth.users(id),confirmed_at timestamptz not null default now(),source text not null check(source in ('web','nfc_offline'))
);
create table public.ops_consents (
  user_id uuid not null references auth.users(id),privacy_version text not null,terms_version text not null,accepted_at timestamptz not null default now(),primary key(user_id,privacy_version,terms_version)
);
create table public.ops_ingest_events (
  event_id uuid primary key,vehicle_id text not null,kind text not null,sequence bigint,occurred_at timestamptz not null,received_at timestamptz not null default now(),payload jsonb not null,result jsonb not null default '{}'
);
create table public.ops_alert_episodes (
  id uuid primary key default gen_random_uuid(),vehicle_id text not null default 'EV-01',kind text not null,
  title text not null,details text not null,priority integer not null check(priority between 1 and 3),
  opened_at timestamptz not null default now(),updated_at timestamptz not null default now(),resolved_at timestamptz,
  acknowledged_by uuid references auth.users(id),acknowledged_at timestamptz
);
create unique index ops_ongoing_alert on public.ops_alert_episodes(vehicle_id,kind) where resolved_at is null;
create index ops_alert_priority on public.ops_alert_episodes(priority,opened_at desc);
create table public.ops_issue_reports (
  id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),session_id uuid references public.ops_sessions(id),
  category text not null check(category in ('brakes','throttle','battery','gps','nfc','network','other')),
  details text not null check(length(btrim(details)) between 5 and 2000),high_risk boolean not null,created_at timestamptz not null default now()
);
create table public.ops_behavior_cycles (
  id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),kind text not null check(kind in ('Cancellation','NoShow')),
  started_at timestamptz not null default now(),closed_at timestamptz,count_value integer not null default 0 check(count_value>=0),
  compensation_count integer not null default 0 check(compensation_count>=0),policy jsonb not null default '{}',
  restricted_from timestamptz,restricted_until timestamptz,release_pending boolean not null default false
);
create unique index ops_current_cycle on public.ops_behavior_cycles(user_id,kind) where closed_at is null;
create table public.ops_behavior_events (
  id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),session_id uuid not null references public.ops_sessions(id),
  kind text not null check(kind in ('Cancellation','NoShow')),occurred_at timestamptz not null default now(),
  counted boolean not null default true,cycle_id uuid references public.ops_behavior_cycles(id),
  fault_status text not null default 'Counted' check(fault_status in ('Counted','UnderReview','Reopened','Exempt','Rejected','InsufficientEvidence')),
  first_requested_at timestamptz,unique(session_id,kind)
);
create index ops_behavior_count on public.ops_behavior_events(user_id,kind,occurred_at) where counted;
create table public.ops_behavior_reviews (
  id uuid primary key default gen_random_uuid(),event_id uuid not null references public.ops_behavior_events(id),actor_id uuid not null references auth.users(id),
  decision text not null,evidence text not null,reason text not null,created_at timestamptz not null default now()
);
create table public.ops_user_notices (
  id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),kind text not null,
  message text not null,created_at timestamptz not null default now(),expires_at timestamptz,
  acknowledgment_required boolean not null default false,acknowledged_at timestamptz
);

create function app_ops.alert(p_kind text,p_title text,p_details text,p_priority integer)
returns uuid language plpgsql set search_path='' as $$
declare result uuid;
begin
  insert into public.ops_alert_episodes(kind,title,details,priority) values(p_kind,p_title,p_details,p_priority)
    on conflict(vehicle_id,kind) where resolved_at is null do update set details=excluded.details,updated_at=now()
    returning id into result; return result;
end $$;
create function app_ops.notice(p_user uuid,p_kind text,p_message text,p_days integer default null,p_ack boolean default false)
returns void language sql set search_path='' as $$
  insert into public.ops_user_notices(user_id,kind,message,expires_at,acknowledgment_required)
  values(p_user,p_kind,p_message,case when p_days is null then null else now()+make_interval(days=>p_days) end,p_ack);
$$;
create function app_ops.expire_cycles(p_user uuid default null)
returns void language plpgsql set search_path='' as $$
begin
  update public.ops_behavior_cycles set closed_at=now(),release_pending=false
    where closed_at is null and restricted_until<=now() and (p_user is null or user_id=p_user);
  update public.ops_behavior_cycles c set count_value=greatest((select count(*)::integer from public.ops_behavior_events e
    where e.cycle_id=c.id and e.counted and e.occurred_at>=now()-make_interval(hours=>(c.policy->>'window_hours')::integer))-c.compensation_count,0)
    where c.closed_at is null and c.restricted_until is null and (c.policy->>'window_hours') is not null and (p_user is null or c.user_id=p_user);
end $$;
create function app_ops.evaluate_event(p_event uuid)
returns void language plpgsql set search_path='' as $$
declare e public.ops_behavior_events%rowtype;c public.ops_behavior_cycles%rowtype;s public.admin_portal_settings%rowtype;cfg public.ops_project_config%rowtype;
  lim integer;cool integer;win integer;warn integer;counted_events integer;new_policy jsonb;
begin
  select * into e from public.ops_behavior_events where id=p_event for update;
  perform app_ops.expire_cycles(e.user_id);
  select * into c from public.ops_behavior_cycles where user_id=e.user_id and kind=e.kind and closed_at is null for update;
  if not found then insert into public.ops_behavior_cycles(user_id,kind) values(e.user_id,e.kind) returning * into c;end if;
  update public.ops_behavior_events set cycle_id=c.id where id=p_event;
  select * into s from public.admin_portal_settings where singleton;
  select * into cfg from public.ops_project_config where singleton;
  if e.kind='Cancellation' then lim:=s.cancellation_limit;cool:=s.cancellation_cooldown_hours;win:=cfg.cancellation_window_hours;warn:=cfg.cancellation_warning_remaining;
  else lim:=s.no_show_limit;cool:=s.no_show_cooldown_hours;win:=cfg.no_show_window_hours;warn:=cfg.no_show_warning_remaining;end if;
  select greatest(count(*)::integer-c.compensation_count,0) into counted_events from public.ops_behavior_events
    where cycle_id=c.id and counted and (win is null or occurred_at>=now()-make_interval(hours=>win));
  new_policy:=jsonb_build_object('limit',lim,'cooldown_hours',cool,'window_hours',win,'warning_remaining',warn,'config_version',cfg.version,'settings_effective_from',s.effective_from,'evaluated_at',now());
  update public.ops_behavior_cycles set count_value=counted_events,
    policy=case when restricted_until>now() then policy else new_policy end,
    restricted_from=case when restricted_until>now() then restricted_from when lim is not null and cool is not null and win is not null and counted_events>=lim then now() else restricted_from end,
    restricted_until=case when restricted_until>now() then restricted_until when lim is not null and cool is not null and win is not null and counted_events>=lim then now()+make_interval(hours=>cool) else restricted_until end
    where id=c.id;
end $$;

create function app_ops.expire_reservation()
returns void language plpgsql set search_path='' as $$
declare s public.ops_sessions%rowtype;e uuid;blocked boolean;
begin
  select manual_out_of_service or safety_block_active or final_confirmation_required into blocked from public.admin_vehicle_service where singleton;
  for s in select * from public.ops_sessions where status='Reserved' and expires_at<=now() for update loop
    update public.ops_sessions set status='Expired',version=version+1 where id=s.id;
    insert into public.ops_behavior_events(user_id,session_id,kind,occurred_at,counted,fault_status)
      values(s.user_id,s.id,'NoShow',s.expires_at,not blocked,case when blocked then 'Exempt' else 'Counted' end)
      on conflict do nothing returning id into e;
    if e is not null and not blocked then perform app_ops.evaluate_event(e);end if;
  end loop;
  -- PendingStart is deliberately not expired: an ambiguous motor result must reconcile first.
end $$;

create function app_ops.driver_check(p_user uuid,p_start boolean)
returns void language plpgsql set search_path='' as $$
declare p public.profiles%rowtype;s public.admin_portal_settings%rowtype;v public.ops_vehicle_state%rowtype;t timestamp:=now() at time zone 'Asia/Bangkok';c public.ops_behavior_cycles%rowtype;
begin
  select * into p from public.profiles where id=p_user;
  if p.role='Admin' then raise exception 'Admin is not a driver' using errcode='42501';end if;
  if p.account_status is distinct from 'Approved' then raise exception 'Approved driver account required' using errcode='42501';end if;
  if p.driving_permission is distinct from true or p.induction_confirmed is distinct from true then raise exception 'Driving Permission and induction required' using errcode='42501';end if;
  perform app_ops.expire_cycles(p_user);
  for c in select * from public.ops_behavior_cycles where user_id=p_user and closed_at is null and restricted_until>now() loop
    raise exception '% restriction until %',c.kind,c.restricted_until using errcode='42501';end loop;
  if exists(select 1 from public.admin_vehicle_service where manual_out_of_service or safety_block_active or final_confirmation_required) then
    raise exception 'Vehicle is unavailable for new authorization' using errcode='22023';end if;
  select * into v from public.ops_vehicle_state where vehicle_id='EV-01';
  if v.valid_until is null or v.valid_until<=now() or v.online is distinct from true or v.protocol_verified is distinct from true then
    raise exception 'Trusted vehicle telemetry/evidence is missing or expired' using errcode='22023';end if;
  if p_start and v.offline_reconciliation_required then raise exception 'Offline manifest lease must be invalidated and reconciled before online start' using errcode='22023';end if;
  if v.stopped is distinct from true or v.throttle_zero is distinct from true or v.bms_ok is distinct from true then
    raise exception 'Vehicle safety evidence is not ready' using errcode='22023';end if;
  if p.role in ('Student','Employee') then
    if v.ai_ready is distinct from true or v.gps_reliable is distinct from true then raise exception 'AI/GPS readiness required' using errcode='22023';end if;
    if not exists(select 1 from public.ops_zones where kind='main' and active) or not exists(select 1 from public.ops_zones where kind='return' and active) then
      raise exception 'Main Geofence and Return Zone are not configured' using errcode='22023';end if;
    if p_start then
      select * into s from public.admin_portal_settings where singleton;
      if s.allowed_weekdays is null or s.session_start is null or s.session_end is null then raise exception 'Session start hours are not configured' using errcode='22023';end if;
      if not(extract(dow from t)::smallint=any(s.allowed_weekdays)) or t::time<s.session_start or t::time>=s.session_end then
        raise exception 'Outside configured Session start hours' using errcode='42501';end if;
    end if;
  end if;
end $$;

create function public.request_web_session(p_inspection_confirmed boolean,p_terms_confirmed boolean,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.ops_sessions%rowtype;cfg public.ops_project_config%rowtype;
begin
  if auth.uid() is null then raise exception 'Sign-in required' using errcode='42501';end if;
  perform pg_advisory_xact_lock(2661003::bigint);
  -- Check the current account before returning an idempotent previous authorization.
  if not exists(select 1 from public.profiles where id=auth.uid() and account_status='Approved' and role<>'Admin' and driving_permission and induction_confirmed) then
    if exists(select 1 from public.profiles where id=auth.uid() and role='Admin') then raise exception 'Admin is not a driver' using errcode='42501';end if;
    if exists(select 1 from public.profiles where id=auth.uid() and account_status<>'Approved') then raise exception 'Approved driver required' using errcode='42501';end if;
    raise exception 'Driving Permission required' using errcode='42501';end if;
  select * into s from public.ops_sessions where user_id=auth.uid() and request_id=p_request_id;
  if found then return to_jsonb(s);end if;
  perform app_ops.expire_reservation();
  perform app_ops.driver_check(auth.uid(),true);
  if p_inspection_confirmed is distinct from true then raise exception 'Pre-ride inspection must be confirmed' using errcode='22023';end if;
  select * into cfg from public.ops_project_config where singleton;
  if p_terms_confirmed is distinct from true or cfg.privacy_notice_version is null or cfg.terms_version is null then
    raise exception 'Published Privacy Notice and terms acceptance required' using errcode='22023';end if;
  if exists(select 1 from public.ops_sessions where status not in ('Completed','Cancelled','Expired','Conflict')) then raise exception 'Vehicle is busy or reserved' using errcode='22023';end if;
  if exists(select 1 from public.ops_vehicle_state where motor_ready is distinct from false) then raise exception 'Motor state unresolved' using errcode='22023';end if;
  if p_request_id is null then raise exception 'Request id is required' using errcode='22023';end if;
  insert into public.ops_sessions(user_id,request_id) values(auth.uid(),p_request_id) returning * into s;
  insert into public.ops_commands(id,session_id,action) values(s.command_id,s.id,'start');
  insert into public.ops_inspection_attestations(session_id,user_id,source) values(s.id,auth.uid(),'web');
  insert into public.ops_consents(user_id,privacy_version,terms_version) values(auth.uid(),cfg.privacy_notice_version,cfg.terms_version) on conflict do nothing;
  return to_jsonb(s);
end $$;

create function public.session_owner_action(p_session_id uuid,p_action text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.ops_sessions%rowtype;e uuid;new_status text;command uuid;
begin
  if auth.uid() is null then raise exception 'Sign-in required' using errcode='42501';end if;
  perform pg_advisory_xact_lock(2661003::bigint);
  perform app_ops.expire_reservation();
  select * into s from public.ops_sessions where id=p_session_id and user_id=auth.uid() for update;
  if not found then raise exception 'Owned Session not found' using errcode='42501';end if;
  if p_action='cancel' then
    if s.status<>'Reserved' then raise exception 'Only an unstarted reservation may be cancelled' using errcode='22023';end if;
    update public.ops_sessions set status='Cancelled',version=version+1 where id=s.id returning * into s;
    update public.ops_commands set confirmed_at=now() where id=s.command_id;
    insert into public.ops_behavior_events(user_id,session_id,kind) values(auth.uid(),s.id,'Cancellation') returning id into e;
    perform app_ops.evaluate_event(e);return to_jsonb(s);
  elsif p_action='pause' and s.status='Active' then new_status:='PendingPause';
  elsif p_action='resume' and s.status='Paused' then perform app_ops.driver_check(auth.uid(),false);new_status:='PendingResume';
  elsif p_action='end' and s.status in ('Active','Paused','PendingEnd') then new_status:='PendingEnd';
  else raise exception 'Session action does not match current state' using errcode='22023';end if;
  if not exists(select 1 from public.ops_vehicle_state where stopped and valid_until>now()) then raise exception 'Fresh stopped evidence required; no motor command sent' using errcode='22023';end if;
  command:=gen_random_uuid();
  update public.ops_sessions set status=new_status,command_id=command,version=version+1 where id=s.id returning * into s;
  insert into public.ops_commands(id,session_id,action) values(command,s.id,p_action);return to_jsonb(s);
end $$;

create function public.vehicle_ingest_event(p_event jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  s public.ops_sessions%rowtype;v public.ops_vehicle_state%rowtype;previous public.ops_ingest_events%rowtype;
  incoming_event_id uuid:=(p_event->>'event_id')::uuid;occurred timestamptz:=(p_event->>'occurred_at')::timestamptz;
  kind text:=p_event->>'kind';result jsonb;problem text;new_status text;
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'Trusted vehicle service required' using errcode='42501';end if;
  if incoming_event_id is null or occurred is null or p_event->>'vehicle_id' is distinct from 'EV-01' then raise exception 'Bound vehicle, event ID and timestamp required' using errcode='22023';end if;
  perform pg_advisory_xact_lock(2661003::bigint);
  select * into previous from public.ops_ingest_events where event_id=incoming_event_id;
  if found then
    if previous.payload is distinct from (p_event-'latitude'-'longitude') then raise exception 'Event ID reused with different payload' using errcode='22023';end if;
    return previous.result||jsonb_build_object('duplicate',true);
  end if;
  select * into v from public.ops_vehicle_state where vehicle_id='EV-01' for update;
  if kind='telemetry' then
    if (p_event->>'sequence')::bigint is null or (p_event->>'sequence')::bigint<=v.last_sequence then raise exception 'Stale vehicle sequence' using errcode='22023';end if;
    if occurred>clock_timestamp() or (v.telemetry_at is not null and occurred<v.telemetry_at) then raise exception 'Invalid telemetry timestamp' using errcode='22023';end if;
    update public.ops_vehicle_state set telemetry_at=occurred,valid_until=nullif(p_event->>'valid_until','')::timestamptz,
      online=(p_event->>'online')::boolean,protocol_verified=coalesce((p_event->>'protocol_verified')::boolean,false),
      offline_protocol_verified=coalesce((p_event->>'offline_protocol_verified')::boolean,false),
      stopped=(p_event->>'stopped')::boolean,throttle_zero=(p_event->>'throttle_zero')::boolean,bms_ok=(p_event->>'bms_ok')::boolean,
      ai_ready=(p_event->>'ai_ready')::boolean,gps_reliable=(p_event->>'gps_reliable')::boolean,motor_ready=(p_event->>'motor_ready')::boolean,
      latitude=(p_event->>'latitude')::double precision,longitude=(p_event->>'longitude')::double precision,
      gps_at=nullif(p_event->>'gps_at','')::timestamptz,battery_percent=(p_event->>'battery_percent')::numeric,last_sequence=(p_event->>'sequence')::bigint
      where vehicle_id='EV-01';
    if p_event->>'online'='true' then update public.ops_alert_episodes set resolved_at=now(),updated_at=now(),details='กลับมาออนไลน์แล้ว' where ops_alert_episodes.kind='vehicle_offline' and resolved_at is null;end if;
    result:=jsonb_build_object('accepted',true);
  elsif kind in ('command_accepted','start_confirmed','pause_confirmed','resume_confirmed','end_confirmed') then
    select * into s from public.ops_sessions where id=(p_event->>'session_id')::uuid for update;
    if not found or s.command_id is distinct from (p_event->>'command_id')::uuid then raise exception 'Session/command correlation failed' using errcode='22023';end if;
    if kind='command_accepted' then
      if s.status<>'Reserved' or s.expires_at<=now() then raise exception 'Start lease expired or already accepted' using errcode='22023';end if;
      perform app_ops.driver_check(s.user_id,true);
      update public.ops_sessions set status='PendingStart',version=version+1 where id=s.id returning * into s;
      result:=to_jsonb(s);
    else
      -- Retain ambiguous hardware results so another rider cannot acquire the vehicle.
      if s.status='Reserved' then update public.ops_sessions set status='PendingStart',version=version+1 where id=s.id returning * into s;end if;
      begin
        if kind in ('start_confirmed','resume_confirmed') then
          perform app_ops.driver_check(s.user_id,kind='start_confirmed');
          if kind='start_confirmed' and (s.status<>'PendingStart' or (s.expires_at<=now() and not exists(select 1 from public.ops_ingest_events where payload->>'session_id'=s.id::text and ops_ingest_events.kind='command_accepted'))) then raise exception 'Start state/lease not confirmed';end if;
          if kind='resume_confirmed' and s.status<>'PendingResume' then raise exception 'Resume state does not match';end if;
          if p_event->>'proximity_user_id' is distinct from s.user_id::text then raise exception 'Verified driver proximity required';end if;
          if p_event->>'motor_ready' is distinct from 'true' or p_event->>'stopped' is distinct from 'true'
            or p_event->>'throttle_zero' is distinct from 'true' or p_event->>'bms_ok' is distinct from 'true' then raise exception 'Actual Motor Ready and safety evidence required';end if;
          if exists(select 1 from public.profiles where id=s.user_id and role in ('Student','Employee'))
            and (p_event->>'ai_ready' is distinct from 'true' or p_event->>'gps_reliable' is distinct from 'true') then raise exception 'AI/GPS evidence required';end if;
          new_status:='Active';
        elsif kind='pause_confirmed' then
          if s.status<>'PendingPause' or p_event->>'stopped' is distinct from 'true' or p_event->>'motor_ready' is distinct from 'false' then raise exception 'Stopped and actual motor-off confirmation required';end if;
          new_status:='Paused';
        else
          if s.status<>'PendingEnd' or p_event->>'stopped' is distinct from 'true' or p_event->>'motor_ready' is distinct from 'false' then raise exception 'End requires actual motor-off and stopped evidence';end if;
          if p_event->>'return_zone_verified' is distinct from 'true' then
            if not (p_event->>'manager_return_exception'='true' and exists(select 1 from public.profiles where id=s.user_id and role='Manager')
              and not exists(select 1 from public.ops_zones where kind='return' and active) and length(coalesce(p_event->>'reason',''))>=5) then raise exception 'Return Zone verification required';end if;
          end if;
          new_status:='Completed';
        end if;
      exception when others then problem:=sqlerrm;end;
      if problem is not null then
        perform app_ops.alert('confirmation_conflict','ผลยืนยันสถานะรถไม่ชัดเจน',problem,1);
        result:=jsonb_build_object('status',s.status,'conflict',true,'reason',problem);
      else
        update public.ops_sessions set status=new_status,started_at=case when new_status='Active' then coalesce(started_at,occurred) else started_at end,
          ended_at=case when new_status='Completed' then occurred else ended_at end,
          distance_km=case when new_status='Completed' then nullif(p_event->>'distance_km','')::numeric else distance_km end,version=version+1
          where id=s.id returning * into s;
        update public.ops_commands set confirmed_at=now() where id=s.command_id;
        update public.ops_alert_episodes set resolved_at=now(),updated_at=now(),details='ได้รับผลยืนยันสถานะรถที่สัมพันธ์กับคำสั่งแล้ว'
          where ops_alert_episodes.kind='confirmation_conflict' and resolved_at is null;
        result:=to_jsonb(s);
      end if;
      update public.ops_vehicle_state set motor_ready=(p_event->>'motor_ready')::boolean,stopped=(p_event->>'stopped')::boolean where vehicle_id='EV-01';
    end if;
  elsif kind like 'offline_%' then result:=app_ops.offline_ingest(p_event);
  elsif kind in ('phone_return_check','gps_anomaly') then result:=app_ops.gateway_workflow_event(p_event);
  else raise exception 'Unsupported trusted event kind' using errcode='22023';end if;
  insert into public.ops_ingest_events(event_id,vehicle_id,kind,sequence,occurred_at,payload,result)
    values(incoming_event_id,'EV-01',kind,(p_event->>'sequence')::bigint,occurred,p_event-'latitude'-'longitude',result);
  return result;
end $$;

create function public.gateway_pending_commands()
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'Trusted vehicle service required' using errcode='42501';end if;
  return coalesce((select jsonb_agg(to_jsonb(c)||jsonb_build_object('user_id',s.user_id,'status',s.status,'expires_at',s.expires_at))
    from public.ops_commands c join public.ops_sessions s on s.id=c.session_id
    where c.confirmed_at is null and s.status not in ('Completed','Cancelled','Expired','Conflict')
      and (s.status<>'Reserved' or s.expires_at>now())),'[]'::jsonb);
end $$;

create or replace function app_ops.session_action(p_action text,p_payload jsonb)
returns jsonb language plpgsql set search_path='' as $$
declare e public.ops_behavior_events%rowtype;c public.ops_behavior_cycles%rowtype;current_cycle public.ops_behavior_cycles%rowtype;
  result jsonb;old jsonb;why text:=btrim(coalesce(p_payload->>'reason',''));evidence text:=btrim(coalesce(p_payload->>'evidence',''));decision text:=p_payload->>'decision';n integer;released boolean:=false;
begin
  perform app_ops.require_operator(false);
  if p_action='acknowledge_alert' then
    update public.ops_alert_episodes set acknowledged_by=auth.uid(),acknowledged_at=now() where id=(p_payload->>'id')::uuid and acknowledged_at is null returning to_jsonb(ops_alert_episodes) into result;
    if result is null then raise exception 'Alert changed or already acknowledged' using errcode='40001';end if;
    perform app_ops.audit(p_action,'alert',p_payload->>'id','Dashboard acknowledgment only',null,result);return result;
  elsif p_action='review_no_show' then
    perform pg_advisory_xact_lock(2661003::bigint);
    if length(why)<5 or length(evidence)<5 then raise exception 'Reason and evidence required' using errcode='22023';end if;
    select * into e from public.ops_behavior_events where id=(p_payload->>'id')::uuid and kind='NoShow' for update;
    if not found then raise exception 'No-show event not found' using errcode='P0002';end if;
    if p_payload->>'expected_status' is distinct from e.fault_status then raise exception 'Review changed; reload' using errcode='40001';end if;
    old:=to_jsonb(e);perform app_ops.expire_cycles(e.user_id);
    if decision='reopen' then
      if e.fault_status='Exempt' then raise exception 'Already exempt; no duplicate compensation' using errcode='22023';end if;
      update public.ops_behavior_events set fault_status='Reopened' where id=e.id;
      perform app_ops.notice(e.user_id,'no_show_reopened','เปิดตรวจสอบใหม่ — อยู่ระหว่างตรวจสอบหลักฐานเพิ่มเติม: '||why);
    elsif decision in ('reject','insufficient') then
      update public.ops_behavior_events set fault_status=case when decision='reject' then 'Rejected' else 'InsufficientEvidence' end where id=e.id;
      perform app_ops.notice(e.user_id,'no_show_decision',case when decision='reject' then 'ปฏิเสธคำขอทบทวน: ' else 'ตรวจสอบเสร็จสิ้น — ไม่พบหลักฐานยืนยันระบบขัดข้อง: ' end||why);
    elsif decision='exempt' then
      if not e.counted then raise exception 'Event already exempt' using errcode='22023';end if;
      update public.ops_behavior_events set counted=false,fault_status='Exempt' where id=e.id;
      select * into c from public.ops_behavior_cycles where id=e.cycle_id for update;
      if c.closed_at is null then
        n:=greatest(c.count_value-1,0);
        if c.restricted_until>now() and n<coalesce((c.policy->>'limit')::integer,0) then released:=true;end if;
        update public.ops_behavior_cycles set count_value=n,restricted_until=case when released then null else restricted_until end,
          release_pending=false where id=c.id;
      elsif p_payload->>'compensate_current'='true' then
        select * into current_cycle from public.ops_behavior_cycles where user_id=e.user_id and kind='NoShow' and closed_at is null for update;
        if found then
          n:=greatest(current_cycle.count_value-1,0);
          update public.ops_behavior_cycles set count_value=n,compensation_count=compensation_count+(current_cycle.count_value-n),
            release_pending=(restricted_until>now() and n<coalesce((policy->>'limit')::integer,0)) where id=current_cycle.id;
        end if;
      end if;
      perform app_ops.notice(e.user_id,'no_show_corrected',case when released then 'พบปัญหาระบบ/รถ แก้ตัวนับและปลดข้อจำกัด No-show แล้ว: ' else 'แก้ไข No-show จากปัญหาระบบ/รถแล้ว (การปลดข้อจำกัดให้ดูสถานะปัจจุบัน): ' end||why,30);
    else raise exception 'Invalid No-show decision' using errcode='22023';end if;
    insert into public.ops_behavior_reviews(event_id,actor_id,decision,evidence,reason) values(e.id,auth.uid(),decision,evidence,why);
    select to_jsonb(b) into result from public.ops_behavior_events b where id=e.id;
    perform app_ops.audit(p_action,'no_show',e.id::text,why,old,result||jsonb_build_object('evidence',evidence,'compensation_requested',p_payload->>'compensate_current'));
    return result;
  elsif p_action='approve_no_show_release' then
    perform pg_advisory_xact_lock(2661003::bigint);
    perform app_ops.expire_cycles();
    select * into c from public.ops_behavior_cycles where id=(p_payload->>'id')::uuid and kind='NoShow' for update;
    if not found or not c.release_pending or c.closed_at is not null or c.restricted_until<=now() then raise exception 'No pending early release' using errcode='40001';end if;
    if length(why)<5 then raise exception 'Reason required' using errcode='22023';end if;
    old:=to_jsonb(c);
    update public.ops_behavior_cycles set closed_at=now(),restricted_until=now(),release_pending=false where id=c.id returning to_jsonb(ops_behavior_cycles) into result;
    insert into public.ops_behavior_cycles(user_id,kind) values(c.user_id,'NoShow');
    perform app_ops.notice(c.user_id,'no_show_early_release','อนุมัติปลดข้อจำกัด No-show ก่อนกำหนดและเริ่มรอบใหม่แล้ว: '||why,30);
    perform app_ops.audit(p_action,'no_show_cycle',c.id::text,why,old,result);return result;
  end if;
  return null;
end $$;

create or replace function app_ops.user_session_action(p_action text,p_payload jsonb)
returns jsonb language plpgsql set search_path='' as $$
declare result jsonb;e public.ops_behavior_events%rowtype;category text:=p_payload->>'category';high_risk boolean;details text:=btrim(p_payload->>'details');
begin
  if p_action='report_issue' then
    if not exists(select 1 from public.profiles where id=auth.uid() and account_status='Approved' and role<>'Admin') then raise exception 'Approved driver required' using errcode='42501';end if;
    perform pg_advisory_xact_lock(2661003::bigint);
    high_risk:=category in ('brakes','throttle');
    insert into public.ops_issue_reports(user_id,session_id,category,details,high_risk) values(auth.uid(),
      (select id from public.ops_sessions where user_id=auth.uid() and status not in ('Completed','Cancelled','Expired','Conflict') limit 1),category,details,high_risk);
    perform app_ops.alert('issue:'||category,'รายงานปัญหารถ: '||category,details,case when high_risk then 1 else 2 end);
    if high_risk then update public.admin_vehicle_service set safety_block_active=true,final_confirmation_required=true,service_reason='รายงานความปลอดภัย: '||category,updated_at=now(),updated_by=auth.uid() where singleton;end if;
    return jsonb_build_object('received',true);
  elsif p_action='request_no_show_review' then
    if length(details) not between 5 and 2000 then raise exception 'New evidence details required' using errcode='22023';end if;
    select * into e from public.ops_behavior_events where id=(p_payload->>'id')::uuid and user_id=auth.uid() and kind='NoShow' for update;
    if not found then raise exception 'Owned No-show not found' using errcode='42501';end if;
    if e.fault_status='Exempt' or e.fault_status in ('UnderReview','Reopened') then raise exception 'Review already open or event exempt' using errcode='22023';end if;
    if e.first_requested_at is null and now()>e.occurred_at+interval '30 days' then raise exception 'First No-show review must be within 30 days' using errcode='22023';end if;
    update public.ops_behavior_events set fault_status=case when first_requested_at is null then 'UnderReview' else 'Reopened' end,
      first_requested_at=coalesce(first_requested_at,now()) where id=e.id returning to_jsonb(ops_behavior_events) into result;
    insert into public.ops_behavior_reviews(event_id,actor_id,decision,evidence,reason) values(e.id,auth.uid(),'user_request',details,'User submitted evidence');
    perform app_ops.alert('no_show_review:'||e.id::text,'คำขอทบทวน No-show',details,2);
    if e.first_requested_at is not null then perform app_ops.notice(e.user_id,'no_show_reopened','เปิดตรวจสอบใหม่ — อยู่ระหว่างตรวจสอบหลักฐานเพิ่มเติม');end if;
    return result;
  elsif p_action='acknowledge_notice' then
    update public.ops_user_notices set acknowledged_at=now(),expires_at=now()+interval '30 days'
      where id=(p_payload->>'id')::uuid and user_id=auth.uid() and acknowledgment_required and acknowledged_at is null returning to_jsonb(ops_user_notices) into result;
    if result is null then raise exception 'Owned notice not found or already acknowledged' using errcode='42501';end if;return result;
  end if;return null;
end $$;

create or replace function app_ops.session_snapshot(p_date date)
returns jsonb language plpgsql set search_path='' as $$
begin
  perform app_ops.expire_cycles();
  return jsonb_build_object(
    'service',(select to_jsonb(service)-'singleton' from public.admin_vehicle_service service),
    'vehicle',(select to_jsonb(v)||jsonb_build_object('fresh',v.valid_until>now()) from public.ops_vehicle_state v),
    'current_session',(select (to_jsonb(s)||jsonb_build_object('rider_name',p.full_name,'rider_role',p.role,'rider_phone',case when s.status='Active' then p.phone else null end))
      from public.ops_sessions s join public.profiles p on p.id=s.user_id where s.status not in ('Completed','Cancelled','Expired','Conflict') limit 1),
    'alerts',coalesce((select jsonb_agg(to_jsonb(a)||jsonb_build_object('acknowledged_name',p.full_name) order by a.priority,a.opened_at desc)
      from public.ops_alert_episodes a left join public.profiles p on p.id=a.acknowledged_by),'[]'::jsonb),
    'no_show_events',coalesce((select jsonb_agg(to_jsonb(e)||jsonb_build_object('user_name',p.full_name) order by occurred_at desc)
      from public.ops_behavior_events e join public.profiles p on p.id=e.user_id where kind='NoShow'),'[]'::jsonb),
    'no_show_reviews',coalesce((select jsonb_agg(to_jsonb(r) order by created_at desc) from public.ops_behavior_reviews r),'[]'::jsonb),
    'cycles',coalesce((select jsonb_agg(to_jsonb(c)||jsonb_build_object('user_name',p.full_name)) from public.ops_behavior_cycles c join public.profiles p on p.id=c.user_id where closed_at is null),'[]'::jsonb),
    'inspections',coalesce((select jsonb_agg(to_jsonb(i)||jsonb_build_object('user_name',p.full_name) order by confirmed_at desc) from public.ops_inspection_attestations i join public.profiles p on p.id=i.user_id),'[]'::jsonb),
    'issues',coalesce((select jsonb_agg(to_jsonb(i) order by created_at desc) from public.ops_issue_reports i),'[]'::jsonb),
    'zones',coalesce((select jsonb_agg(to_jsonb(z) order by kind,version desc) from public.ops_zones z),'[]'::jsonb));
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
    when exists(select 1 from public.ops_vehicle_state where online and protocol_verified and valid_until>now() and stopped and throttle_zero and bms_ok and motor_ready=false) then 'available'
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
    'consent_versions',(select jsonb_build_object('privacy',privacy_notice_version,'terms',terms_version) from public.ops_project_config));
end $$;

create function public.operations_maintenance()
returns jsonb language plpgsql security definer set search_path='' as $$
declare cfg public.ops_project_config%rowtype;
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'Trusted maintenance service required' using errcode='42501';end if;
  perform pg_advisory_xact_lock(2661003::bigint);perform app_ops.expire_reservation();perform app_ops.expire_cycles();
  select * into cfg from public.ops_project_config;
  if cfg.offline_alert_minutes is not null and exists(select 1 from public.ops_vehicle_state where telemetry_at is not null and telemetry_at<=now()-make_interval(mins=>cfg.offline_alert_minutes)
    and (online is distinct from true or valid_until<=now())) then
    perform app_ops.alert('vehicle_offline','ไม่ได้รับข้อมูลจากรถตามช่วงที่กำหนด','ตรวจการเชื่อมต่อรถ — เกณฑ์จาก Pilot',2);
  end if;
  return jsonb_build_object('ok',true,'processed_at',now());
end $$;

create function public.gateway_prepare_manifest(p_lifetime_seconds integer,p_key_id text)
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
      and (p.role='Manager' or (s.allowed_weekdays is not null and exists(select 1 from public.ops_zones where kind='main' and active) and exists(select 1 from public.ops_zones where kind='return' and active)))),'[]'::jsonb));
  insert into public.ops_offline_manifests(version,payload,issued_at,expires_at,key_id) values(v.offline_manifest_version+1,payload,now(),expires,p_key_id);
  update public.ops_vehicle_state set offline_manifest_version=offline_manifest_version+1,offline_lease_until=expires,offline_reconciliation_required=true;
  return payload;
end $$;

create function app_ops.offline_ingest(p_event jsonb)
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
    if card->>'role'<>'Manager' and (not (m.payload->'allowed_weekdays' @> to_jsonb(extract(dow from local_time)::integer))
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

do $$ declare t text;begin
  foreach t in array array['ops_vehicle_state','ops_offline_manifests','ops_zones','ops_sessions','ops_commands','ops_inspection_attestations','ops_consents','ops_ingest_events','ops_alert_episodes','ops_issue_reports','ops_behavior_cycles','ops_behavior_events','ops_behavior_reviews','ops_user_notices'] loop
    execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated',t);
  end loop;
end $$;
revoke all on all functions in schema app_ops from public,anon,authenticated;
revoke all on function public.request_web_session(boolean,boolean,uuid),public.session_owner_action(uuid,text),public.vehicle_ingest_event(jsonb),public.gateway_pending_commands(),public.operations_maintenance() from public,anon,authenticated;
grant execute on function public.request_web_session(boolean,boolean,uuid),public.session_owner_action(uuid,text) to authenticated;
grant execute on function public.vehicle_ingest_event(jsonb),public.gateway_pending_commands(),public.operations_maintenance() to service_role;
revoke all on function public.gateway_prepare_manifest(integer,text) from public,anon,authenticated;
grant execute on function public.gateway_prepare_manifest(integer,text) to service_role;
