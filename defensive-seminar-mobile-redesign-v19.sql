-- Raju Driving School — Defensive Seminar v19 mobile redesign / registration upgrade
-- Run this after defensive-driving-seminar.sql (and v18 management migration, if installed).

-- Email is optional for seminar registration.
alter table public.seminar_registrations alter column email drop not null;

-- Keep duplicate protection for email when supplied; NULL emails are allowed.
drop index if exists public.seminar_event_email_unique;
create unique index seminar_event_email_unique
  on public.seminar_registrations(event_id, lower(email))
  where status <> 'cancelled' and nullif(trim(email),'') is not null;

create or replace function public.register_seminar_seat(
  p_event_id uuid,
  p_full_name text,
  p_phone text,
  p_email text,
  p_license_number text default null,
  p_date_of_birth date default null
) returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
  ev public.seminar_events%rowtype;
  existing public.seminar_registrations%rowtype;
  next_seat integer;
  new_id uuid;
  new_code text;
  clean_phone text;
  clean_email text;
begin
  select * into ev from public.seminar_events where id=p_event_id and is_active=true for update;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;

  -- The seminar is always capped at 90 seats.
  if ev.capacity <> 90 then ev.capacity := 90; end if;

  clean_phone := regexp_replace(coalesce(p_phone,''),'[^0-9]','','g');
  clean_email := nullif(lower(trim(coalesce(p_email,''))),'');

  if length(clean_phone) <> 10 then raise exception 'INVALID_PHONE'; end if;
  if coalesce(length(trim(p_full_name)),0) < 2 then raise exception 'INVALID_NAME'; end if;
  if clean_email is not null and position('@' in clean_email) < 2 then raise exception 'INVALID_EMAIL'; end if;

  select * into existing from public.seminar_registrations
   where event_id=p_event_id and status <> 'cancelled'
     and (phone=clean_phone or (clean_email is not null and lower(email)=clean_email))
   limit 1;
  if found then raise exception 'DUPLICATE'; end if;

  select count(*)::integer into next_seat
    from public.seminar_registrations
   where event_id=p_event_id and status <> 'cancelled';
  if next_seat >= ev.capacity then raise exception 'FULLY_BOOKED'; end if;

  next_seat := next_seat + 1;
  new_id := gen_random_uuid();
  new_code := 'RDS-DS-' || to_char(ev.event_date,'YYYYMMDD') || '-' || lpad(next_seat::text,2,'0');

  insert into public.seminar_registrations(
    id,event_id,booking_code,full_name,phone,email,license_number,date_of_birth,seat_number
  ) values (
    new_id,p_event_id,new_code,trim(p_full_name),clean_phone,clean_email,
    nullif(trim(p_license_number),''),p_date_of_birth,next_seat
  );

  return jsonb_build_object(
    'id',new_id,'booking_code',new_code,'full_name',trim(p_full_name),
    'phone',clean_phone,'email',clean_email,'seat_number',next_seat,
    'event_id',ev.id,'title',ev.title,'event_date',ev.event_date,
    'start_time',ev.start_time,'end_time',ev.end_time,'venue',ev.venue
  );
end;
$$;

grant execute on function public.register_seminar_seat(uuid,text,text,text,text,date) to anon,authenticated;
