-- Every route that turns Driving Permission on must have a reviewed request.
create function public.guard_driving_permission_grant()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.driving_permission is true and old.driving_permission is distinct from true then
    if new.account_status <> 'Approved' or new.role not in ('Student', 'Employee', 'Manager')
      or new.induction_confirmed is distinct from true
      or not exists (
        select 1 from public.ops_driving_permission_requests r
        where r.user_id = new.id and r.status = 'Approved' and r.documents_verified_at is not null
      ) then
      raise exception 'Reviewed driving documents and confirmed induction required before granting permission' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger guard_driving_permission_grant
before update of driving_permission on public.profiles
for each row execute function public.guard_driving_permission_grant();
revoke all on function public.guard_driving_permission_grant() from public, anon, authenticated;

create or replace function public.admin_review_driving_permission_request(
  p_request_id uuid, p_decision text, p_reason text,
  p_induction_confirmed boolean, p_documents_verified boolean)
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
      or p_induction_confirmed is distinct from true or p_documents_verified is distinct from true then
      raise exception 'Approved account, checked driving documents and confirmed induction required' using errcode = '42501';
    end if;
  end if;
  update public.ops_driving_permission_requests set status = case when p_decision = 'approve' then 'Approved' else 'Rejected' end,
    decision_reason = btrim(p_reason), reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now(),
    documents_verified_at = case when p_decision = 'approve' then now() else null end,
    documents_verified_by = case when p_decision = 'approve' then auth.uid() else null end
    where id = r.id returning * into r;
  if p_decision = 'approve' then
    update public.profiles set driving_permission = true, induction_confirmed = true,
      induction_confirmed_at = now(), induction_confirmed_by = auth.uid(), updated_at = now()
      where id = r.user_id;
  end if;
  insert into public.admin_portal_audit(actor_id, action, target_type, target_id, reason, before_value, after_value)
    values (auth.uid(), 'review_driving_permission_request', 'profile', r.user_id::text, btrim(p_reason),
      jsonb_build_object('request_status', 'Pending', 'driving_permission', p.driving_permission),
      jsonb_build_object('request_status', r.status, 'driving_permission', case when p_decision = 'approve' then true else p.driving_permission end,
        'driving_documents_verified', p_decision = 'approve', 'induction_confirmed', p_decision = 'approve'));
  return to_jsonb(r) - 'reviewed_by' - 'documents_verified_by';
end $$;

create or replace function public.request_driving_permission(p_details text)
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
      decision_reason = '', reviewed_by = null, reviewed_at = null, documents_verified_at = null,
      documents_verified_by = null, created_at = now(), updated_at = now()
    returning * into r;
  return to_jsonb(r) - 'reviewed_by' - 'documents_verified_by';
end $$;

create or replace function public.my_driving_permission_request()
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign-in required' using errcode = '42501'; end if;
  return (select to_jsonb(r) - 'reviewed_by' - 'documents_verified_by'
    from public.ops_driving_permission_requests r where r.user_id = auth.uid());
end $$;
