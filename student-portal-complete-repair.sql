-- RAJU DRIVING SCHOOL — COMPLETE STUDENT PORTAL / BOOKING REPAIR
-- Run once in Supabase SQL Editor.
-- Fixes profile editing, booking slots, booking RPCs, admin fee relationships,
-- and adds student learning + mock-test history storage.

-- 1) Profile fields / flexible licence-category values
alter table public.student_profiles
  add column if not exists date_of_birth date,
  add column if not exists blood_group text,
  add column if not exists address text,
  add column if not exists pincode text,
  add column if not exists applying_for text,
  add column if not exists total_course_fee numeric(10,2) not null default 0;

alter table public.student_profiles drop constraint if exists student_profiles_blood_group_check;
alter table public.student_profiles
  add constraint student_profiles_blood_group_check
  check (blood_group is null or blood_group in ('A+','A-','B+','B-','AB+','AB-','O+','O-'));

alter table public.student_profiles drop constraint if exists student_profiles_applying_for_check;
alter table public.student_profiles
  add constraint student_profiles_applying_for_check
  check (applying_for is null or applying_for in (
    'LMV+M/cy','LMV only','M/cy only',
    'Car','Two Wheeler','Car + Two Wheeler','Heavy Vehicle','Other'
  ));

-- 2) Make direct student-profile relationships available to PostgREST.
-- Existing booking/payment rows are backfilled first if their profile row is missing.
insert into public.student_profiles (id, full_name, email)
select distinct x.student_id,
       coalesce(u.raw_user_meta_data->>'full_name', u.email, 'Student'),
       u.email
from (
  select student_id from public.bookings
  union
  select student_id from public.fee_payments
) x
join auth.users u on u.id = x.student_id
left join public.student_profiles sp on sp.id = x.student_id
where sp.id is null
on conflict (id) do nothing;

alter table public.bookings drop constraint if exists bookings_student_profile_fkey;
alter table public.bookings
  add constraint bookings_student_profile_fkey
  foreign key (student_id) references public.student_profiles(id) on delete cascade;

alter table public.fee_payments drop constraint if exists fee_payments_student_profile_fkey;
alter table public.fee_payments
  add constraint fee_payments_student_profile_fkey
  foreign key (student_id) references public.student_profiles(id) on delete cascade;

-- 3) Student learning progress
create table if not exists public.student_learning_progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  content_type text not null check (content_type in ('lesson','video')),
  content_key text not null,
  title text not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(student_id, content_type, content_key)
);

alter table public.student_learning_progress enable row level security;
drop policy if exists "Students manage own learning progress" on public.student_learning_progress;
create policy "Students manage own learning progress"
on public.student_learning_progress for all to authenticated
using (student_id = auth.uid()) with check (student_id = auth.uid());

-- 4) Mock-test attempt history
create table if not exists public.student_mock_test_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  language text not null default 'english' check (language in ('english','malayalam')),
  score integer not null check (score >= 0),
  total_questions integer not null default 30 check (total_questions > 0),
  pass_mark integer not null default 18 check (pass_mark >= 0),
  passed boolean not null,
  answers jsonb,
  attempted_at timestamptz not null default now()
);

alter table public.student_mock_test_attempts enable row level security;
drop policy if exists "Students view own mock attempts" on public.student_mock_test_attempts;
create policy "Students view own mock attempts"
on public.student_mock_test_attempts for select to authenticated
using (student_id = auth.uid());
drop policy if exists "Students create own mock attempts" on public.student_mock_test_attempts;
create policy "Students create own mock attempts"
on public.student_mock_test_attempts for insert to authenticated
with check (student_id = auth.uid());

create index if not exists student_learning_progress_student_idx
  on public.student_learning_progress(student_id, content_type);
create index if not exists student_mock_test_attempts_student_idx
  on public.student_mock_test_attempts(student_id, attempted_at desc);

