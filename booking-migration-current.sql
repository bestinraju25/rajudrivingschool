-- RAJU DRIVING SCHOOL - Current database patch
-- Run this AFTER the booking system SQL that already succeeded.
-- This aligns the database with the website booking/admin screens.

-- Students can request a time without choosing an instructor.
alter table public.bookings
  alter column instructor_id drop not null;

-- Keep a preferred instructor separate from the instructor finally assigned by admin.
alter table public.bookings
  add column if not exists preferred_instructor_id uuid references public.instructors(id) on delete set null;

alter table public.bookings
  add column if not exists student_note text;

-- A simple school-wide hourly rate used for new bookings.
create table if not exists public.school_settings (
  id integer primary key default 1 check (id = 1),
  hourly_class_fee numeric(10,2) not null default 0 check (hourly_class_fee >= 0),
  updated_at timestamptz not null default now()
);

insert into public.school_settings (id, hourly_class_fee)
values (1, 0)
on conflict (id) do nothing;

alter table public.school_settings enable row level security;

drop policy if exists "Admins manage school settings" on public.school_settings;
create policy "Admins manage school settings"
on public.school_settings
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Authenticated users view school settings" on public.school_settings;
create policy "Authenticated users view school settings"
on public.school_settings
for select to authenticated
using (true);

-- Make sure the admin can read/update student profiles, including course fees.
drop policy if exists "Admins manage student profiles" on public.student_profiles;
create policy "Admins manage student profiles"
on public.student_profiles
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Students need to see instructor availability/blocked periods.
drop policy if exists "Authenticated users view instructor availability" on public.instructor_availability;
create policy "Authenticated users view instructor availability"
on public.instructor_availability
for select to authenticated
using (true);

-- Admins can manage availability.
drop policy if exists "Admins manage instructor availability" on public.instructor_availability;
create policy "Admins manage instructor availability"
on public.instructor_availability
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Students can create only their own booking requests.
drop policy if exists "Students create own bookings" on public.bookings;
drop policy if exists "Students create booking requests" on public.bookings;
create policy "Students create booking requests"
on public.bookings
for insert to authenticated
with check (student_id = auth.uid());

-- Students can view their own bookings.
drop policy if exists "Students view own bookings" on public.bookings;
create policy "Students view own bookings"
on public.bookings
for select to authenticated
using (student_id = auth.uid() or public.is_admin());

-- Students may cancel only their own pending requests.
drop policy if exists "Students cancel own bookings" on public.bookings;
drop policy if exists "Students cancel own pending bookings" on public.bookings;
create policy "Students cancel own pending bookings"
on public.bookings
for update to authenticated
using (student_id = auth.uid() and status = 'pending')
with check (student_id = auth.uid() and status = 'cancelled');

-- Admins manage bookings.
drop policy if exists "Admins manage bookings" on public.bookings;
create policy "Admins manage bookings"
on public.bookings
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Add a robust admin approval function: assignment + full booking fee required.
create or replace function public.approve_booking(p_booking_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  b public.bookings%rowtype;
  paid numeric(10,2);
begin
  if not public.is_admin() then
    raise exception 'Only an administrator can approve bookings.';
  end if;

  select * into b from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found.';
  end if;

  if b.instructor_id is null then
    raise exception 'Assign an instructor before approving.';
  end if;

  select coalesce(sum(amount),0) into paid
  from public.student_payments
  where booking_id = p_booking_id;

  if paid < b.fee_amount then
    raise exception 'Full class fee must be recorded before approval.';
  end if;

  update public.bookings
  set status = 'approved', approved_by = auth.uid(), approved_at = now(), updated_at = now()
  where id = p_booking_id;

  return true;
end;
$$;

grant execute on function public.approve_booking(uuid) to authenticated;

select 'Current booking website database patch applied successfully.' as message;
