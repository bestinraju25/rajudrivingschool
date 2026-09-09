-- Raju Driving School — Defensive Driving Seminar v22
-- Makes email truly optional at database level. Also keeps one active booking per mobile.

alter table public.seminar_registrations alter column email drop not null;

create index if not exists seminar_reg_phone_idx on public.seminar_registrations(phone);

-- Recreate booking RPC with optional email and no DOB requirement.
create or replace function public.register_seminar_seat(
  p_event_id uuid, p_full_name text, p_phone text, p_email text default null,
  p_license_number text default null, p_date_of_birth date default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  ev public.seminar_events%rowtype; existing public.seminar_registrations%rowtype;
  normalized_phone text := regexp_replace(coalesce(p_phone,''),'[^0-9]','','g');
  normalized_email text := nullif(lower(trim(coalesce(p_email,''))), '');
  next_seat integer; new_id uuid; new_code text;
begin
  perform pg_advisory_xact_lock(hashtextextended(normalized_phone, 0));
  select * into ev from public.seminar_events where id=p_event_id and is_active=true for update;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;
  if ev.capacity > 90 then ev.capacity := 90; end if;
  if length(normalized_phone) <> 10 then raise exception 'INVALID_PHONE'; end if;
  if coalesce(length(trim(p_full_name)),0) < 2 then raise exception 'INVALID_NAME'; end if;
  if normalized_email is not null and position('@' in normalized_email) < 2 then raise exception 'INVALID_EMAIL'; end if;
  select * into existing from public.seminar_registrations where phone=normalized_phone and status <> 'cancelled' order by registered_at desc limit 1;
  if found then raise exception 'DUPLICATE_PHONE'; end if;
  if normalized_email is not null then
    select * into existing from public.seminar_registrations where lower(email)=normalized_email and status <> 'cancelled' order by registered_at desc limit 1;
    if found then raise exception 'DUPLICATE'; end if;
  end if;
  select min(s)::integer into next_seat from generate_series(1,ev.capacity) s
  where not exists (select 1 from public.seminar_registrations r where r.event_id=p_event_id and r.seat_number=s and r.status <> 'cancelled');
  if next_seat is null then raise exception 'FULLY_BOOKED'; end if;
  new_id := gen_random_uuid();
  new_code := 'RDS-DS-' || to_char(ev.event_date,'YYYYMMDD') || '-' || lpad(next_seat::text,2,'0');
  insert into public.seminar_registrations(id,event_id,booking_code,full_name,phone,email,license_number,date_of_birth,seat_number)
  values(new_id,p_event_id,new_code,trim(p_full_name),normalized_phone,normalized_email,nullif(trim(p_license_number),''),null,next_seat);
  return jsonb_build_object('id',new_id,'booking_code',new_code,'full_name',trim(p_full_name),'phone',normalized_phone,'seat_number',next_seat,'event_date',ev.event_date,'start_time',ev.start_time,'end_time',ev.end_time,'venue',ev.venue,'title',ev.title);
end; $$;
grant execute on function public.register_seminar_seat(uuid,text,text,text,text,date) to anon,authenticated;

-- Mobile-only lookup. Returns non-cancelled bookings. Normally this is one record because
-- register_seminar_seat enforces one active booking per mobile number.
create or replace function public.lookup_seminar_bookings_by_phone(
  p_phone text
) returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
  normalized_phone text := regexp_replace(coalesce(p_phone,''),'[^0-9]','','g');
  result jsonb;
begin
  if length(normalized_phone) <> 10 then raise exception 'INVALID_PHONE'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',r.id,'booking_code',r.booking_code,'full_name',r.full_name,'phone',r.phone,'email',r.email,
    'seat_number',r.seat_number,'status',r.status,'registered_at',r.registered_at,
    'attended_at',r.attended_at,'event_id',e.id,'title',e.title,'event_date',e.event_date,
    'start_time',e.start_time,'end_time',e.end_time,'venue',e.venue
  ) order by e.event_date,e.start_time), '[]'::jsonb)
  into result
  from public.seminar_registrations r
  join public.seminar_events e on e.id=r.event_id
  where r.phone=normalized_phone and r.status <> 'cancelled';

  return result;
