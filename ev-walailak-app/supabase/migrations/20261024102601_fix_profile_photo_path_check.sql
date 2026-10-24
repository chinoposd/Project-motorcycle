alter table public.profiles
  drop constraint profiles_avatar_path_owner_and_format_check,
  add constraint profiles_avatar_path_owner_and_format_check
    check (
      avatar_path is null
      or avatar_path ~ ('^' || id::text || '/[0-9a-f-]{36}[.]jpg$')
    );
