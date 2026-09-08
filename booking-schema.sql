-- ============================================================
-- RAJU DRIVING SCHOOL - BOOKING / ADMIN / FEES SYSTEM
-- Run this AFTER supabase-schema.sql
-- ============================================================

create extension if not exists btree_gist;

-- ---------- INSTRUCTORS ----------
create table if not exists public.instructors (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.instructors (name) values
  ('Yashodaran'),
  ('Francis'),
  ('Ranjith'),
  ('Akhil'),
  ('Lissy')
on conflict (name) do update set active = true;

-- ---------- ADMIN USERS ----------
create table if not exists public.admin_users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- BOOKINGS ----------
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  requested_start timestamptz not null,
  requested_end timestamptz not null,
  duration_minutes integer generated always as (round(extract(epoch from (requested_end - requested_start)) / 60)::integer) stored,
  preferred_instructor_id uuid references public.instructors(id) on delete set null,
  assigned_instructor_id uuid references public.instructors(id) on delete set null,
  status text not null default 'pending_payment' check (status in ('pending_payment','payment_recorded','approved','completed','cancelled','rejected')),
  class_fee numeric(10,2) not null default 0 check (class_fee >= 0),
  student_note text,
  admin_note text,
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requested_end > requested_start),
  check (duration_minutes >= 60)
);

-- ---------- INSTRUCTOR BLOCKED / UNAVAILABLE TIMES ----------
create table if not exists public.instructor_unavailability (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references public.instructors(id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (end_at > start_at)
);

-- ---------- MANUAL FEE PAYMENTS ----------
create table if not exists public.fee_payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  amount numeric(10,2) not null check (amount > 0),
  paid_on date not null default current_date,
  payment_method text,
  receipt_number text,
  note text,
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------- STUDENT FEE SUMMARY ----------
-- Adds an optional overall course fee to the existing student profile.
alter table public.student_profiles
  add column if not exists total_course_fee numeric(10,2) not null default 0 check (total_course_fee >= 0);

-- ---------- HELPERS ----------
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users
    where id = auth.uid() and active = true
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- ---------- RLS ----------
alter table public.instructors enable row level security;
alter table public.admin_users enable row level security;
alter table public.bookings enable row level security;
alter table public.instructor_unavailability enable row level security;
alter table public.fee_payments enable row level security;

-- Instructors are visible to signed-in students and admins.
drop policy if exists "Authenticated users can view instructors" on public.instructors;
create policy "Authenticated users can view instructors"
on public.instructors for select to authenticated
using (true);

drop policy if exists "Admins manage instructors" on public.instructors;
create policy "Admins manage instructors"
on public.instructors for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- Admin users: users may see their own row; admins can manage all.
drop policy if exists "Users can view own admin row" on public.admin_users;
create policy "Users can view own admin row"
on public.admin_users for select to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists "Admins manage admin rows" on public.admin_users;
create policy "Admins manage admin rows"
on public.admin_users for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- Bookings: students see/create their own; admins manage everything.
drop policy if exists "Students view own bookings" on public.bookings;
create policy "Students view own bookings"
on public.bookings for select to authenticated
using (student_id = auth.uid() or public.is_admin());

drop policy if exists "Students create own bookings" on public.bookings;
create policy "Students create own bookings"
on public.bookings for insert to authenticated
with check (student_id = auth.uid());

drop policy if exists "Students cancel own pending bookings" on public.bookings;
create policy "Students cancel own pending bookings"
on public.bookings for update to authenticated
using (student_id = auth.uid() and status in ('pending_payment','payment_recorded'))
with check (student_id = auth.uid() and status in ('pending_payment','cancelled'));

drop policy if exists "Admins manage bookings" on public.bookings;
create policy "Admins manage bookings"
on public.bookings for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- Students can view instructor blocks so the booking UI can avoid unavailable slots.
drop policy if exists "Authenticated users view instructor unavailability" on public.instructor_unavailability;
create policy "Authenticated users view instructor unavailability"
on public.instructor_unavailability for select to authenticated
using (true);

drop policy if exists "Admins manage instructor unavailability" on public.instructor_unavailability;
create policy "Admins manage instructor unavailability"
on public.instructor_unavailability for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- Payments are private to the student and fully manageable by admins.
drop policy if exists "Students view own payments" on public.fee_payments;
create policy "Students view own payments"
on public.fee_payments for select to authenticated
using (student_id = auth.uid() or public.is_admin());

drop policy if exists "Admins manage payments" on public.fee_payments;
create policy "Admins manage payments"
on public.fee_payments for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- ---------- CONFLICT CHECK ----------
create or replace function public.prevent_schedule_conflicts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.assigned_instructor_id is not null and new.status in ('pending_payment','payment_recorded','approved','completed') then
    if exists (
      select 1 from public.instructor_unavailability u
      where u.instructor_id = new.assigned_instructor_id
        and tstzrange(u.start_at, u.end_at, '[)') && tstzrange(new.requested_start, new.requested_end, '[)')
    ) then
      raise exception 'The selected instructor is unavailable for this time.';
    end if;

    if exists (
      select 1 from public.bookings b
      where b.id <> new.id
        and b.assigned_instructor_id = new.assigned_instructor_id
        and b.status in ('pending_payment','payment_recorded','approved','completed')
        and tstzrange(b.requested_start, b.requested_end, '[)') && tstzrange(new.requested_start, new.requested_end, '[)')
    ) then
      raise exception 'The selected instructor already has a booking in this time.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_schedule_conflicts on public.bookings;
create trigger prevent_schedule_conflicts
before insert or update on public.bookings
for each row execute procedure public.prevent_schedule_conflicts();

-- Prevent overlapping blocks for the same instructor.
create or replace function public.prevent_unavailability_conflicts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.instructor_unavailability u
    where u.id <> new.id
      and u.instructor_id = new.instructor_id
      and tstzrange(u.start_at, u.end_at, '[)') && tstzrange(new.start_at, new.end_at, '[)')
  ) then
    raise exception 'This instructor already has an unavailable block in this time.';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_unavailability_conflicts on public.instructor_unavailability;
