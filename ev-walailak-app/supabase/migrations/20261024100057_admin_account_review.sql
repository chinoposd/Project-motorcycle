-- Least-privilege Admin RPCs for reviewing one pending applicant at a time.
-- Account approval intentionally does not grant driving permission.

create table public.admin_account_review_audit (
  id bigint generated always as identity primary key,
  actor_id uuid not null,
  target_account_id uuid not null,
  decision text not null check (decision in ('Approved', 'Rejected')),
  previous_account_status text not null check (previous_account_status = 'Pending'),
  resulting_account_status text not null check (resulting_account_status in ('Approved', 'Rejected')),
  requested_role text not null check (requested_role in ('Student', 'Employee')),
  assigned_role text not null check (assigned_role in ('Student', 'Employee')),
  affiliation_verified boolean not null check (affiliation_verified),
  reason text not null default '',
  created_at timestamptz not null default pg_catalog.now()
);

alter table public.admin_account_review_audit enable row level security;
revoke all on table public.admin_account_review_audit from public, anon, authenticated;

create function public.admin_list_pending_accounts()
returns table (
  account_id uuid,
  email text,
  full_name text,
  phone text,
  department text,
  requested_role text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not exists (
    select 1
    from public.profiles as admin_profile
    where admin_profile.id = auth.uid()
      and admin_profile.role = 'Admin'
      and admin_profile.account_status = 'Approved'
  ) then
    raise exception 'Approved Admin access required' using errcode = '42501';
  end if;

  return query
  select
    applicant.id as account_id,
    applicant_auth.email::text as email,
    applicant.full_name,
    applicant.phone,
    applicant.department,
    applicant.requested_role,
    applicant.created_at
  from public.profiles as applicant
  join auth.users as applicant_auth on applicant_auth.id = applicant.id
  where applicant.account_status = 'Pending'
  order by applicant.created_at asc, applicant.id asc;
end;
$$;

create function public.admin_review_pending_account(
  p_account_id uuid,
  p_decision text,
  p_verified_role text,
  p_affiliation_verified boolean,
  p_reason text
)
returns table (
  account_id uuid,
  account_status text,
  role text,
  driving_permission boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_profile public.profiles%rowtype;
  result_status text;
  result_role text;
  result_driving_permission boolean;
  review_reason text := pg_catalog.left(
    pg_catalog.btrim(coalesce(p_reason, ''), E' \t\n\r\f\v'),
    1000
  );
begin
  if auth.uid() is null or not exists (
    select 1
    from public.profiles as admin_profile
    where admin_profile.id = auth.uid()
      and admin_profile.role = 'Admin'
      and admin_profile.account_status = 'Approved'
  ) then
    raise exception 'Approved Admin access required' using errcode = '42501';
  end if;

  if p_decision is null or p_decision not in ('Approved', 'Rejected') then
    raise exception 'Decision must be Approved or Rejected' using errcode = '22023';
  end if;

  if p_affiliation_verified is distinct from true then
    raise exception 'University affiliation must be verified first' using errcode = '22023';
  end if;

  if p_decision = 'Approved' and (p_verified_role is null or p_verified_role not in ('Student', 'Employee')) then
    raise exception 'Approval requires a verified Student or Employee role' using errcode = '22023';
  end if;

  if p_decision = 'Rejected' and p_verified_role is not null then
    raise exception 'Rejected accounts do not accept an assigned role' using errcode = '22023';
  end if;

  if p_decision = 'Rejected' and review_reason = '' then
    raise exception 'A rejection reason is required' using errcode = '22023';
  end if;

  if p_reason is not null and pg_catalog.char_length(p_reason) > 1000 then
    raise exception 'Reason must be at most 1000 characters' using errcode = '22023';
  end if;

  select applicant.*
  into target_profile
  from public.profiles as applicant
  where applicant.id = p_account_id
    and applicant.account_status = 'Pending'
  for update;

  if not found then
    raise exception 'Pending account not found or already reviewed' using errcode = 'P0002';
  end if;

  if p_decision = 'Approved' then
    update public.profiles as applicant
    set role = p_verified_role,
        account_status = 'Approved',
        updated_at = pg_catalog.now()
    where applicant.id = target_profile.id
    returning applicant.account_status, applicant.role, applicant.driving_permission
      into result_status, result_role, result_driving_permission;
  else
    update public.profiles as applicant
    set account_status = 'Rejected',
        updated_at = pg_catalog.now()
    where applicant.id = target_profile.id
    returning applicant.account_status, applicant.role, applicant.driving_permission
      into result_status, result_role, result_driving_permission;
  end if;

  insert into public.admin_account_review_audit (
    actor_id,
    target_account_id,
    decision,
    previous_account_status,
    resulting_account_status,
    requested_role,
    assigned_role,
    affiliation_verified,
    reason
  ) values (
    auth.uid(),
    target_profile.id,
    p_decision,
    target_profile.account_status,
    result_status,
    target_profile.requested_role,
    result_role,
    true,
    review_reason
  );

  return query select p_account_id, result_status, result_role, result_driving_permission;
end;
$$;

revoke all on function public.admin_list_pending_accounts() from public, anon, authenticated;
revoke all on function public.admin_review_pending_account(uuid, text, text, boolean, text) from public, anon, authenticated;
grant execute on function public.admin_list_pending_accounts() to authenticated;
grant execute on function public.admin_review_pending_account(uuid, text, text, boolean, text) to authenticated;
