-- Adminx3: private implementation helpers; public tables are RPC-only.
create schema if not exists app_ops;
revoke all on schema app_ops from public, anon, authenticated;

create table public.ops_project_config (
  singleton boolean primary key default true check(singleton),
  version integer not null default 1,
  project_phone text not null default '' check (project_phone='' or project_phone ~ '^\+?[0-9 ()-]{6,30}$'),
  project_ended_at timestamptz,
  privacy_policy_reviewed_at timestamptz,
  privacy_policy_reviewed_by uuid references auth.users(id),
  privacy_policy_reference text not null default '',
  cancellation_window_hours integer check(cancellation_window_hours>0),
  cancellation_warning_remaining integer check(cancellation_warning_remaining>0),
  no_show_window_hours integer check(no_show_window_hours>0),
  no_show_warning_remaining integer check(no_show_warning_remaining>0),
  offline_alert_minutes integer check(offline_alert_minutes>0),
  updated_at timestamptz not null default now()
);
insert into public.ops_project_config(singleton) values(true);

create table public.ops_account_appeals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  account_status text not null check(account_status in ('Rejected','Suspended')),
  account_updated_at timestamptz not null,
  details text not null check(length(btrim(details)) between 5 and 2000),
  status text not null default 'Pending' check(status in ('Pending','Accepted','Rejected')),
  version integer not null default 1,
  decision_reason text not null default '', reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz, created_at timestamptz not null default now()
);
create unique index ops_one_open_appeal on public.ops_account_appeals(user_id) where status='Pending';
create index ops_appeals_status_time on public.ops_account_appeals(status,created_at);

create table public.ops_nfc_cards (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
  card_ref text not null unique check(length(card_ref) between 6 and 128),
  enabled boolean not null default true, revoked_at timestamptz,
  registered_by uuid not null references auth.users(id), registered_at timestamptz not null default now(),
  version integer not null default 1
);
create unique index ops_one_active_card_per_user on public.ops_nfc_cards(user_id) where revoked_at is null;

alter table public.ops_project_config enable row level security;
alter table public.ops_account_appeals enable row level security;
alter table public.ops_nfc_cards enable row level security;
revoke all on public.ops_project_config,public.ops_account_appeals,public.ops_nfc_cards from public,anon,authenticated;

create function app_ops.require_operator(p_admin boolean default false)
returns void language plpgsql security invoker set search_path='' as $$
begin
  if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid()
    and account_status='Approved' and (role='Admin' or (not p_admin and role='Manager'))) then
    raise exception '% access required',case when p_admin then 'Approved Admin' else 'Approved Admin/Manager' end using errcode='42501';
  end if;
end $$;

create function app_ops.audit(p_action text,p_type text,p_id text,p_reason text,p_before jsonb,p_after jsonb)
returns void language sql security invoker set search_path='' as $$
  insert into public.admin_portal_audit(actor_id,action,target_type,target_id,reason,before_value,after_value)
  values(auth.uid(),p_action,p_type,p_id,p_reason,coalesce(p_before,'{}'::jsonb),coalesce(p_after,'{}'::jsonb));
$$;

