-- RAJU DRIVING SCHOOL - BOOKING CALENDAR REPAIR V7
-- Run this ONCE in Supabase SQL Editor after the previous booking repair.
-- Fixes the ambiguous `status` reference inside get_instructor_day_slots.
-- Also keeps the booking status set used by the website.

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
      from public.instructor_unavailability ub
      where ub.instructor_id = p_instructor_id
        and tstzrange(ub.start_at, ub.end_at, '[)')
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

-- Keep the status set compatible with the admin UI.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.bookings'::regclass
      and conname = 'bookings_status_check_calendar'
  ) then
    alter table public.bookings add constraint bookings_status_check_calendar
      check (status in ('pending_payment','payment_recorded','approved','completed','cancelled','rejected'));
  end if;
end $$;

select 'Raju Driving School V7 booking calendar repair completed successfully.' as message;
