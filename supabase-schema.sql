-- Raju Driving School student portal
-- Run this entire script in Supabase SQL Editor.
-- Passwords are managed by Supabase Auth; they are NOT stored in this table.

create table if not exists public.student_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  email text,
  license_category text,
  course text,
  enrollment_date date,
  student_status text default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.student_profiles enable row level security;

create policy "Students can read their own profile"
on public.student_profiles for select
using (auth.uid() = id);

create policy "Students can update their own profile"
on public.student_profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

create or replace function public.handle_new_student()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.student_profiles (id, full_name, phone, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'Student'),
    new.raw_user_meta_data->>'phone',
    new.email
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    phone = excluded.phone,
    email = excluded.email,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_student();

create or replace function public.touch_student_profile()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists student_profile_updated on public.student_profiles;
create trigger student_profile_updated
before update on public.student_profiles
for each row execute procedure public.touch_student_profile();