create function app_ops.foundation_action(p_action text,p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  old jsonb; result jsonb; target public.profiles%rowtype; appeal public.ops_account_appeals%rowtype;
  why text:=btrim(coalesce(p_payload->>'reason','')); target_id uuid; cfg public.ops_project_config%rowtype;
begin
  perform app_ops.require_operator(true);
  if length(why) not between 5 and 2000 then raise exception 'A reason of 5 to 2000 characters is required' using errcode='22023'; end if;
  if p_action='review_appeal' then
    select * into appeal from public.ops_account_appeals where id=(p_payload->>'id')::uuid for update;
    if not found or appeal.status<>'Pending' or appeal.version is distinct from (p_payload->>'version')::integer then
      raise exception 'Appeal changed or already reviewed; reload' using errcode='40001'; end if;
    select * into target from public.profiles where id=appeal.user_id for update;
    if target.account_status<>appeal.account_status or target.updated_at<>appeal.account_updated_at then
      raise exception 'Account changed since appeal; reload and review latest state' using errcode='40001'; end if;
    if p_payload->>'decision' not in ('accept','reject') or p_payload->>'decision' is null then raise exception 'Invalid appeal decision' using errcode='22023'; end if;
    old:=to_jsonb(appeal);
    if p_payload->>'decision'='accept' then
      update public.profiles set account_status='Pending',driving_permission=false,account_status_reason='' where id=appeal.user_id;
    end if;
    update public.ops_account_appeals set status=case when p_payload->>'decision'='accept' then 'Accepted' else 'Rejected' end,
      decision_reason=why,reviewed_by=auth.uid(),reviewed_at=now(),version=version+1 where id=appeal.id returning to_jsonb(ops_account_appeals) into result;
    perform app_ops.audit(p_action,'appeal',appeal.id::text,why,old,result);
    return result;
  elsif p_action='register_nfc' then
    target_id:=(p_payload->>'user_id')::uuid;
    select * into target from public.profiles where id=target_id for update;
    if not found or target.account_status<>'Approved' or target.role not in ('Student','Employee','Manager') then
      raise exception 'Approved driver account required' using errcode='22023'; end if;
    if length(btrim(coalesce(p_payload->>'card_ref',''))) not between 6 and 128 then raise exception 'Invalid card reference' using errcode='22023'; end if;
    if exists(select 1 from public.ops_nfc_cards where card_ref=btrim(p_payload->>'card_ref')) then
      raise exception 'Card is already registered; use a new reference for replacement' using errcode='22023'; end if;
    select coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) into old from public.ops_nfc_cards c where user_id=target_id and revoked_at is null;
    update public.ops_nfc_cards set revoked_at=now(),enabled=false,version=version+1 where user_id=target_id and revoked_at is null;
    insert into public.ops_nfc_cards(user_id,card_ref,registered_by) values(target_id,btrim(p_payload->>'card_ref'),auth.uid()) returning to_jsonb(ops_nfc_cards) into result;
    perform app_ops.audit(p_action,'nfc',target_id::text,why,old,result); return result;
  elsif p_action='revoke_nfc' then
    select to_jsonb(c) into old from public.ops_nfc_cards c where id=(p_payload->>'id')::uuid and revoked_at is null for update;
    if old is null then raise exception 'Active card not found' using errcode='P0002'; end if;
    update public.ops_nfc_cards set revoked_at=now(),enabled=false,version=version+1 where id=(p_payload->>'id')::uuid returning to_jsonb(ops_nfc_cards) into result;
    perform app_ops.audit(p_action,'nfc',p_payload->>'id',why,old,result);return result;
  elsif p_action='update_operations_config' then
    select * into cfg from public.ops_project_config where singleton for update;
    if cfg.version is distinct from (p_payload->>'version')::integer then raise exception 'Settings changed; reload' using errcode='40001'; end if;
    old:=to_jsonb(cfg);
    update public.ops_project_config set
      project_phone=case when p_payload?'project_phone' then btrim(p_payload->>'project_phone') else project_phone end,
      project_ended_at=case when p_payload?'project_ended_at' then nullif(p_payload->>'project_ended_at','')::timestamptz else project_ended_at end,
      privacy_policy_reference=case when p_payload?'privacy_policy_reference' then btrim(p_payload->>'privacy_policy_reference') else privacy_policy_reference end,
      privacy_policy_reviewed_at=case when p_payload->>'policy_review_confirmed'='true' then now() else privacy_policy_reviewed_at end,
      privacy_policy_reviewed_by=case when p_payload->>'policy_review_confirmed'='true' then auth.uid() else privacy_policy_reviewed_by end,
      cancellation_window_hours=case when p_payload?'cancellation_window_hours' then nullif(p_payload->>'cancellation_window_hours','')::integer else cancellation_window_hours end,
      cancellation_warning_remaining=case when p_payload?'cancellation_warning_remaining' then nullif(p_payload->>'cancellation_warning_remaining','')::integer else cancellation_warning_remaining end,
      no_show_window_hours=case when p_payload?'no_show_window_hours' then nullif(p_payload->>'no_show_window_hours','')::integer else no_show_window_hours end,
      no_show_warning_remaining=case when p_payload?'no_show_warning_remaining' then nullif(p_payload->>'no_show_warning_remaining','')::integer else no_show_warning_remaining end,
      offline_alert_minutes=case when p_payload?'offline_alert_minutes' then nullif(p_payload->>'offline_alert_minutes','')::integer else offline_alert_minutes end,
      version=version+1,updated_at=now() where singleton returning to_jsonb(ops_project_config) into result;
    if (result->>'privacy_policy_reviewed_at') is not null and length(coalesce(result->>'privacy_policy_reference',''))<5 then
      raise exception 'Reviewed policy reference is required' using errcode='22023'; end if;
    perform app_ops.audit(p_action,'settings','project',why,old,result); return result;
  end if;
  return null;
end $$;

-- Extension points are replaced by subsequent migrations, never exposed to clients.
create function app_ops.session_action(text,jsonb) returns jsonb language sql set search_path='' as $$ select null::jsonb $$;
create function app_ops.workflow_action(text,jsonb) returns jsonb language sql set search_path='' as $$ select null::jsonb $$;
create function app_ops.session_snapshot(date) returns jsonb language sql set search_path='' as $$ select '{}'::jsonb $$;
create function app_ops.workflow_snapshot(date) returns jsonb language sql set search_path='' as $$ select '{}'::jsonb $$;
create function app_ops.user_session_snapshot() returns jsonb language sql set search_path='' as $$ select '{}'::jsonb $$;
create function app_ops.user_workflow_snapshot() returns jsonb language sql set search_path='' as $$ select '{}'::jsonb $$;
create function app_ops.user_session_action(text,jsonb) returns jsonb language sql set search_path='' as $$ select null::jsonb $$;
create function app_ops.user_workflow_action(text,jsonb) returns jsonb language sql set search_path='' as $$ select null::jsonb $$;

