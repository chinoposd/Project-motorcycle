-- Include Managers in the driving-permission review list and allow the same
-- audited induction workflow that applies to Student and Employee drivers.
create or replace function public.admin_portal_snapshot()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if not public.admin_is_approved() then
    raise exception 'Approved Admin access required' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'pending_accounts', (select count(*) from public.profiles p where p.account_status = 'Pending'),
    'permission_accounts', coalesce((select jsonb_agg(jsonb_build_object(
      'id', p.id, 'name', p.full_name, 'email', u.email, 'role', p.role,
      'induction_confirmed', p.induction_confirmed, 'driving_permission', p.driving_permission
    )) from public.profiles p join auth.users u on u.id = p.id
      where p.account_status = 'Approved' and p.role in ('Student', 'Employee', 'Manager')), '[]'::jsonb),
    'settings', (select to_jsonb(s) - 'singleton' from public.admin_portal_settings s where s.singleton),
    'announcements', coalesce((select jsonb_agg(to_jsonb(a) order by a.updated_at desc)
      from public.admin_announcements a), '[]'::jsonb),
    'privacy_requests', coalesce((select jsonb_agg(jsonb_build_object(
      'id', r.id, 'requester_id', r.requester_id, 'requester_name', p.full_name,
      'requester_email', u.email, 'request_type', r.request_type, 'details', r.details,
      'status', r.status, 'admin_note', r.admin_note, 'created_at', r.created_at,
      'reviewed_at', r.reviewed_at
    ) order by r.created_at desc) from public.admin_data_subject_requests r
      join auth.users u on u.id = r.requester_id left join public.profiles p on p.id = r.requester_id), '[]'::jsonb),
    'service', (select to_jsonb(v) - 'singleton' from public.admin_vehicle_service v where v.singleton),
    'audit', coalesce((select jsonb_agg(to_jsonb(entries) order by entries.created_at desc) from (
      select l.id::text as id, p.full_name as actor, l.action, l.target_type, l.target_id,
        l.reason, l.created_at, l.before_value, l.after_value
      from (select * from public.admin_portal_audit order by created_at desc limit 100) l
        left join public.profiles p on p.id = l.actor_id
      union all
      select a.id::text, p.full_name, 'account_review_' || a.decision, 'profile',
        a.target_account_id::text, a.reason, a.created_at,
        jsonb_build_object('account_status', a.previous_account_status),
        jsonb_build_object('account_status', a.resulting_account_status, 'role', a.assigned_role)
      from public.admin_account_review_audit a left join public.profiles p on p.id = a.actor_id
      order by created_at desc limit 100
    ) entries), '[]'::jsonb),
    'cancellation_events_available', false,
    'no_show_events_available', false
  ) into result;
  return result;
end;
$$;

create or replace function public.admin_set_driving_permission(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  target_profile public.profiles%rowtype;
  why text := left(btrim(coalesce(p_payload->>'reason', '')), 1000);
  permission_enabled boolean := coalesce((p_payload->>'enabled')::boolean, false);
  old_value jsonb;
  new_value jsonb;
begin
  if actor is null or not public.admin_is_approved() then
    raise exception 'Approved Admin access required' using errcode = '42501';
  end if;
  if why = '' then
    raise exception 'A reason is required for permission changes' using errcode = '22023';
  end if;
  select * into target_profile from public.profiles
    where id = (p_payload->>'id')::uuid for update;
  if not found or target_profile.account_status <> 'Approved'
    or target_profile.role not in ('Student', 'Employee', 'Manager') then
    raise exception 'Approved driver account required' using errcode = '22023';
  end if;
  if permission_enabled and coalesce((p_payload->>'induction_confirmed')::boolean, false) is not true then
    raise exception 'Team induction must be confirmed before granting permission' using errcode = '22023';
  end if;

  old_value := jsonb_build_object(
    'driving_permission', target_profile.driving_permission,
    'induction_confirmed', target_profile.induction_confirmed
  );
  update public.profiles set
    driving_permission = permission_enabled,
    induction_confirmed = case when permission_enabled then true else induction_confirmed end,
    induction_confirmed_at = case when permission_enabled then now() else induction_confirmed_at end,
    induction_confirmed_by = case when permission_enabled then actor else induction_confirmed_by end,
    updated_at = now()
    where id = target_profile.id returning to_jsonb(profiles) into new_value;
  insert into public.admin_portal_audit(
    actor_id, action, target_type, target_id, reason, before_value, after_value
  ) values (
    actor, 'set_driving_permission', 'profile', target_profile.id::text,
    why, old_value, new_value
  );
  return jsonb_build_object('ok', true, 'id', target_profile.id::text, 'value', new_value);
end;
$$;

revoke all on function public.admin_portal_snapshot() from public, anon, authenticated;
revoke all on function public.admin_set_driving_permission(jsonb) from public, anon, authenticated;
grant execute on function public.admin_portal_snapshot() to authenticated;
grant execute on function public.admin_set_driving_permission(jsonb) to authenticated;
