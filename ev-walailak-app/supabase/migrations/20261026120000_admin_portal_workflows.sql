-- Admin portal workflows. All privileged writes are audited in the same transaction.
alter table public.profiles
  add column if not exists induction_confirmed boolean not null default false,
  add column if not exists induction_confirmed_at timestamptz,
  add column if not exists induction_confirmed_by uuid references auth.users(id);

create table public.admin_portal_settings (
  singleton boolean primary key default true check (singleton),
  allowed_weekdays smallint[],
  session_start time,
  session_end time,
  cancellation_limit integer,
  cancellation_cooldown_hours integer,
  no_show_limit integer,
  no_show_cooldown_hours integer,
  effective_from timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  check (
    (allowed_weekdays is null and session_start is null and session_end is null)
    or (allowed_weekdays is not null and cardinality(allowed_weekdays) between 1 and 7
      and allowed_weekdays <@ array[0,1,2,3,4,5,6]::smallint[]
      and session_start is not null and session_end is not null and session_start < session_end)
  ),
  check (cancellation_limit is null or cancellation_limit > 0),
  check (cancellation_cooldown_hours is null or cancellation_cooldown_hours > 0),
  check (no_show_limit is null or no_show_limit > 0),
  check (no_show_cooldown_hours is null or no_show_cooldown_hours > 0)
);
insert into public.admin_portal_settings(singleton) values (true) on conflict do nothing;

create table public.admin_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  published boolean not null default false,
  important boolean not null default false,
  audience_roles text[] not null default array['Student','Employee','Manager','Admin']::text[],
  starts_at timestamptz,
  ends_at timestamptz,
  published_at timestamptz,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_at is null or ends_at is null or starts_at < ends_at),
  check (cardinality(audience_roles) between 1 and 4 and audience_roles <@ array['Student','Employee','Manager','Admin']::text[])
);

create table public.admin_announcement_seen (
  announcement_id uuid not null references public.admin_announcements(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  seen_at timestamptz not null default now(),
  primary key (announcement_id,user_id)
);

create table public.admin_data_subject_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id),
  request_type text not null check (request_type in ('access', 'correction', 'deletion')),
  details text not null check (char_length(btrim(details)) between 5 and 2000),
  status text not null default 'Pending' check (status in ('Pending', 'InReview', 'Completed', 'Rejected')),
  admin_note text not null default '',
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.admin_vehicle_service (
  singleton boolean primary key default true check (singleton),
  manual_out_of_service boolean not null default false,
  safety_block_active boolean not null default false,
  final_confirmation_required boolean not null default false,
  service_reason text not null default '',
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
insert into public.admin_vehicle_service(singleton) values (true) on conflict do nothing;

create table public.admin_portal_audit (
  id bigint generated always as identity primary key,
  actor_id uuid not null references auth.users(id),
  action text not null,
  target_type text not null,
  target_id text not null default '',
  reason text not null default '',
  before_value jsonb not null default '{}'::jsonb,
  after_value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.admin_portal_settings enable row level security;
alter table public.admin_announcements enable row level security;
alter table public.admin_announcement_seen enable row level security;
alter table public.admin_data_subject_requests enable row level security;
alter table public.admin_vehicle_service enable row level security;
alter table public.admin_portal_audit enable row level security;
revoke all on public.admin_portal_settings, public.admin_announcements, public.admin_announcement_seen, public.admin_data_subject_requests,
  public.admin_vehicle_service, public.admin_portal_audit from public, anon, authenticated;

create or replace function public.admin_is_approved()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'Admin' and p.account_status = 'Approved'
  );
$$;
revoke all on function public.admin_is_approved() from public, anon, authenticated;

create or replace function public.admin_portal_snapshot()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if not public.admin_is_approved() then raise exception 'Approved Admin access required' using errcode = '42501'; end if;
  select jsonb_build_object(
    'pending_accounts', (select count(*) from public.profiles p where p.account_status = 'Pending'),
    'permission_accounts', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.full_name, 'email', u.email,
      'role', p.role, 'induction_confirmed', p.induction_confirmed, 'driving_permission', p.driving_permission)) from public.profiles p
      join auth.users u on u.id = p.id where p.account_status = 'Approved' and p.role in ('Student','Employee')),'[]'::jsonb),
    'settings', (select to_jsonb(s) - 'singleton' from public.admin_portal_settings s where s.singleton),
    'announcements', coalesce((select jsonb_agg(to_jsonb(a) order by a.updated_at desc) from public.admin_announcements a),'[]'::jsonb),
    'privacy_requests', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'requester_id', r.requester_id,
      'requester_name', p.full_name, 'requester_email', u.email, 'request_type', r.request_type, 'details', r.details,
      'status', r.status, 'admin_note', r.admin_note, 'created_at', r.created_at, 'reviewed_at', r.reviewed_at)
      order by r.created_at desc) from public.admin_data_subject_requests r
      join auth.users u on u.id = r.requester_id left join public.profiles p on p.id = r.requester_id),'[]'::jsonb),
    'service', (select to_jsonb(v) - 'singleton' from public.admin_vehicle_service v where v.singleton),
    'audit', coalesce((select jsonb_agg(to_jsonb(entries) order by entries.created_at desc) from (
      select l.id::text as id, p.full_name as actor, l.action, l.target_type, l.target_id, l.reason, l.created_at, l.before_value, l.after_value
      from (select * from public.admin_portal_audit order by created_at desc limit 100) l left join public.profiles p on p.id=l.actor_id
      union all
      select a.id::text, p.full_name, 'account_review_' || a.decision, 'profile', a.target_account_id::text, a.reason, a.created_at,
        jsonb_build_object('account_status',a.previous_account_status), jsonb_build_object('account_status',a.resulting_account_status,'role',a.assigned_role)
      from public.admin_account_review_audit a left join public.profiles p on p.id=a.actor_id
      order by created_at desc limit 100
    ) entries),'[]'::jsonb),
    'cancellation_events_available', false, 'no_show_events_available', false
  ) into result;
  return result;
