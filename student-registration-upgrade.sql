-- ============================================================
-- RAJU DRIVING SCHOOL - STUDENT REGISTRATION DETAILS UPGRADE
-- Run this AFTER supabase-schema.sql and booking-schema.sql
-- Safe to run on the existing project; uses IF NOT EXISTS.
-- ============================================================

alter table public.student_profiles
  add column if not exists date_of_birth date,
  add column if not exists blood_group text,
  add column if not exists address text,
  add column if not exists pincode text,
  add column if not exists applying_for text;

-- Keep the allowed registration categories clear and consistent.
alter table public.student_profiles drop constraint if exists student_profiles_blood_group_check;
alter table public.student_profiles
  add constraint student_profiles_blood_group_check
  check (blood_group is null or blood_group in ('A+','A-','B+','B-','AB+','AB-','O+','O-'));

alter table public.student_profiles drop constraint if exists student_profiles_applying_for_check;
alter table public.student_profiles
  add constraint student_profiles_applying_for_check
  check (applying_for is null or applying_for in ('LMV+M/cy','LMV only','M/cy only'));

-- Update the signup trigger so all registration details are copied from
-- Supabase Auth user metadata into the student's private profile row.
create or replace function public.handle_new_student()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.student_profiles (
    id, full_name, phone, email, date_of_birth, blood_group, address, pincode, applying_for
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'Student'),
    new.raw_user_meta_data->>'phone',
    new.email,
    nullif(new.raw_user_meta_data->>'date_of_birth','')::date,
    new.raw_user_meta_data->>'blood_group',
    new.raw_user_meta_data->>'address',
    new.raw_user_meta_data->>'pincode',
    new.raw_user_meta_data->>'applying_for'
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    phone = excluded.phone,
    email = excluded.email,
    date_of_birth = excluded.date_of_birth,
    blood_group = excluded.blood_group,
    address = excluded.address,
    pincode = excluded.pincode,
    applying_for = excluded.applying_for,
    updated_at = now();
  return new;
end;
$$;

-- Trigger name is the same as the existing one; recreate it so the new
-- function is used for future signups.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_student();

create index if not exists student_profiles_applying_for_idx
on public.student_profiles(applying_for);
