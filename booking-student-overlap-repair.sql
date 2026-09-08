-- RAJU DRIVING SCHOOL — STUDENT OVERLAP / BOOKING INBOX REPAIR
-- The complete student portal repair SQL already contains this migration.
-- Use this smaller file only if you have already installed the complete repair.

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
  perform pg_advisory_xact_lock(hashtextextended(new.student_id::text, 0));
  if exists (
    select 1 from public.bookings b
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

notify pgrst, 'reload schema';
select 'Student overlapping booking protection installed successfully.' as message;