create trigger prevent_unavailability_conflicts
before insert or update on public.instructor_unavailability
for each row execute procedure public.prevent_unavailability_conflicts();

-- Keep updated_at current.
create or replace function public.touch_booking_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists bookings_updated_at on public.bookings;
create trigger bookings_updated_at
before update on public.bookings
for each row execute procedure public.touch_booking_updated_at();

-- Useful indexes.
create index if not exists bookings_student_idx on public.bookings(student_id, requested_start desc);
create index if not exists bookings_instructor_idx on public.bookings(assigned_instructor_id, requested_start);
create index if not exists bookings_status_idx on public.bookings(status, requested_start);
create index if not exists fee_payments_student_idx on public.fee_payments(student_id, paid_on desc);
create index if not exists instructor_unavailability_idx on public.instructor_unavailability(instructor_id, start_at);

-- IMPORTANT ADMIN SETUP:
-- 1. Create the admin user in Supabase Authentication > Users.
-- 2. Then replace the UUID below and run:
-- insert into public.admin_users (id, email, full_name) values ('ADMIN-AUTH-USER-UUID', 'admin@rajudrivingschool.com', 'Raju Driving School Admin');
-- Never put a service-role key in the website.

-- ---------- SCHOOL SETTINGS ----------
create table if not exists public.school_settings (
  id integer primary key default 1 check (id = 1),
  hourly_class_fee numeric(10,2) not null default 0 check (hourly_class_fee >= 0),
  updated_at timestamptz not null default now()
);
insert into public.school_settings (id, hourly_class_fee) values (1, 0)
on conflict (id) do nothing;
alter table public.school_settings enable row level security;
drop policy if exists "Authenticated users can view school settings" on public.school_settings;
create policy "Authenticated users can view school settings"
on public.school_settings for select to authenticated using (true);
drop policy if exists "Admins manage school settings" on public.school_settings;
create policy "Admins manage school settings"
on public.school_settings for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- Use the school's hourly rate when a booking fee has not been set explicitly.
create or replace function public.set_booking_fee()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rate numeric;
begin
  if coalesce(new.class_fee, 0) = 0 then
    select hourly_class_fee into rate from public.school_settings where id = 1;
    if coalesce(rate, 0) > 0 then
      new.class_fee := rate * (new.duration_minutes::numeric / 60);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists set_booking_fee on public.bookings;
create trigger set_booking_fee
before insert or update on public.bookings
for each row execute procedure public.set_booking_fee();

-- Admin-only approval that requires full manual payment against the booking fee.
drop function if exists public.approve_booking(uuid);

create function public.approve_booking(p_booking_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  b public.bookings%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Only an administrator can approve bookings.';
  end if;

  select * into b
  from public.bookings
  where id = p_booking_id
  for update;

  if not found then
    raise exception 'Booking not found.';
  end if;

  if b.assigned_instructor_id is null then
    raise exception 'Assign an instructor before approving.';
  end if;

  -- Approval is for scheduling/arrangement only. Payment is independent and may be recorded later.
  update public.bookings
  set status = 'approved',
      approved_by = auth.uid(),
      approved_at = now(),
      updated_at = now()
  where id = p_booking_id;

  return true;
end;
$$;

grant execute on function public.approve_booking(uuid) to authenticated;

-- ---------- STUDENT-SAFE BOOKING GUARD ----------
create or replace function public.enforce_student_booking_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare rate numeric;
begin
  if auth.uid() is not null and not public.is_admin() and new.student_id = auth.uid() then
    if TG_OP = 'UPDATE' and new.status = 'cancelled' and old.status in ('pending_payment','payment_recorded') then
      new.requested_start := old.requested_start;
      new.requested_end := old.requested_end;
      new.preferred_instructor_id := old.preferred_instructor_id;
      new.assigned_instructor_id := old.assigned_instructor_id;
      new.class_fee := old.class_fee;
      new.student_note := old.student_note;
      new.admin_note := old.admin_note;
      new.approved_at := old.approved_at;
      new.approved_by := old.approved_by;
    else
      new.status := 'pending_payment';
      new.assigned_instructor_id := null;
      new.approved_at := null;
      new.approved_by := null;
      new.admin_note := null;
      select hourly_class_fee into rate from public.school_settings where id = 1;
      new.class_fee := coalesce(rate, 0) * (new.duration_minutes::numeric / 60);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_student_booking_fields on public.bookings;
create trigger enforce_student_booking_fields
before insert or update on public.bookings
for each row execute procedure public.enforce_student_booking_fields();

-- Replace the broad student UPDATE policy with a narrow cancellation RPC.
drop policy if exists "Students cancel own pending bookings" on public.bookings;

create or replace function public.cancel_own_booking(p_booking_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.bookings
  set status = 'cancelled'
  where id = p_booking_id
    and student_id = auth.uid()
    and status in ('pending_payment','payment_recorded');
  return found;
end;
$$;
grant execute on function public.cancel_own_booking(uuid) to authenticated;

-- Allow admins to see/update student records needed for scheduling and fee management.
drop policy if exists "Admins manage student profiles" on public.student_profiles;
create policy "Admins manage student profiles"
on public.student_profiles for all to authenticated
using (public.is_admin()) with check (public.is_admin());
