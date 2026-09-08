-- RAJU DRIVING SCHOOL - FINAL BOOKING CALENDAR REPAIR
-- Run this ONCE in Supabase SQL Editor AFTER the booking tables exist.
-- This version does NOT use ON CONFLICT for the booking workflow and
-- matches the current bookings columns: requested_start/requested_end,
-- preferred_instructor_id/assigned_instructor_id, class_fee, etc.

create extension if not exists btree_gist;

-- 1) Make sure the five instructors exist without relying on ON CONFLICT.
insert into public.instructors (name, active)
select v.name, true
from (values
  ('Yashodaran'), ('Francis'), ('Ranjith'), ('Akhil'), ('Lissy')
) as v(name)
where not exists (
  select 1 from public.instructors i where lower(i.name) = lower(v.name)
);

-- 2) Ensure the supporting tables/columns exist.
-- If an older booking table is still present, its legacy columns are kept
-- for compatibility but made optional so the new calendar can insert rows.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bookings' AND column_name='instructor_id') THEN
    ALTER TABLE public.bookings ALTER COLUMN instructor_id DROP NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bookings' AND column_name='start_at') THEN
    ALTER TABLE public.bookings ALTER COLUMN start_at DROP NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bookings' AND column_name='end_at') THEN
    ALTER TABLE public.bookings ALTER COLUMN end_at DROP NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bookings' AND column_name='fee_amount') THEN
    ALTER TABLE public.bookings ALTER COLUMN fee_amount DROP NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bookings' AND column_name='notes') THEN
    ALTER TABLE public.bookings ALTER COLUMN notes DROP NOT NULL;
  END IF;
END $$;

alter table public.bookings add column if not exists requested_start timestamptz;
alter table public.bookings add column if not exists requested_end timestamptz;
alter table public.bookings add column if not exists preferred_instructor_id uuid references public.instructors(id) on delete set null;
alter table public.bookings add column if not exists assigned_instructor_id uuid references public.instructors(id) on delete set null;
alter table public.bookings add column if not exists class_fee numeric(10,2) not null default 0;
alter table public.bookings add column if not exists student_note text;
alter table public.bookings add column if not exists admin_note text;
alter table public.bookings add column if not exists approved_at timestamptz;
alter table public.bookings add column if not exists approved_by uuid references auth.users(id) on delete set null;
alter table public.bookings add column if not exists updated_at timestamptz not null default now();

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

create table if not exists public.school_settings (
  id integer primary key default 1 check (id = 1),
  hourly_class_fee numeric(10,2) not null default 0 check (hourly_class_fee >= 0),
  updated_at timestamptz not null default now()
);

-- Insert the singleton settings row safely without ON CONFLICT.
insert into public.school_settings (id, hourly_class_fee)
select 1, 0
where not exists (select 1 from public.school_settings where id = 1);

-- Remove legacy status checks that may reject the new workflow.
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.bookings'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.bookings DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.bookings'::regclass
      AND conname='bookings_status_check_calendar'
  ) THEN
    ALTER TABLE public.bookings ADD CONSTRAINT bookings_status_check_calendar
      CHECK (status IN ('pending_payment','payment_recorded','approved','completed','cancelled','rejected'));
  END IF;
END $$;

-- 3) Keep the instructor overlap exclusion constraint already installed.
--    If it somehow does not exist, create it.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.bookings'::regclass
      and conname = 'bookings_no_instructor_overlap'
  ) then
    alter table public.bookings
      add constraint bookings_no_instructor_overlap
      exclude using gist (
        assigned_instructor_id with =,
        tstzrange(requested_start, requested_end, '[)') with &&
      ) where (
        assigned_instructor_id is not null
        and requested_start is not null
        and requested_end is not null
        and status in ('pending_payment','payment_recorded','approved','completed')
      );
  end if;
end $$;