end;
$$;
grant execute on function public.lookup_seminar_bookings_by_phone(text) to anon,authenticated;

-- Cancel using only the mobile number when there is one active booking. If legacy data ever
-- contains multiple active bookings for the same mobile, the UI can pass that booking's UUID.
create or replace function public.cancel_seminar_booking_by_phone(
  p_phone text,
  p_registration_id uuid default null
) returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
  normalized_phone text := regexp_replace(coalesce(p_phone,''),'[^0-9]','','g');
  r public.seminar_registrations%rowtype;
  active_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(normalized_phone, 0));
  if length(normalized_phone) <> 10 then raise exception 'INVALID_PHONE'; end if;

  if p_registration_id is not null then
    select * into r from public.seminar_registrations
    where id=p_registration_id and phone=normalized_phone and status <> 'cancelled'
    for update;
    if not found then raise exception 'NOT_FOUND'; end if;
  else
    select count(*)::integer into active_count
    from public.seminar_registrations
    where phone=normalized_phone and status <> 'cancelled';
    if active_count=0 then raise exception 'NOT_FOUND'; end if;
    if active_count>1 then raise exception 'MULTIPLE_BOOKINGS'; end if;
    select * into r from public.seminar_registrations
    where phone=normalized_phone and status <> 'cancelled'
    limit 1 for update;
  end if;

  if r.status='attended' then raise exception 'ALREADY_ATTENDED'; end if;

  update public.seminar_registrations
  set status='cancelled',cancelled_at=now()
  where id=r.id;

  return jsonb_build_object(
    'id',r.id,'status','cancelled','booking_code',r.booking_code,'seat_number',r.seat_number
  );
end;
$$;
grant execute on function public.cancel_seminar_booking_by_phone(text,uuid) to anon,authenticated;

-- Remove the older unscoped QR RPC from v20 so only event-scoped check-in remains.
drop function if exists public.checkin_seminar_qr(text);

-- Event-scoped QR check-in. This prevents an admin working on Session A from accidentally
-- checking in a QR belonging to another seminar session.
create or replace function public.checkin_seminar_qr(
  p_qr_text text,
  p_event_id uuid
) returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
  parts text[];
  qr_prefix text;
  qr_code text;
  qr_seat integer;
  r public.seminar_registrations%rowtype;
  e public.seminar_events%rowtype;
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;

  parts := string_to_array(trim(coalesce(p_qr_text,'')), '|');
  qr_prefix := trim(coalesce(parts[1],''));
  qr_code := upper(trim(coalesce(parts[2],'')));
  qr_seat := case when coalesce(parts[3],'') ~ '^\d+$' then parts[3]::integer else null end;

  if qr_prefix <> 'RDS-SEMINAR' or qr_code = '' then raise exception 'INVALID_QR'; end if;

  select * into r from public.seminar_registrations
  where booking_code=qr_code
  limit 1 for update;
  if not found then raise exception 'NOT_FOUND'; end if;

  if r.event_id <> p_event_id then raise exception 'WRONG_SESSION'; end if;

  select * into e from public.seminar_events where id=r.event_id;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;

  if qr_seat is not null and qr_seat <> r.seat_number then raise exception 'WRONG_SEAT'; end if;
  if r.status='cancelled' then raise exception 'CANCELLED'; end if;

  if r.status='attended' then
    return jsonb_build_object(
      'already_attended',true,'id',r.id,'booking_code',r.booking_code,'full_name',r.full_name,
      'seat_number',r.seat_number,'attended_at',r.attended_at,'event_id',r.event_id,'event_date',e.event_date
    );
  end if;

  update public.seminar_registrations
  set status='attended',attended_at=now()
  where id=r.id;

  return jsonb_build_object(
    'already_attended',false,'id',r.id,'booking_code',r.booking_code,'full_name',r.full_name,
    'phone',r.phone,'seat_number',r.seat_number,'attended_at',now(),'event_id',r.event_id,
    'event_date',e.event_date,'title',e.title,'venue',e.venue
  );
end;
$$;
grant execute on function public.checkin_seminar_qr(text,uuid) to authenticated;