-- 5) Repair booking-slot RPC. The old version used `bk` both as a record
-- variable and a SQL alias, which caused "record bk is not assigned yet".
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
  booking_hit record;
  student_hit record;
  block_hit record;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if not exists (select 1 from public.instructors i where i.id = p_instructor_id and i.active = true) then
    raise exception 'Instructor not found.';
  end if;

  day_start := (p_date::text || ' 08:00:00')::timestamp at time zone tz;

  for i in 0..10 loop
    slot := day_start + make_interval(hours => i);
    slot_start := slot;
    slot_end := slot + interval '1 hour';
    status := 'available';
    is_mine := false;
    booking_hit := null;
    student_hit := null;
    block_hit := null;

    -- First protect the instructor's own timetable.
    select b.id, (b.student_id = auth.uid()) as mine
      into booking_hit
    from public.bookings b
    where b.assigned_instructor_id = p_instructor_id
      and b.status in ('pending_payment','payment_recorded','approved','completed')
      and tstzrange(b.requested_start,b.requested_end,'[)') && tstzrange(slot_start,slot_end,'[)')
    order by b.requested_start
    limit 1;

    if booking_hit.id is not null then
      status := case when booking_hit.mine then 'mine' else 'booked' end;
      is_mine := coalesce(booking_hit.mine,false);
    else
      -- A student cannot reserve the same time with a different instructor.
      select b.id into student_hit
      from public.bookings b
      where b.student_id = auth.uid()
        and b.status in ('pending_payment','payment_recorded','approved','completed')
        and tstzrange(b.requested_start,b.requested_end,'[)') && tstzrange(slot_start,slot_end,'[)')
      order by b.requested_start
      limit 1;

      if student_hit.id is not null then
        status := 'mine';
        is_mine := true;
      else
        select u.id into block_hit
        from public.instructor_unavailability u
        where u.instructor_id = p_instructor_id
          and tstzrange(u.start_at,u.end_at,'[)') && tstzrange(slot_start,slot_end,'[)')
        limit 1;
        if block_hit.id is not null then status := 'unavailable'; end if;
      end if;
    end if;

    return next;
  end loop;
end;
$$;

grant execute on function public.get_instructor_day_slots(uuid,date) to authenticated;

-- 5.5) Older installations may still have legacy booking columns marked NOT NULL.
-- The current calendar uses requested_start/requested_end and the instructor
-- assignment fields below, so legacy columns must be optional.
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

-- 5.75) Prevent one student from booking overlapping classes with different instructors.
-- The RPC check below gives a friendly message; this trigger also protects against
-- two simultaneous requests reaching the database at the same time.
create or replace function public.prevent_student_booking_overlap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.student_id is null or new.requested_start is null or new.requested_end is null
     or new.status not in ('pending_payment','payment_recorded','approved','completed') then
    return new;
  end if;

  -- Serialize booking attempts for the same student so concurrent requests cannot race.
  perform pg_advisory_xact_lock(hashtextextended(new.student_id::text, 0));

  if exists (
    select 1
    from public.bookings b
    where b.student_id = new.student_id
      and b.id <> new.id
      and b.status in ('pending_payment','payment_recorded','approved','completed')
      and tstzrange(b.requested_start,b.requested_end,'[)') && tstzrange(new.requested_start,new.requested_end,'[)')
  ) then
    raise exception 'You already have a driving class booked for part or all of this time. Please choose another time.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_student_booking_overlap on public.bookings;
create trigger trg_prevent_student_booking_overlap
before insert or update of student_id,requested_start,requested_end,status
on public.bookings
for each row execute function public.prevent_student_booking_overlap();

create index if not exists bookings_student_time_idx
  on public.bookings(student_id, requested_start, requested_end);

