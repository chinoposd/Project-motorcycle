-- Record in-person document verification before granting Driving Permission.
alter table public.ops_driving_permission_requests
  add column documents_verified_at timestamptz,
  add column documents_verified_by uuid references auth.users(id);

drop function public.admin_review_driving_permission_request(uuid,text,text,boolean);
create function public.admin_review_driving_permission_request(
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
    update public.profiles set driving_permission = true, induction_confirmed = true, updated_at = now() where id = r.user_id;
  end if;
  update public.ops_driving_permission_requests set status = case when p_decision = 'approve' then 'Approved' else 'Rejected' end,
    decision_reason = btrim(p_reason), reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now(),
    documents_verified_at = case when p_decision = 'approve' then now() else null end,
    documents_verified_by = case when p_decision = 'approve' then auth.uid() else null end
    where id = r.id returning * into r;
  insert into public.admin_portal_audit(actor_id, action, target_type, target_id, reason, before_value, after_value)
    values (auth.uid(), 'review_driving_permission_request', 'profile', r.user_id::text, btrim(p_reason),
      jsonb_build_object('request_status', 'Pending', 'driving_permission', p.driving_permission),
      jsonb_build_object('request_status', r.status, 'driving_permission', case when p_decision = 'approve' then true else p.driving_permission end,
        'driving_documents_verified', p_decision = 'approve', 'induction_confirmed', p_decision = 'approve'));
  return to_jsonb(r) - 'reviewed_by' - 'documents_verified_by';
end $$;

revoke all on function public.admin_review_driving_permission_request(uuid,text,text,boolean,boolean) from public, anon, authenticated;
grant execute on function public.admin_review_driving_permission_request(uuid,text,text,boolean,boolean) to authenticated;
