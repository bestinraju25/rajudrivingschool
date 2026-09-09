-- Raju Driving School — Defensive Driving Seminar v25
-- Booking reliability repair: email is truly optional and Name + Mobile is sufficient.
-- Also recreates the booking RPC so a website deployment cannot accidentally point at an older function.

alter table public.seminar_registrations
  alter column email drop not null;

create index if not exists seminar_reg_phone_idx
  on public.seminar_registrations(phone);

create unique index if not exists seminar_active_phone_unique
  on public.seminar_registrations(phone)
  where status <> 'cancelled';

create unique index if not exists seminar_event_email_unique
  on public.seminar_registrations(event_id, lower(email))
  where status <> 'cancelled' and nullif(trim(email),'') is not null;

create or replace function public.register_seminar_seat(
  p_event_id uuid,
  p_full_name text,
  p_phone text,
  p_email text default null,
  p_license_number text default null,
  p_date_of_birth date default null
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  ev public.seminar_events%rowtype;
  existing public.seminar_registrations%rowtype;
  normalized_phone text := regexp_replace(coalesce(p_phone,''),'[^0-9]','','g');
  normalized_email text := nullif(lower(trim(coalesce(p_email,''))), '');
  next_seat integer;
  new_id uuid;
  new_code text;
begin
  perform pg_advisory_xact_lock(hashtextextended(normalized_phone, 0));

  select * into ev
  from public.seminar_events
  where id=p_event_id and is_active=true
  for update;

  if not found then raise exception 'SESSION_NOT_FOUND'; end if;
  if length(normalized_phone) <> 10 then raise exception 'INVALID_PHONE'; end if;
  if coalesce(length(trim(p_full_name)),0) < 2 then raise exception 'INVALID_NAME'; end if;
  if normalized_email is not null and position('@' in normalized_email) < 2 then raise exception 'INVALID_EMAIL'; end if;

  select * into existing
  from public.seminar_registrations
  where phone=normalized_phone and status <> 'cancelled'
  order by registered_at desc limit 1;
  if found then raise exception 'DUPLICATE_PHONE'; end if;

  if normalized_email is not null then
    select * into existing
    from public.seminar_registrations
    where lower(email)=normalized_email and status <> 'cancelled'
    order by registered_at desc limit 1;
    if found then raise exception 'DUPLICATE'; end if;
  end if;

  select min(s)::integer into next_seat
  from generate_series(1, least(coalesce(ev.capacity,90),90)) s
  where not exists (
    select 1 from public.seminar_registrations r
    where r.event_id=p_event_id
      and r.seat_number=s
      and r.status <> 'cancelled'
  );

  if next_seat is null then raise exception 'FULLY_BOOKED'; end if;

  new_id := gen_random_uuid();
  new_code := 'RDS-DS-' || to_char(ev.event_date,'YYYYMMDD') || '-' || lpad(next_seat::text,2,'0');

  insert into public.seminar_registrations(
    id,event_id,booking_code,full_name,phone,email,license_number,date_of_birth,seat_number
  ) values (
    new_id,p_event_id,new_code,trim(p_full_name),normalized_phone,normalized_email,
    nullif(trim(p_license_number),''),null,next_seat
  );

  return jsonb_build_object(
    'id',new_id,
    'booking_code',new_code,
    'full_name',trim(p_full_name),
    'phone',normalized_phone,
    'email',normalized_email,
    'seat_number',next_seat,
    'event_date',ev.event_date,
    'start_time',ev.start_time,
    'end_time',ev.end_time,
    'venue',ev.venue,
    'title',ev.title
  );
end;
$$;

grant execute on function public.register_seminar_seat(uuid,text,text,text,text,date)
to anon,authenticated;

-- Keep the public lookup/cancellation RPCs available with the same mobile-only workflow.
create or replace function public.lookup_seminar_bookings_by_phone(p_phone text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  normalized_phone text := regexp_replace(coalesce(p_phone,''),'[^0-9]','','g');
  result jsonb;
begin
  if length(normalized_phone) <> 10 then raise exception 'INVALID_PHONE'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',r.id,'booking_code',r.booking_code,'full_name',r.full_name,'phone',r.phone,'email',r.email,
    'seat_number',r.seat_number,'status',r.status,'registered_at',r.registered_at,'attended_at',r.attended_at,
    'event_id',e.id,'title',e.title,'event_date',e.event_date,'start_time',e.start_time,'end_time',e.end_time,'venue',e.venue
  ) order by e.event_date,e.start_time),'[]'::jsonb)
  into result
  from public.seminar_registrations r
  join public.seminar_events e on e.id=r.event_id
  where r.phone=normalized_phone and r.status <> 'cancelled';
  return result;
end;
$$;
grant execute on function public.lookup_seminar_bookings_by_phone(text) to anon,authenticated;
