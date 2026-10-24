create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 80),
  phone text not null default '',
  department text not null default '',
  requested_role text not null check (requested_role in ('Student', 'Employee')),
  role text not null check (role in ('Student', 'Employee', 'Manager', 'Admin')),
  account_status text not null default 'Pending'
    check (account_status in ('Pending', 'Approved', 'Rejected', 'Suspended')),
  driving_permission boolean not null default false,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

alter table public.profiles enable row level security;

revoke all on table public.profiles from anon, authenticated;
grant usage on schema public to authenticated;
grant select on table public.profiles to authenticated;

create policy "Users can read their own profile"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

create function public.create_profile_for_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_role_text text;
  profile_name text;
begin
  requested_role_text := new.raw_user_meta_data ->> 'requested_role';
  if requested_role_text is null then
    requested_role_text := 'Student';
  end if;

  if requested_role_text not in ('Student', 'Employee') then
    raise exception 'Unsupported requested role';
  end if;

  profile_name := pg_catalog.left(
    coalesce(
      nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      'ผู้ใช้ใหม่'
    ),
    80
  );

  insert into public.profiles (
    id,
    full_name,
    phone,
    department,
    requested_role,
    role,
    account_status,
    driving_permission
  ) values (
    new.id,
    profile_name,
    pg_catalog.left(coalesce(new.raw_user_meta_data ->> 'phone', ''), 32),
    pg_catalog.left(coalesce(new.raw_user_meta_data ->> 'department', ''), 120),
    requested_role_text,
    requested_role_text,
    'Pending',
    false
  );

  return new;
end;
$$;

revoke all on function public.create_profile_for_new_auth_user() from public, anon, authenticated;

create trigger on_auth_user_created_create_profile
  after insert on auth.users
  for each row execute function public.create_profile_for_new_auth_user();
