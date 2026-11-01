-- The applicant can request and cancel permission without giving a reason.
alter table public.ops_driving_permission_requests
  drop constraint ops_driving_permission_requests_details_check,
  add constraint ops_driving_permission_requests_details_check check (length(btrim(details)) <= 1000),
  drop constraint ops_driving_permission_requests_status_check,
  add constraint ops_driving_permission_requests_status_check check (status in ('Pending', 'Approved', 'Rejected', 'Cancelled')),
  alter column details set default '',
  add column cancelled_at timestamptz;

drop function public.request_driving_permission(text);

create function public.request_driving_permission()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare p public.profiles%rowtype; r public.ops_driving_permission_requests%rowtype;
begin
  if auth.uid() is null then raise exception 'Sign-in required' using errcode = '42501'; end if;
  select * into p from public.profiles where id = auth.uid() for update;
  if p.id is null or p.account_status <> 'Approved' or p.role not in ('Student', 'Employee', 'Manager') then
    raise exception 'Approved student, employee or manager account required' using errcode = '42501';
  end if;
  if p.driving_permission then raise exception 'Driving permission already granted' using errcode = '22023'; end if;
  select * into r from public.ops_driving_permission_requests where user_id = auth.uid() for update;
  if r.status = 'Pending' then raise exception 'Request already pending' using errcode = '22023'; end if;
  insert into public.ops_driving_permission_requests(user_id, details)
    values (auth.uid(), '')
    on conflict (user_id) do update set details = '', status = 'Pending',
      decision_reason = '', reviewed_by = null, reviewed_at = null, documents_verified_at = null,
      documents_verified_by = null, cancelled_at = null, created_at = now(), updated_at = now()
    returning * into r;
  return to_jsonb(r) - 'reviewed_by' - 'documents_verified_by';
end $$;

create function public.cancel_driving_permission_request()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.ops_driving_permission_requests%rowtype;
begin
  if auth.uid() is null then raise exception 'Sign-in required' using errcode = '42501'; end if;
  update public.ops_driving_permission_requests
    set status = 'Cancelled', cancelled_at = now(), updated_at = now()
    where user_id = auth.uid() and status = 'Pending'
    returning * into r;
  if r.id is null then raise exception 'Pending request not found' using errcode = '22023'; end if;
  return to_jsonb(r) - 'reviewed_by' - 'documents_verified_by';
end $$;

revoke all on function public.request_driving_permission(), public.cancel_driving_permission_request()
  from public, anon, authenticated;
grant execute on function public.request_driving_permission(), public.cancel_driving_permission_request()
  to authenticated;
