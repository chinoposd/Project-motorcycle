-- Keep the live account gate synchronized with server-side profile changes.
create or replace function public.my_operations_snapshot()
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; own_account jsonb;
begin
  if auth.uid() is null then raise exception 'Sign-in required' using errcode='42501'; end if;
  select jsonb_build_object('id',p.id,'name',p.full_name,'phone',p.phone,'role',p.role,
    'status',p.account_status,'driving_permission',p.driving_permission,'induction_confirmed',p.induction_confirmed)
    into own_account from public.profiles p where p.id=auth.uid();
  if own_account is null then raise exception 'Account not found' using errcode='42501';end if;
  select jsonb_build_object('account',own_account,
    'project_phone',(select project_phone from public.ops_project_config where singleton),
    'appeals',coalesce((select jsonb_agg(to_jsonb(a)-'account_updated_at' order by created_at desc)
      from public.ops_account_appeals a where user_id=auth.uid()),'[]'::jsonb),
    'nfc_card',(select to_jsonb(c)-'card_ref'-'registered_by' from public.ops_nfc_cards c
      where user_id=auth.uid() and revoked_at is null)) into result;
  return result||app_ops.user_session_snapshot()||app_ops.user_workflow_snapshot();
end $$;
revoke all on function public.my_operations_snapshot() from public,anon,authenticated;
grant execute on function public.my_operations_snapshot() to authenticated;
