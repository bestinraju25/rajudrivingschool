-- RAJU DRIVING SCHOOL - BOOKING CALENDAR FINAL REPAIR
-- Run this ONCE in Supabase SQL Editor.
-- Fixes: calendar status ambiguity + India timezone half-hour validation + booking creation.

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
  bk record;
  ub record;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if not exists (
    select 1 from public.instructors i
    where i.id = p_instructor_id and i.active = true
  ) then
    raise exception 'Instructor not found.';
  end if;

  day_start := (p_date::text || ' 08:00:00')::timestamp at time zone tz;

  for i in 0..10 loop
    slot := day_start + make_interval(hours => i);
    slot_start := slot;
    slot_end := slot + interval '1 hour';
    status := 'available';
    is_mine := false;

    select true as found, (bk.student_id = auth.uid()) as mine
    into bk
    from public.bookings bk
    where bk.assigned_instructor_id = p_instructor_id
      and bk.status in ('pending_payment','payment_recorded','approved','completed')
      and bk.requested_start is not null
      and bk.requested_end is not null
      and tstzrange(bk.requested_start, bk.requested_end, '[)')
          && tstzrange(slot_start, slot_end, '[)')
    order by bk.requested_start
    limit 1;

    if coalesce(bk.found, false) then
      status := case when bk.mine then 'mine' else 'booked' end;
      is_mine := coalesce(bk.mine, false);
    else
      select true as found
      into ub
      from public.instructor_unavailability ub
      where ub.instructor_id = p_instructor_id
        and tstzrange(ub.start_at, ub.end_at, '[)')
            && tstzrange(slot_start, slot_end, '[)')
      limit 1;

      if coalesce(ub.found, false) then
        status := 'unavailable';
      end if;
    end if;

    return next;
  end loop;
end;
$$;

grant execute on function public.get_instructor_day_slots(uuid,date) to authenticated;

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
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if p_duration_minutes not in (60,120) then
    raise exception 'Class duration must be 1 or 2 hours.';
  end if;

  if p_start <= now() then
    raise exception 'Please choose a future time.';
  end if;

  -- IMPORTANT: validate the displayed India time, not UTC. India is UTC+05:30.
  if extract(minute from (p_start at time zone tz)) <> 0
     or extract(second from (p_start at time zone tz)) <> 0 then
    raise exception 'Classes must start on the hour.';
  end if;

  if extract(hour from (p_start at time zone tz)) < 8
     or extract(hour from (p_start at time zone tz)) >= 19 then
    raise exception 'Choose a class start time between 8:00 AM and 6:00 PM.';
  end if;

  p_end := p_start + make_interval(mins => p_duration_minutes);

  if extract(hour from (p_end at time zone tz)) > 19
     or (extract(hour from (p_end at time zone tz)) = 19
         and extract(minute from (p_end at time zone tz)) > 0) then
    raise exception 'The selected class must finish by 7:00 PM.';
  end if;

  if not exists (
    select 1 from public.instructors i
    where i.id = p_instructor_id and i.active = true
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
    student_id, requested_start, requested_end, preferred_instructor_id,
    assigned_instructor_id, status, class_fee, student_note
  ) values (
    auth.uid(), p_start, p_end, p_instructor_id, p_instructor_id,
    'pending_payment', coalesce(rate,0) * (p_duration_minutes::numeric / 60),
    nullif(trim(p_student_note),'')
  ) returning * into result;

  return result;
exception
  when exclusion_violation then
    raise exception 'That instructor is already booked for one or more of the selected hours. Please choose another slot.';
end;
$$;

grant execute on function public.create_booking_request(uuid,timestamptz,integer,text) to authenticated;

select 'Raju Driving School booking calendar FINAL repair completed successfully.' as message;
