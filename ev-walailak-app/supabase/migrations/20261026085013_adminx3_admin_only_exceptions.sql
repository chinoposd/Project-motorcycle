-- Only Admin may close an exceptional Session or resolve vehicle-state conflicts.
-- Manager retains the documented, narrow Safety Block clearance after inspection.
create or replace function public.admin_operations_action(p_action text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  perform app_ops.require_operator(false);
  if p_action in ('close_session_exception','resolve_vehicle_conflict') then
    perform app_ops.require_operator(true);
  end if;
  if p_action in ('review_appeal','register_nfc','revoke_nfc','update_operations_config') then
    return app_ops.foundation_action(p_action,p_payload);
  end if;
  result:=app_ops.session_action(p_action,p_payload);
  if result is not null then return result;end if;
  result:=app_ops.workflow_action(p_action,p_payload);
  if result is not null then return result;end if;
  raise exception 'Unsupported operation' using errcode='22023';
end $$;
revoke all on function public.admin_operations_action(text,jsonb) from public,anon,authenticated;
grant execute on function public.admin_operations_action(text,jsonb) to authenticated;