create function public.admin_operations_action(p_action text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  perform app_ops.require_operator(false);
  if p_action in ('review_appeal','register_nfc','revoke_nfc','update_operations_config') then
    return app_ops.foundation_action(p_action,p_payload);
  end if;
  result:=app_ops.session_action(p_action,p_payload);
  if result is not null then return result; end if;
  result:=app_ops.workflow_action(p_action,p_payload);
  if result is not null then return result; end if;
  raise exception 'Unsupported operation' using errcode='22023';
end $$;

create function public.admin_operations_snapshot(p_date date)
returns jsonb language plpgsql security definer set search_path='' as $$
declare base jsonb;
begin
  perform app_ops.require_operator(false);
  select jsonb_build_object('can_admin',public.admin_is_approved(),'config',(select to_jsonb(c)-'singleton' from public.ops_project_config c),
    'appeals',case when public.admin_is_approved() then coalesce((select jsonb_agg(to_jsonb(a)||jsonb_build_object('user_name',p.full_name) order by a.created_at desc)
      from public.ops_account_appeals a join public.profiles p on p.id=a.user_id),'[]'::jsonb) else '[]'::jsonb end,
    'nfc_cards',case when public.admin_is_approved() then coalesce((select jsonb_agg((to_jsonb(c)-'card_ref')||jsonb_build_object('user_name',p.full_name) order by c.registered_at desc)
      from public.ops_nfc_cards c join public.profiles p on p.id=c.user_id),'[]'::jsonb) else '[]'::jsonb end,
    'accounts',case when public.admin_is_approved() then coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',full_name,'role',role,'status',account_status,'driving_permission',driving_permission,'induction_confirmed',induction_confirmed)) from public.profiles),'[]'::jsonb) else '[]'::jsonb end)
    into base;
  return base||app_ops.session_snapshot(p_date)||app_ops.workflow_snapshot(p_date);
end $$;

create function public.my_operations_snapshot()
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  if auth.uid() is null then raise exception 'Sign-in required' using errcode='42501'; end if;
  select jsonb_build_object('project_phone',(select project_phone from public.ops_project_config where singleton),
    'appeals',coalesce((select jsonb_agg(to_jsonb(a)-'account_updated_at' order by created_at desc) from public.ops_account_appeals a where user_id=auth.uid()),'[]'::jsonb),
    'nfc_card',(select to_jsonb(c)-'card_ref'-'registered_by' from public.ops_nfc_cards c where user_id=auth.uid() and revoked_at is null)) into result;
  return result||app_ops.user_session_snapshot()||app_ops.user_workflow_snapshot();
end $$;

create function public.user_operations_action(p_action text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare target public.profiles%rowtype; result jsonb;
begin
  if auth.uid() is null then raise exception 'Sign-in required' using errcode='42501'; end if;
  select * into target from public.profiles where id=auth.uid() for update;
  if not found then raise exception 'Account not found' using errcode='42501'; end if;
  if p_action='appeal' then
    if target.account_status not in ('Rejected','Suspended') then raise exception 'Rejected or Suspended account required' using errcode='22023'; end if;
    if exists(select 1 from public.ops_account_appeals where user_id=auth.uid() and status='Pending') then raise exception 'An open appeal already exists' using errcode='22023'; end if;
    insert into public.ops_account_appeals(user_id,account_status,account_updated_at,details)
      values(auth.uid(),target.account_status,target.updated_at,btrim(p_payload->>'details')) returning to_jsonb(ops_account_appeals) into result; return result;
  elsif p_action='toggle_nfc' then
    if target.account_status<>'Approved' or target.role='Admin' then raise exception 'Approved driver required' using errcode='42501'; end if;
    update public.ops_nfc_cards set enabled=coalesce((p_payload->>'enabled')::boolean,false),version=version+1
      where user_id=auth.uid() and revoked_at is null returning to_jsonb(ops_nfc_cards)-'card_ref'-'registered_by' into result;
    if result is null then raise exception 'No registered card' using errcode='P0002'; end if; return result;
  end if;
  result:=app_ops.user_session_action(p_action,p_payload); if result is not null then return result; end if;
  result:=app_ops.user_workflow_action(p_action,p_payload); if result is not null then return result; end if;
  raise exception 'Unsupported user operation' using errcode='22023';
end $$;

revoke all on all functions in schema app_ops from public,anon,authenticated;
revoke all on function public.admin_operations_action(text,jsonb),public.admin_operations_snapshot(date),public.my_operations_snapshot(),public.user_operations_action(text,jsonb) from public,anon,authenticated;
grant execute on function public.admin_operations_action(text,jsonb),public.admin_operations_snapshot(date),public.my_operations_snapshot(),public.user_operations_action(text,jsonb) to authenticated;