-- 6) Repair booking creation RPC. Validate the local Indian time, not UTC.
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
  tz text := 'Asia/Kolkata';
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if p_duration_minutes not in (60,120) then raise exception 'Class duration must be 1 or 2 hours.'; end if;
  if p_start <= now() then raise exception 'Please choose a future time.'; end if;

  if extract(minute from (p_start at time zone tz)) <> 0
     or extract(second from (p_start at time zone tz)) <> 0 then
    raise exception 'Classes must start on the hour.';
  end if;

  if extract(hour from (p_start at time zone tz)) < 8
     or extract(hour from (p_start at time zone tz)) >= 19 then
    raise exception 'Choose a class start time between 8:00 AM and 6:00 PM.';
  end if;

  p_end := p_start + make_interval(mins => p_duration_minutes);
  if (p_end at time zone tz)::time > time '19:00' then
    raise exception 'The selected class must finish by 7:00 PM.';
  end if;

  if not exists (select 1 from public.instructors i where i.id = p_instructor_id and i.active = true) then
    raise exception 'The selected instructor is not available.';
  end if;

  if exists (
    select 1 from public.instructor_unavailability u
    where u.instructor_id = p_instructor_id
      and tstzrange(u.start_at,u.end_at,'[)') && tstzrange(p_start,p_end,'[)')
  ) then raise exception 'The selected instructor is not available for that time.'; end if;

  if exists (
    select 1 from public.bookings b
    where b.student_id = auth.uid()
      and b.status in ('pending_payment','payment_recorded','approved','completed')
      and tstzrange(b.requested_start,b.requested_end,'[)') && tstzrange(p_start,p_end,'[)')
  ) then
    raise exception 'You already have a driving class booked for part or all of this time. Please choose another time.';
  end if;

  select hourly_class_fee into rate from public.school_settings where id = 1;

  insert into public.bookings (
    student_id,requested_start,requested_end,preferred_instructor_id,assigned_instructor_id,
    status,class_fee,student_note
  ) values (
    auth.uid(),p_start,p_end,p_instructor_id,p_instructor_id,
    'pending_payment',coalesce(rate,0)*(p_duration_minutes::numeric/60),nullif(trim(p_student_note),'')
  ) returning * into result;

  return result;
exception
  when exclusion_violation then
    raise exception 'That instructor is already booked for one or more of the selected hours. Please choose another slot.';
end;
$$;

grant execute on function public.create_booking_request(uuid,timestamptz,integer,text) to authenticated;

-- Keep the signup trigger compatible with the expanded profile fields.
create or replace function public.handle_new_student()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.student_profiles (
    id,full_name,phone,email,date_of_birth,blood_group,address,pincode,applying_for
  ) values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name','Student'),
    new.raw_user_meta_data->>'phone',
    new.email,
    nullif(new.raw_user_meta_data->>'date_of_birth','')::date,
    new.raw_user_meta_data->>'blood_group',
    new.raw_user_meta_data->>'address',
    new.raw_user_meta_data->>'pincode',
    new.raw_user_meta_data->>'applying_for'
  )
  on conflict (id) do update set
    full_name=excluded.full_name,phone=excluded.phone,email=excluded.email,
    date_of_birth=excluded.date_of_birth,blood_group=excluded.blood_group,
    address=excluded.address,pincode=excluded.pincode,applying_for=excluded.applying_for,
    updated_at=now();
  return new;
end;
$$;

-- Ask PostgREST to reload the relationship cache.
notify pgrst, 'reload schema';

select 'Raju Driving School complete student portal repair installed successfully. Student overlapping bookings are now blocked.' as message;

-- 8) Admin read access for the student detail dashboard.
alter table public.student_learning_progress enable row level security;
drop policy if exists "Admins view all learning progress" on public.student_learning_progress;
create policy "Admins view all learning progress"
on public.student_learning_progress for select to authenticated
using (public.is_admin());

alter table public.student_mock_test_attempts enable row level security;
drop policy if exists "Admins view all mock attempts" on public.student_mock_test_attempts;
create policy "Admins view all mock attempts"
on public.student_mock_test_attempts for select to authenticated
using (public.is_admin());

notify pgrst, 'reload schema';
