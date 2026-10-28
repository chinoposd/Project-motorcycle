-- A bounded operations-only audit view for the Manager dashboard.
-- Deliberately omit before/after JSON and Admin account/privacy actions.
create or replace function public.admin_operations_snapshot(p_date date)
returns jsonb language plpgsql security definer set search_path='' as $$
declare base jsonb;
begin
  perform app_ops.require_operator(false);
  select jsonb_build_object(
    'can_admin',public.admin_is_approved(),
    'config',(select to_jsonb(c)-'singleton' from public.ops_project_config c),
    'appeals',case when public.admin_is_approved() then coalesce((select jsonb_agg(to_jsonb(a)||jsonb_build_object('user_name',p.full_name) order by a.created_at desc) from public.ops_account_appeals a join public.profiles p on p.id=a.user_id),'[]'::jsonb) else '[]'::jsonb end,
    'nfc_cards',case when public.admin_is_approved() then coalesce((select jsonb_agg((to_jsonb(c)-'card_ref')||jsonb_build_object('user_name',p.full_name) order by c.registered_at desc) from public.ops_nfc_cards c join public.profiles p on p.id=c.user_id),'[]'::jsonb) else '[]'::jsonb end,
    'accounts',case when public.admin_is_approved() then coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',full_name,'role',role,'status',account_status,'driving_permission',driving_permission,'induction_confirmed',induction_confirmed)) from public.profiles),'[]'::jsonb) else '[]'::jsonb end,
    'manager_activity',coalesce((select jsonb_agg(to_jsonb(activity) order by activity.created_at desc) from (
      select a.id,a.action,a.target_type,a.reason,a.created_at,coalesce(p.full_name,'ผู้ดูแลระบบ') as actor_name
      from public.admin_portal_audit a left join public.profiles p on p.id=a.actor_id
      where a.action in ('acknowledge_alert','review_no_show','approve_no_show_release','clear_safety_block')
      order by a.created_at desc,a.id desc limit 30
    ) activity),'[]'::jsonb)
  ) into base;
  return base||app_ops.session_snapshot(p_date)||app_ops.workflow_snapshot(p_date);
end $$;

revoke all on function public.admin_operations_snapshot(date) from public,anon,authenticated;
grant execute on function public.admin_operations_snapshot(date) to authenticated;
