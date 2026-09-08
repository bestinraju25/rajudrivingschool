-- RAJU DRIVING SCHOOL — ADMIN APPROVAL / PAYMENT-INDEPENDENT REPAIR
-- Approval only confirms the scheduled time and assigned instructor.
-- Students may book whether payment has been made or not. Payment can be recorded separately.

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

  select * into b from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'Booking not found.'; end if;

  if b.assigned_instructor_id is null then
    raise exception 'Assign an instructor before approving.';
  end if;

  update public.bookings
  set status='approved', approved_by=auth.uid(), approved_at=now(), updated_at=now()
  where id=p_booking_id;

  return true;
end;
$$;

grant execute on function public.approve_booking(uuid) to authenticated;

notify pgrst, 'reload schema';
select 'Admin approval is now independent of payment.' as message;
