-- Full account inventory and individually audited Admin account changes.
alter table public.profiles
  add column account_status_reason text not null default ''
  check (char_length(account_status_reason) <= 1000);

update public.profiles p
set account_status_reason = review.reason
from (
  select distinct on (target_account_id) target_account_id, reason
  from public.admin_account_review_audit
  where decision = 'Rejected'
  order by target_account_id, created_at desc, id desc
) review
where p.id = review.target_account_id and p.account_status = 'Rejected';

create or replace function public.admin_sync_review_reason()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.decision = 'Rejected' then
    update public.profiles set account_status_reason = new.reason where id = new.target_account_id;
  end if;
  return new;
end;
$$;
revoke all on function public.admin_sync_review_reason() from public, anon, authenticated;

create trigger admin_account_review_reason
after insert on public.admin_account_review_audit
for each row execute function public.admin_sync_review_reason();

create or replace function public.admin_list_accounts()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not public.admin_is_approved() then
    raise exception 'Approved Admin access required' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'email', coalesce(u.email, ''), 'full_name', p.full_name, 'phone', p.phone,
    'department', p.department, 'requested_role', p.requested_role,
    'role', p.role, 'account_status', p.account_status,
    'account_status_reason', p.account_status_reason,
    'driving_permission', p.driving_permission, 'induction_confirmed', p.induction_confirmed,
    'created_at', p.created_at, 'updated_at', p.updated_at
  ) order by p.created_at desc, p.id desc), '[]'::jsonb)
  into result
  from public.profiles p join auth.users u on u.id = p.id;
  return result;
end;
$$;

create or replace function public.admin_update_account(
  p_account_id uuid, p_action text, p_value text, p_reason text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  target public.profiles%rowtype;
  before_value jsonb;
  after_value jsonb;
  why text := btrim(coalesce(p_reason, ''));
  new_value text := btrim(coalesce(p_value, ''));
begin
  if actor is null or not public.admin_is_approved() then
    raise exception 'Approved Admin access required' using errcode = '42501';
  end if;
  if p_account_id is null or p_action is null or p_action not in ('rename', 'change_role', 'suspend', 'restore', 'grant_driving', 'revoke_driving') then
    raise exception 'Unsupported account action' using errcode = '22023';
  end if;
  if char_length(why) < 5 or char_length(why) > 1000 then
    raise exception 'A reason of 5 to 1000 characters is required' using errcode = '22023';
  end if;

  -- Serializes role/status changes so concurrent requests cannot remove the final Admin.
  perform pg_catalog.pg_advisory_xact_lock(2661001::bigint);
  select * into target from public.profiles where id = p_account_id for update;
  if not found then raise exception 'Account not found' using errcode = 'P0002'; end if;
  if p_account_id = actor and p_action <> 'rename' then
    raise exception 'Admin cannot change own role or account status' using errcode = '42501';
  end if;
  if target.role = 'Admin' and target.account_status = 'Approved'
    and (p_action = 'suspend' or (p_action = 'change_role' and new_value <> 'Admin'))
    and (select count(*) from public.profiles where role = 'Admin' and account_status = 'Approved') <= 1 then
    raise exception 'The final approved Admin cannot be removed' using errcode = '22023';
  end if;

  before_value := jsonb_build_object(
    'full_name', target.full_name, 'role', target.role,
    'account_status', target.account_status, 'account_status_reason', target.account_status_reason,
    'driving_permission', target.driving_permission, 'induction_confirmed', target.induction_confirmed
  );
  if p_action = 'rename' then
    if char_length(new_value) not between 1 and 80 or new_value = target.full_name then
      raise exception 'Provide a different name of 1 to 80 characters' using errcode = '22023';
    end if;
    update public.profiles set full_name = new_value, updated_at = now() where id = p_account_id;
  elsif p_action = 'change_role' then
    if target.account_status not in ('Approved', 'Suspended')
      or new_value not in ('Student', 'Employee', 'Manager', 'Admin')
      or new_value = target.role then
      raise exception 'Role change requires a reviewed account and a different valid role' using errcode = '22023';
    end if;
    update public.profiles set role = new_value, driving_permission = false, updated_at = now()
    where id = p_account_id;
  elsif p_action = 'grant_driving' then
    if target.account_status <> 'Approved' or target.role not in ('Student', 'Employee', 'Manager')
      or target.driving_permission or new_value <> 'induction_confirmed' then
      raise exception 'An Approved driver and explicit induction confirmation are required' using errcode = '22023';
    end if;
    update public.profiles set driving_permission = true, induction_confirmed = true,
      induction_confirmed_at = now(), induction_confirmed_by = actor, updated_at = now()
    where id = p_account_id;
  elsif p_action = 'revoke_driving' then
    if target.account_status <> 'Approved' or target.role not in ('Student', 'Employee', 'Manager')
      or not target.driving_permission then
      raise exception 'Approved driver with active permission required' using errcode = '22023';
    end if;
    update public.profiles set driving_permission = false, updated_at = now() where id = p_account_id;
  elsif p_action = 'suspend' then
    if target.account_status <> 'Approved' then
      raise exception 'Only an Approved account can be suspended' using errcode = '22023';
    end if;
    update public.profiles set account_status = 'Suspended', account_status_reason = why,
      driving_permission = false, updated_at = now() where id = p_account_id;
  else
    if target.account_status <> 'Suspended' then
      raise exception 'Only a Suspended account can be restored' using errcode = '22023';
    end if;
    update public.profiles set account_status = 'Approved', account_status_reason = '',
      driving_permission = false, updated_at = now() where id = p_account_id;
  end if;

  select jsonb_build_object(
    'full_name', p.full_name, 'role', p.role,
    'account_status', p.account_status, 'account_status_reason', p.account_status_reason,
    'driving_permission', p.driving_permission, 'induction_confirmed', p.induction_confirmed
  ) into after_value from public.profiles p where p.id = p_account_id;
  insert into public.admin_portal_audit(actor_id, action, target_type, target_id, reason, before_value, after_value)
  values(actor, 'account_' || p_action, 'profile', p_account_id::text, why, before_value, after_value);
  return after_value;
end;
$$;

revoke all on function public.admin_list_accounts() from public, anon, authenticated;
revoke all on function public.admin_update_account(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.admin_list_accounts() to authenticated;
grant execute on function public.admin_update_account(uuid,text,text,text) to authenticated;
