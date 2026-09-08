-- RAJU DRIVING SCHOOL - CALENDAR BOOKING UPGRADE
-- Run AFTER booking-schema.sql / your current booking database SQL.
-- This adds a secure availability RPC and hard protection against double-booking.

-- Keep student-created bookings assigned to the instructor they selected.
create or replace function public.enforce_student_booking_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rate numeric;
  instructor_active boolean;
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
      if new.assigned_instructor_id is null then
        raise exception 'Please select an instructor.';
      end if;
      select active into instructor_active from public.instructors where id = new.assigned_instructor_id;
      if not coalesce(instructor_active, false) then
        raise exception 'The selected instructor is not available for booking.';
      end if;
      new.preferred_instructor_id := new.assigned_instructor_id;
      new.status := 'pending_payment';
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

-- Hard database-level protection against two bookings for one instructor at overlapping times.
alter table public.bookings drop constraint if exists bookings_no_instructor_overlap;
alter table public.bookings
  add constraint bookings_no_instructor_overlap
  exclude using gist (
    assigned_instructor_id with =,
    tstzrange(requested_start, requested_end, '[)') with &&
  ) where (
    assigned_instructor_id is not null
    and status in ('pending_payment','payment_recorded','approved','completed')
  );

-- Student-safe day availability. It exposes only slot state, never another student's identity.
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
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if not exists (select 1 from public.instructors where id = p_instructor_id and active = true) then
    raise exception 'Instructor not found.';
  end if;

  day_start := (p_date::text || ' 08:00:00')::timestamp at time zone tz;

  for i in 0..10 loop
    slot := day_start + make_interval(hours => i);
    slot_start := slot;
    slot_end := slot + interval '1 hour';
    status := 'available';
    is_mine := false;

    select true as found, (bk.student_id = auth.uid()) as mine into b
    from public.bookings bk
    where bk.assigned_instructor_id = p_instructor_id
      and bk.status in ('pending_payment','payment_recorded','approved','completed')
      and tstzrange(bk.requested_start, bk.requested_end, '[)') && tstzrange(slot_start, slot_end, '[)')
    order by bk.requested_start
    limit 1;

    if b.found then
      status := case when b.mine then 'mine' else 'booked' end;
      is_mine := b.mine;
    else
      select true as found into u
      from public.instructor_unavailability
      where instructor_id = p_instructor_id
        and tstzrange(start_at, end_at, '[)') && tstzrange(slot_start, slot_end, '[)')
      limit 1;
      if u.found then status := 'unavailable'; end if;
    end if;

    return next;
  end loop;
end;
$$;

grant execute on function public.get_instructor_day_slots(uuid,date) to authenticated;

-- Secure booking creation used by the student calendar.
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
  tz text := 'Asia/Kolkata';
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if p_duration_minutes not in (60,120) then raise exception 'Class duration must be 1 or 2 hours.'; end if;
  if p_start <= now() then raise exception 'Please choose a future time.'; end if;
  if extract(minute from (p_start at time zone tz)) <> 0
     or extract(second from (p_start at time zone tz)) <> 0 then raise exception 'Classes must start on the hour.'; end if;
  if extract(hour from (p_start at time zone 'Asia/Kolkata')) < 8 or extract(hour from (p_start at time zone 'Asia/Kolkata')) >= 19 then raise exception 'Choose a class start time between 8:00 AM and 6:00 PM.'; end if;
  p_end := p_start + make_interval(mins => p_duration_minutes);

  if not exists (select 1 from public.instructors where id = p_instructor_id and active = true) then
    raise exception 'The selected instructor is not available.';
  end if;

  if exists (
    select 1 from public.instructor_unavailability u
    where u.instructor_id = p_instructor_id
      and tstzrange(u.start_at,u.end_at,'[)') && tstzrange(p_start,p_end,'[)')
  ) then raise exception 'The selected instructor is not available for that time.'; end if;

  insert into public.bookings (
    student_id, requested_start, requested_end,
    preferred_instructor_id, assigned_instructor_id,
    status, class_fee, student_note
  ) values (
    auth.uid(), p_start, p_end,
    p_instructor_id, p_instructor_id,
    'pending_payment', 0, nullif(trim(p_student_note),'')
  ) returning * into result;

  return result;
exception
  when exclusion_violation then
    raise exception 'That instructor is already booked for one or more of the selected hours. Please choose another slot.';
end;
$$;

grant execute on function public.create_booking_request(uuid,timestamptz,integer,text) to authenticated;

select 'Calendar booking upgrade installed successfully.' as message;
