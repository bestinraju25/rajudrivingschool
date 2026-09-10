-- Raju Driving School — Defensive Seminar v50
-- Admin-only direct participant admission.
-- Run once in Supabase SQL Editor after the existing seminar schema/migrations.
-- Students added through this function are immediately marked as attended.

create or replace function public.add_manual_seminar_participant(
  p_event_id uuid,
  p_full_name text,
  p_phone text
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  ev public.seminar_events%rowtype;
  existing public.seminar_registrations%rowtype;
  normalized_phone text := regexp_replace(coalesce(p_phone,''),'[^0-9]','','g');
  next_seat integer;
  new_id uuid;
  new_code text;
  code_suffix text;
begin
  if not public.is_admin() then
    raise exception 'NOT_ADMIN';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_event_id::text, 0));

  select * into ev
  from public.seminar_events
  where id=p_event_id
  for update;

  if not found then raise exception 'SESSION_NOT_FOUND'; end if;
  if length(normalized_phone) <> 10 then raise exception 'INVALID_PHONE'; end if;
  if coalesce(length(trim(p_full_name)),0) < 2 then raise exception 'INVALID_NAME'; end if;

  select * into existing
  from public.seminar_registrations
  where phone=normalized_phone
    and status <> 'cancelled'
  order by registered_at desc
  limit 1;
  if found then raise exception 'DUPLICATE_PHONE'; end if;

  select min(s)::integer into next_seat
  from generate_series(1, least(coalesce(ev.capacity,90),90)) s
  where not exists (
    select 1
    from public.seminar_registrations r
    where r.event_id=p_event_id
      and r.seat_number=s
      and r.status <> 'cancelled'
  );

  if next_seat is null then raise exception 'FULLY_BOOKED'; end if;

  new_id := gen_random_uuid();
  loop
    code_suffix := upper(substr(md5(new_id::text || clock_timestamp()::text || random()::text),1,8));
    new_code := 'RDS-DS-' || to_char(ev.event_date,'YYYYMMDD') || '-' ||
                lpad(next_seat::text,2,'0') || '-' || code_suffix;
    exit when not exists (
      select 1 from public.seminar_registrations r where r.booking_code=new_code
    );
  end loop;

  insert into public.seminar_registrations(
    id,event_id,booking_code,full_name,phone,email,license_number,date_of_birth,seat_number,status,attended_at
  ) values (
    new_id,p_event_id,new_code,trim(p_full_name),normalized_phone,null,null,null,next_seat,'attended',now()
  );

  return jsonb_build_object(
    'id',new_id,
    'booking_code',new_code,
    'full_name',trim(p_full_name),
    'phone',normalized_phone,
    'seat_number',next_seat,
    'status','attended',
    'attended_at',now(),
    'event_id',ev.id,
    'event_date',ev.event_date,
    'start_time',ev.start_time,
    'end_time',ev.end_time,
    'venue',ev.venue,
    'title',ev.title
  );
end;
$$;

revoke all on function public.add_manual_seminar_participant(uuid,text,text) from public;
grant execute on function public.add_manual_seminar_participant(uuid,text,text) to authenticated;
