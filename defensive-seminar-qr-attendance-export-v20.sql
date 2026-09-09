-- Raju Driving School — QR attendance + export support (v20)
-- Run after the existing defensive seminar SQL/migrations.

create or replace function public.checkin_seminar_qr(
  p_qr_text text
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  parts text[];
  qr_prefix text;
  qr_code text;
  qr_seat integer;
  r public.seminar_registrations%rowtype;
  e public.seminar_events%rowtype;
begin
  if not public.is_admin() then
    raise exception 'NOT_ADMIN';
  end if;

  parts := string_to_array(trim(coalesce(p_qr_text,'')), '|');
  qr_prefix := trim(coalesce(parts[1],''));
  qr_code := upper(trim(coalesce(parts[2],'')));
  qr_seat := case when coalesce(parts[3],'') ~ '^\d+$' then parts[3]::integer else null end;

  if qr_prefix <> 'RDS-SEMINAR' or qr_code = '' then
    raise exception 'INVALID_QR';
  end if;

  select * into r
  from public.seminar_registrations
  where booking_code = qr_code
  limit 1
  for update;

  if not found then raise exception 'NOT_FOUND'; end if;

  select * into e from public.seminar_events where id=r.event_id;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;

  if qr_seat is not null and qr_seat <> r.seat_number then
    raise exception 'WRONG_SEAT';
  end if;

  if r.status = 'cancelled' then raise exception 'CANCELLED'; end if;

  if r.status = 'attended' then
    return jsonb_build_object(
      'already_attended', true,
      'id', r.id,
      'booking_code', r.booking_code,
      'full_name', r.full_name,
      'seat_number', r.seat_number,
      'attended_at', r.attended_at,
      'event_id', r.event_id,
      'event_date', e.event_date
    );
  end if;

  update public.seminar_registrations
  set status='attended', attended_at=now()
  where id=r.id;

  return jsonb_build_object(
    'already_attended', false,
    'id', r.id,
    'booking_code', r.booking_code,
    'full_name', r.full_name,
    'phone', r.phone,
    'seat_number', r.seat_number,
    'attended_at', now(),
    'event_id', r.event_id,
    'event_date', e.event_date,
    'title', e.title,
    'venue', e.venue
  );
end;
$$;

revoke all on function public.checkin_seminar_qr(text) from public;
grant execute on function public.checkin_seminar_qr(text) to authenticated;

-- Exports are generated in the admin browser as Excel-compatible UTF-8 CSV files.
-- No additional database table is required.
