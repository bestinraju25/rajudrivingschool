-- RAJU DRIVING SCHOOL — DIGITAL FORM 14 / FORM 15 REGISTER
-- Standalone from the Defensive Driving Seminar system.
-- Run this once in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.student_register_entries (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.student_profiles(id) on delete set null,
  enrolment_number text,
  full_name text not null,
  parent_relation_name text,
  phone text,
  email text,
  permanent_address text,
  temporary_address text,
  official_address text,
  date_of_birth date,
  vehicle_class text,
  enrollment_date date,
  learner_license_number text,
  learner_license_expiry date,
  course_completion_date date,
  competency_test_date date,
  driving_license_number text,
  driving_license_issue_date date,
  driving_license_authority text,
  remarks text,
  blood_group text,
  photo_data text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists student_register_entries_enrolment_idx
on public.student_register_entries(enrolment_number)
where enrolment_number is not null and enrolment_number <> '';

create index if not exists student_register_entries_name_idx
on public.student_register_entries(full_name);

create table if not exists public.student_driving_hours (
  id uuid primary key default gen_random_uuid(),
  student_register_id uuid not null references public.student_register_entries(id) on delete cascade,
  date date,
  from_time time,
  to_time time,
  vehicle_class text,
  created_at timestamptz not null default now()
);

create index if not exists student_driving_hours_register_idx
on public.student_driving_hours(student_register_id, date, from_time);

alter table public.student_register_entries enable row level security;
alter table public.student_driving_hours enable row level security;

drop policy if exists "Admins manage student register entries" on public.student_register_entries;
create policy "Admins manage student register entries"
on public.student_register_entries for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins manage student driving hours" on public.student_driving_hours;
create policy "Admins manage student driving hours"
on public.student_driving_hours for all to authenticated
using (public.is_admin()) with check (public.is_admin());
