-- A request is separate from account approval and from the permission itself.
create table public.ops_driving_permission_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  details text not null check (length(btrim(details)) between 10 and 1000),
  status text not null default 'Pending' check (status in ('Pending', 'Approved', 'Rejected')),
  decision_reason text not null default '',
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ops_driving_permission_requests_pending_idx on public.ops_driving_permission_requests(created_at)
  where status = 'Pending';
alter table public.ops_driving_permission_requests enable row level security;
revoke all on public.ops_driving_permission_requests from public, anon, authenticated;

create function public.my_driving_permission_request()
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign-in required' using errcode = '42501'; end if;
  return (select to_jsonb(r) - 'reviewed_by' from public.ops_driving_permission_requests r where r.user_id = auth.uid());
end $$;

create function public.request_driving_permission(p_details text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare p public.profiles%rowtype; r public.ops_driving_permission_requests%rowtype;
begin
  if auth.uid() is null then raise exception 'Sign-in required' using errcode = '42501'; end if;
  select * into p from public.profiles where id = auth.uid() for update;
  if p.id is null or p.account_status <> 'Approved' or p.role not in ('Student', 'Employee', 'Manager') then
    raise exception 'Approved student, employee or manager account required' using errcode = '42501';
  end if;
  if p.driving_permission then raise exception 'Driving permission already granted' using errcode = '22023'; end if;
  if length(btrim(coalesce(p_details, ''))) not between 10 and 1000 then
    raise exception 'Please provide 10 to 1000 characters' using errcode = '22023';
  end if;
  select * into r from public.ops_driving_permission_requests where user_id = auth.uid() for update;
  if r.status = 'Pending' then raise exception 'Request already pending' using errcode = '22023'; end if;
  insert into public.ops_driving_permission_requests(user_id, details)
    values (auth.uid(), btrim(p_details))
    on conflict (user_id) do update set details = excluded.details, status = 'Pending',
      decision_reason = '', reviewed_by = null, reviewed_at = null, created_at = now(), updated_at = now()
    returning * into r;
  return to_jsonb(r) - 'reviewed_by';
end $$;

create function public.admin_driving_permission_requests()
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not public.admin_is_approved() then raise exception 'Approved Admin required' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg((to_jsonb(r) - 'reviewed_by') ||
    jsonb_build_object('user_name', p.full_name, 'role', p.role) order by r.created_at desc)
    from public.ops_driving_permission_requests r join public.profiles p on p.id = r.user_id), '[]'::jsonb);
end $$;

create function public.admin_review_driving_permission_request(
  p_request_id uuid, p_decision text, p_reason text, p_induction_confirmed boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.ops_driving_permission_requests%rowtype; p public.profiles%rowtype;
begin
  if not public.admin_is_approved() then raise exception 'Approved Admin required' using errcode = '42501'; end if;
  if p_decision is null or p_decision not in ('approve', 'reject') or length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Decision and reason are required' using errcode = '22023';
  end if;
  select * into r from public.ops_driving_permission_requests where id = p_request_id for update;
  if r.id is null or r.status <> 'Pending' then raise exception 'Pending request not found' using errcode = '22023'; end if;
  select * into p from public.profiles where id = r.user_id for update;
  if p_decision = 'approve' then
    if p.id is null or p.account_status <> 'Approved' or p.role not in ('Student', 'Employee', 'Manager')
      or p_induction_confirmed is distinct from true then
      raise exception 'Approved account and confirmed induction required' using errcode = '42501';
    end if;
    update public.profiles set driving_permission = true, induction_confirmed = true, updated_at = now() where id = r.user_id;
  end if;
  update public.ops_driving_permission_requests set status = case when p_decision = 'approve' then 'Approved' else 'Rejected' end,
    decision_reason = btrim(p_reason), reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
    where id = r.id returning * into r;
  insert into public.admin_portal_audit(actor_id, action, target_type, target_id, reason, before_value, after_value)
    values (auth.uid(), 'review_driving_permission_request', 'profile', r.user_id::text, btrim(p_reason),
      jsonb_build_object('request_status', 'Pending', 'driving_permission', p.driving_permission),
      jsonb_build_object('request_status', r.status, 'driving_permission', case when p_decision = 'approve' then true else p.driving_permission end));
  return to_jsonb(r) - 'reviewed_by';
end $$;

revoke all on function public.my_driving_permission_request(), public.request_driving_permission(text),
  public.admin_driving_permission_requests(), public.admin_review_driving_permission_request(uuid,text,text,boolean)
  from public, anon, authenticated;
grant execute on function public.my_driving_permission_request(), public.request_driving_permission(text),
  public.admin_driving_permission_requests(), public.admin_review_driving_permission_request(uuid,text,text,boolean)
  to authenticated;