-- 4) Student-safe calendar RPC.
--    Returns only slot state: available/booked/unavailable/mine.
create or replace function public.get_instructor_day_slots(
  p_instructor_id uuid,
  p_date date
)
returns table (
  slot_start timestamptz,
  slot_end timestamptz,
  status text,
  is_mine boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  tz text := 'Asia/Kolkata';
  day_start timestamptz;
  slot timestamptz;
  b record;
  u record;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if not exists (
    select 1 from public.instructors
    where id = p_instructor_id and active = true
  ) then
    raise exception 'Instructor not found.';
  end if;

  -- 08:00 through 18:00 starts. A class may end at 19:00.
  day_start := (p_date::text || ' 08:00:00')::timestamp at time zone tz;

  for i in 0..10 loop
    slot := day_start + make_interval(hours => i);
    slot_start := slot;
    slot_end := slot + interval '1 hour';
    status := 'available';
    is_mine := false;

    select true as found, (bk.student_id = auth.uid()) as mine
    into b
    from public.bookings bk
    where bk.assigned_instructor_id = p_instructor_id
      and bk.status in ('pending_payment','payment_recorded','approved','completed')
      and bk.requested_start is not null
      and bk.requested_end is not null
      and tstzrange(bk.requested_start, bk.requested_end, '[)')
          && tstzrange(slot_start, slot_end, '[)')
    order by bk.requested_start
    limit 1;

    if coalesce(b.found, false) then
      status := case when b.mine then 'mine' else 'booked' end;
      is_mine := coalesce(b.mine, false);
    else
      select true as found
      into u
      from public.instructor_unavailability
      where instructor_id = p_instructor_id
        and tstzrange(start_at, end_at, '[)')
            && tstzrange(slot_start, slot_end, '[)')
      limit 1;

      if coalesce(u.found, false) then
        status := 'unavailable';
      end if;
    end if;

    return next;
  end loop;
end;
$$;

grant execute on function public.get_instructor_day_slots(uuid,date) to authenticated;

-- 5) Secure student booking RPC.
--    The database itself checks instructor availability and overlap.
create or replace function public.create_booking_request(
  p_instructor_id uuid,
  p_start timestamptz,
  p_duration_minutes integer,
  p_student_note text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.bookings;
  p_end timestamptz;
  rate numeric;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if p_duration_minutes not in (60,120) then
    raise exception 'Class duration must be 1 or 2 hours.';
  end if;

  if p_start <= now() then
    raise exception 'Please choose a future time.';
  end if;

  if extract(minute from (p_start at time zone tz)) <> 0
     or extract(second from (p_start at time zone tz)) <> 0 then
    raise exception 'Classes must start on the hour.';
  end if;

  -- India time: class starts 08:00 through 18:00; latest class ends 19:00.
  if extract(hour from (p_start at time zone 'Asia/Kolkata')) < 8
     or extract(hour from (p_start at time zone 'Asia/Kolkata')) >= 19 then
    raise exception 'Choose a class start time between 8:00 AM and 6:00 PM.';
  end if;

  p_end := p_start + make_interval(mins => p_duration_minutes);

  if extract(hour from (p_end at time zone 'Asia/Kolkata')) > 19
     or (extract(hour from (p_end at time zone 'Asia/Kolkata')) = 19
         and extract(minute from (p_end at time zone 'Asia/Kolkata')) > 0) then
    raise exception 'The selected class must finish by 7:00 PM.';
  end if;

  if not exists (
    select 1 from public.instructors
    where id = p_instructor_id and active = true
  ) then
    raise exception 'The selected instructor is not available.';
  end if;

  if exists (
    select 1 from public.instructor_unavailability u
    where u.instructor_id = p_instructor_id
      and tstzrange(u.start_at,u.end_at,'[)')
          && tstzrange(p_start,p_end,'[)')
  ) then
    raise exception 'The selected instructor is not available for that time.';
  end if;

  select hourly_class_fee into rate
  from public.school_settings
  where id = 1;

  insert into public.bookings (
    student_id,
    requested_start,
    requested_end,
    preferred_instructor_id,
    assigned_instructor_id,
    status,
    class_fee,
    student_note
  ) values (
    auth.uid(),
    p_start,
    p_end,
    p_instructor_id,
    p_instructor_id,
    'pending_payment',
    coalesce(rate,0) * (p_duration_minutes::numeric / 60),
    nullif(trim(p_student_note),'')
  ) returning * into result;

  return result;
exception
  when exclusion_violation then
    raise exception 'That instructor is already booked for one or more of the selected hours. Please choose another slot.';
end;
$$;

grant execute on function public.create_booking_request(uuid,timestamptz,integer,text) to authenticated;

-- 6) Robust admin approval: instructor assigned AND full booking fee recorded.
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

  if coalesce(b.class_fee,0) <= 0 then
    raise exception 'Set the class fee before approving.';
  end if;

  select coalesce(sum(amount),0) into paid
  from public.fee_payments
  where booking_id = p_booking_id;

  if paid < b.class_fee then
    raise exception 'Full class fee must be recorded before approval.';
  end if;

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

-- 7) RLS required by the website.
alter table public.instructors enable row level security;
alter table public.bookings enable row level security;
alter table public.instructor_unavailability enable row level security;
alter table public.fee_payments enable row level security;
alter table public.school_settings enable row level security;

drop policy if exists "Authenticated users can view instructors" on public.instructors;
create policy "Authenticated users can view instructors"
on public.instructors for select to authenticated using (true);

drop policy if exists "Students view own bookings" on public.bookings;
create policy "Students view own bookings"
on public.bookings for select to authenticated
using (student_id = auth.uid() or public.is_admin());

drop policy if exists "Students create booking requests" on public.bookings;
create policy "Students create booking requests"
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

drop policy if exists "Authenticated users view instructor unavailability" on public.instructor_unavailability;
create policy "Authenticated users view instructor unavailability"
on public.instructor_unavailability for select to authenticated using (true);

drop policy if exists "Admins manage instructor unavailability" on public.instructor_unavailability;
create policy "Admins manage instructor unavailability"
on public.instructor_unavailability for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Students view own fee payments" on public.fee_payments;
create policy "Students view own fee payments"
on public.fee_payments for select to authenticated
using (student_id = auth.uid() or public.is_admin());

drop policy if exists "Admins manage fee payments" on public.fee_payments;
create policy "Admins manage fee payments"
on public.fee_payments for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Authenticated users view school settings" on public.school_settings;
create policy "Authenticated users view school settings"
on public.school_settings for select to authenticated using (true);

drop policy if exists "Admins manage school settings" on public.school_settings;
create policy "Admins manage school settings"
on public.school_settings for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- Admins can manage student registration details/fees.
drop policy if exists "Admins manage student profiles" on public.student_profiles;
create policy "Admins manage student profiles"
on public.student_profiles for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- 8) Useful indexes.
create index if not exists bookings_student_calendar_idx
  on public.bookings(student_id, requested_start desc);
create index if not exists bookings_instructor_calendar_idx
  on public.bookings(assigned_instructor_id, requested_start);
create index if not exists bookings_status_calendar_idx
  on public.bookings(status, requested_start);
create index if not exists instructor_unavailability_calendar_idx
  on public.instructor_unavailability(instructor_id, start_at);
create index if not exists fee_payments_student_calendar_idx
  on public.fee_payments(student_id, paid_on desc);

select 'Raju Driving School booking calendar repair completed successfully.' as message;