end;
$$;

create or replace function public.admin_portal_action(p_action text, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  target_id text := coalesce(p_payload->>'id','');
  why text := left(btrim(coalesce(p_payload->>'reason','')),1000);
  old jsonb := '{}'::jsonb;
  next_value jsonb := '{}'::jsonb;
  setting_row public.admin_portal_settings%rowtype;
  service_row public.admin_vehicle_service%rowtype;
  target_profile public.profiles%rowtype;
  new_id uuid;
  announcement_start timestamptz;
  announcement_end timestamptz;
  announcement_roles text[];
  announcement_published boolean;
begin
  if actor is null or not public.admin_is_approved() then raise exception 'Approved Admin access required' using errcode = '42501'; end if;
  if p_action = 'set_driving_permission' then
    if why='' then raise exception 'A reason is required for permission changes' using errcode = '22023'; end if;
    select * into target_profile from public.profiles where id = (p_payload->>'id')::uuid for update;
    if not found or target_profile.account_status <> 'Approved' or target_profile.role not in ('Student','Employee') then
      raise exception 'Approved Student/Employee account required' using errcode = '22023'; end if;
    if coalesce((p_payload->>'enabled')::boolean,false) and coalesce((p_payload->>'induction_confirmed')::boolean,false) is not true then
      raise exception 'Team induction must be confirmed before granting permission' using errcode = '22023'; end if;
    old := jsonb_build_object('driving_permission',target_profile.driving_permission,'induction_confirmed',target_profile.induction_confirmed);
    update public.profiles set driving_permission=coalesce((p_payload->>'enabled')::boolean,false),
      induction_confirmed=case when coalesce((p_payload->>'enabled')::boolean,false) then true else induction_confirmed end,
      induction_confirmed_at=case when coalesce((p_payload->>'enabled')::boolean,false) then now() else induction_confirmed_at end,
      induction_confirmed_by=case when coalesce((p_payload->>'enabled')::boolean,false) then actor else induction_confirmed_by end,
      updated_at=now() where id=target_profile.id returning to_jsonb(profiles) into next_value;
    target_id := target_profile.id::text;
  elsif p_action = 'update_settings' then
    select * into setting_row from public.admin_portal_settings where singleton for update;
    old := to_jsonb(setting_row) - 'singleton';
    update public.admin_portal_settings set
      allowed_weekdays=case when jsonb_typeof(p_payload->'allowed_weekdays')='array' and jsonb_array_length(p_payload->'allowed_weekdays')>0
        then array(select distinct wd.value::smallint from jsonb_array_elements_text(p_payload->'allowed_weekdays') as wd(value) order by wd.value::smallint)
        else null end,
      session_start=nullif(p_payload->>'session_start','')::time,
      session_end=nullif(p_payload->>'session_end','')::time,
      cancellation_limit=nullif(p_payload->>'cancellation_limit','')::integer,
      cancellation_cooldown_hours=nullif(p_payload->>'cancellation_cooldown_hours','')::integer,
      no_show_limit=nullif(p_payload->>'no_show_limit','')::integer,
      no_show_cooldown_hours=nullif(p_payload->>'no_show_cooldown_hours','')::integer,
      effective_from=now(),updated_at=now(),updated_by=actor where singleton returning to_jsonb(admin_portal_settings)-'singleton' into next_value;
    target_id := 'settings';
  elsif p_action = 'save_announcement' then
    if length(btrim(coalesce(p_payload->>'title',''))) not between 1 and 120 or length(btrim(coalesce(p_payload->>'body',''))) not between 1 and 2000 then
      raise exception 'Announcement title/body is required and within its limit' using errcode = '22023'; end if;
    if jsonb_typeof(p_payload->'audience_roles') <> 'array' then raise exception 'Audience roles required' using errcode = '22023'; end if;
    announcement_roles := array(select distinct role_name from jsonb_array_elements_text(p_payload->'audience_roles') as roles(role_name) order by role_name);
    if cardinality(announcement_roles) not between 1 and 4 or not (announcement_roles <@ array['Student','Employee','Manager','Admin']::text[]) then
      raise exception 'Invalid audience roles' using errcode = '22023'; end if;
    announcement_start := nullif(p_payload->>'starts_at','')::timestamptz;
    announcement_end := nullif(p_payload->>'ends_at','')::timestamptz;
    if announcement_end is not null and announcement_end <= coalesce(announcement_start,now()) then
      raise exception 'Announcement expiry must follow its start' using errcode = '22023'; end if;
    announcement_published := coalesce((p_payload->>'published')::boolean,false);
    if nullif(p_payload->>'id','') is null then
      insert into public.admin_announcements(title,body,published,important,audience_roles,starts_at,ends_at,published_at,created_by,updated_by)
      values (btrim(p_payload->>'title'),btrim(p_payload->>'body'),announcement_published,
        coalesce((p_payload->>'important')::boolean,false),announcement_roles,announcement_start,announcement_end,
        case when announcement_published then greatest(now(),coalesce(announcement_start,now())) else null end,actor,actor)
      returning id,to_jsonb(admin_announcements) into new_id,next_value;
      target_id := new_id::text;
    else
      select to_jsonb(a) into old from public.admin_announcements a where a.id=(p_payload->>'id')::uuid for update;
      if old is null then raise exception 'Announcement not found' using errcode = 'P0002'; end if;
      update public.admin_announcements set title=btrim(p_payload->>'title'),body=btrim(p_payload->>'body'),
        published=announcement_published,important=coalesce((p_payload->>'important')::boolean,false),
        audience_roles=announcement_roles,starts_at=announcement_start,ends_at=announcement_end,
        published_at=case when not announcement_published then null
          when (old->>'published')::boolean and (old->>'starts_at')::timestamptz is not distinct from announcement_start then (old->>'published_at')::timestamptz
          else greatest(now(),coalesce(announcement_start,now())) end,
        updated_by=actor,updated_at=now()
        where id=(p_payload->>'id')::uuid returning to_jsonb(admin_announcements) into next_value;
      target_id := p_payload->>'id';
    end if;
  elsif p_action = 'review_privacy_request' then
    select to_jsonb(r) into old from public.admin_data_subject_requests r where r.id=(p_payload->>'id')::uuid and r.status in ('Pending','InReview') for update;
    if old is null then raise exception 'Open privacy request not found' using errcode = 'P0002'; end if;
    update public.admin_data_subject_requests set status=p_payload->>'status',admin_note=left(btrim(coalesce(p_payload->>'admin_note','')),2000),reviewed_by=actor,reviewed_at=now()
      where id=(p_payload->>'id')::uuid and p_payload->>'status' in ('InReview','Completed','Rejected') returning to_jsonb(admin_data_subject_requests) into next_value;
    if next_value is null then raise exception 'Invalid privacy request status' using errcode = '22023'; end if;
    target_id := p_payload->>'id';
  elsif p_action in ('set_manual_service_stop','set_safety_block','confirm_service_reopen') then
    if why='' then raise exception 'A service inspection/decision reason is required' using errcode = '22023'; end if;
    select * into service_row from public.admin_vehicle_service where singleton for update;
    old := to_jsonb(service_row)-'singleton';
    if p_action='set_manual_service_stop' then
      update public.admin_vehicle_service set manual_out_of_service=coalesce((p_payload->>'enabled')::boolean,false),
        final_confirmation_required=true,service_reason=why,updated_by=actor,updated_at=now() where singleton;
    elsif p_action='set_safety_block' then
      update public.admin_vehicle_service set safety_block_active=coalesce((p_payload->>'enabled')::boolean,false),
        final_confirmation_required=true,service_reason=why,updated_by=actor,updated_at=now() where singleton;
    else
      if service_row.manual_out_of_service or service_row.safety_block_active then raise exception 'Clear manual and safety blocks before final confirmation' using errcode = '22023'; end if;
      if not service_row.final_confirmation_required then raise exception 'No service reopening confirmation is pending' using errcode = '22023'; end if;
      update public.admin_vehicle_service set final_confirmation_required=false,service_reason=why,updated_by=actor,updated_at=now() where singleton;
    end if;
    select to_jsonb(v)-'singleton' into next_value from public.admin_vehicle_service v where singleton;
    target_id := 'EV-01';
  else
    raise exception 'Unsupported Admin action' using errcode = '22023';
  end if;
  insert into public.admin_portal_audit(actor_id,action,target_type,target_id,reason,before_value,after_value)
  values(actor,p_action,case when p_action='set_driving_permission' then 'profile' when p_action='save_announcement' then 'announcement'
    when p_action='review_privacy_request' then 'privacy_request' when p_action like '%service%' or p_action='set_safety_block' then 'vehicle' else 'settings' end,
    target_id,why,old,next_value);
  return jsonb_build_object('ok',true,'id',target_id,'value',next_value);
end;
$$;

create or replace function public.submit_data_subject_request(p_request_type text,p_details text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare created_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign-in required' using errcode = '42501'; end if;
  if p_request_type not in ('access','correction','deletion') or length(btrim(coalesce(p_details,''))) not between 5 and 2000 then
    raise exception 'Valid request type and details are required' using errcode = '22023'; end if;
  insert into public.admin_data_subject_requests(requester_id,request_type,details)
    values(auth.uid(),p_request_type,btrim(p_details)) returning id into created_id;
  return created_id;
end;
$$;

create or replace function public.list_my_data_subject_requests()
returns table(id uuid,request_type text,details text,status text,admin_note text,created_at timestamptz,reviewed_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select r.id,r.request_type,r.details,r.status,r.admin_note,r.created_at,r.reviewed_at
  from public.admin_data_subject_requests r where r.requester_id=auth.uid() order by r.created_at desc;
$$;

create or replace function public.list_published_announcements()
returns table(id uuid,title text,body text,important boolean,published_at timestamptz,seen boolean)
language sql stable security definer set search_path = '' as $$
  select a.id,a.title,a.body,a.important,a.published_at,
    exists(select 1 from public.admin_announcement_seen s where s.announcement_id=a.id and s.user_id=auth.uid())
  from public.admin_announcements a join public.profiles p on p.id=auth.uid()
  where a.published and p.role=any(a.audience_roles)
    and (a.starts_at is null or a.starts_at<=now()) and (a.ends_at is null or a.ends_at>now())
  order by a.published_at desc;
$$;

create or replace function public.mark_announcement_seen(p_announcement_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign-in required' using errcode = '42501'; end if;
  if not exists (
    select 1 from public.admin_announcements a join public.profiles p on p.id=auth.uid()
    where a.id=p_announcement_id and a.published and p.role=any(a.audience_roles)
      and (a.starts_at is null or a.starts_at<=now()) and (a.ends_at is null or a.ends_at>now())
  ) then raise exception 'Announcement is not visible' using errcode = '42501'; end if;
  insert into public.admin_announcement_seen(announcement_id,user_id) values(p_announcement_id,auth.uid()) on conflict do nothing;
  return true;
end;
$$;

revoke all on function public.admin_portal_snapshot() from public,anon,authenticated;
revoke all on function public.admin_portal_action(text,jsonb) from public,anon,authenticated;
revoke all on function public.submit_data_subject_request(text,text) from public,anon,authenticated;
revoke all on function public.list_my_data_subject_requests() from public,anon,authenticated;
revoke all on function public.list_published_announcements() from public,anon,authenticated;
revoke all on function public.mark_announcement_seen(uuid) from public,anon,authenticated;
grant execute on function public.admin_portal_snapshot() to authenticated;
grant execute on function public.admin_portal_action(text,jsonb) to authenticated;
grant execute on function public.submit_data_subject_request(text,text) to authenticated;
grant execute on function public.list_my_data_subject_requests() to authenticated;
grant execute on function public.list_published_announcements() to authenticated;
grant execute on function public.mark_announcement_seen(uuid) to authenticated;
