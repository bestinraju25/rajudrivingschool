-- Raju Driving School — Defensive Driving Seminar booking system
-- Run this once in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.seminar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Defensive Driving Seminar',
  description text,
  event_date date not null,
  start_time time not null,
  end_time time,
  venue text,
  capacity integer not null default 90 check (capacity between 1 and 90),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.seminar_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.seminar_events(id) on delete cascade,
  booking_code text not null unique,
  full_name text not null,
  phone text not null,
  email text not null,
  license_number text,
  date_of_birth date,
  seat_number integer not null check (seat_number > 0 and seat_number <= 90),
  status text not null default 'confirmed' check (status in ('confirmed','cancelled','attended')),
  registered_at timestamptz not null default now(),
  cancelled_at timestamptz,
  attended_at timestamptz
);

create unique index if not exists seminar_event_seat_unique on public.seminar_registrations(event_id,seat_number) where status <> 'cancelled';
create unique index if not exists seminar_event_phone_unique on public.seminar_registrations(event_id,phone) where status <> 'cancelled';
create unique index if not exists seminar_event_email_unique on public.seminar_registrations(event_id,lower(email)) where status <> 'cancelled';
create index if not exists seminar_reg_event_idx on public.seminar_registrations(event_id,status);

alter table public.seminar_events enable row level security;
alter table public.seminar_registrations enable row level security;

drop policy if exists "Public can view active seminar events" on public.seminar_events;
create policy "Public can view active seminar events" on public.seminar_events for select to anon,authenticated using (is_active=true);

drop policy if exists "Admins can manage seminar events" on public.seminar_events;
create policy "Admins can manage seminar events" on public.seminar_events for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins can view seminar registrations" on public.seminar_registrations;
create policy "Admins can view seminar registrations" on public.seminar_registrations for select to authenticated using (public.is_admin());

drop policy if exists "Admins can update seminar registrations" on public.seminar_registrations;
create policy "Admins can update seminar registrations" on public.seminar_registrations for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins can delete seminar registrations" on public.seminar_registrations;
create policy "Admins can delete seminar registrations" on public.seminar_registrations for delete to authenticated using (public.is_admin());

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
begin
  select * into ev from public.seminar_events where id=p_event_id and is_active=true for update;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;
  if ev.capacity <> 90 then ev.capacity := 90; end if;
  if length(regexp_replace(coalesce(p_phone,''),'[^0-9]','','g')) <> 10 then raise exception 'INVALID_PHONE'; end if;
  if coalesce(length(trim(p_full_name)),0) < 2 then raise exception 'INVALID_NAME'; end if;
  if position('@' in coalesce(p_email,'')) < 2 then raise exception 'INVALID_EMAIL'; end if;

  select * into existing from public.seminar_registrations
   where event_id=p_event_id and status <> 'cancelled'
     and (phone=regexp_replace(p_phone,'[^0-9]','','g') or lower(email)=lower(trim(p_email)))
   limit 1;
  if found then raise exception 'DUPLICATE'; end if;

  select count(*)::integer into next_seat from public.seminar_registrations where event_id=p_event_id and status <> 'cancelled';
  if next_seat >= ev.capacity then raise exception 'FULLY_BOOKED'; end if;
  next_seat := next_seat + 1;
  new_id := gen_random_uuid();
  new_code := 'RDS-DS-' || to_char(ev.event_date,'YYYYMMDD') || '-' || lpad(next_seat::text,2,'0');
  insert into public.seminar_registrations(id,event_id,booking_code,full_name,phone,email,license_number,date_of_birth,seat_number)
  values(new_id,p_event_id,new_code,trim(p_full_name),regexp_replace(p_phone,'[^0-9]','','g'),lower(trim(p_email)),nullif(trim(p_license_number),''),p_date_of_birth,next_seat);
  return jsonb_build_object('id',new_id,'booking_code',new_code,'full_name',trim(p_full_name),'seat_number',next_seat,'event_date',ev.event_date,'start_time',ev.start_time,'end_time',ev.end_time,'venue',ev.venue,'title',ev.title);
end;
$$;

grant execute on function public.register_seminar_seat(uuid,text,text,text,text,date) to anon,authenticated;

create or replace function public.seminar_capacity(p_event_id uuid)
returns jsonb language sql security definer set search_path=public as $$
select jsonb_build_object('capacity',e.capacity,'booked',(select count(*) from public.seminar_registrations r where r.event_id=e.id and r.status<>'cancelled'),'available',e.capacity-(select count(*) from public.seminar_registrations r where r.event_id=e.id and r.status<>'cancelled')) from public.seminar_events e where e.id=p_event_id;
$$;
grant execute on function public.seminar_capacity(uuid) to anon,authenticated;

create or replace function public.active_seminar_events()
returns table(id uuid,title text,description text,event_date date,start_time time,end_time time,venue text,capacity integer,booked bigint,available bigint)
language sql security definer set search_path=public as $$
select e.id,e.title,e.description,e.event_date,e.start_time,e.end_time,e.venue,e.capacity,
       count(r.id) filter (where r.status <> 'cancelled') as booked,
       e.capacity-count(r.id) filter (where r.status <> 'cancelled') as available
from public.seminar_events e left join public.seminar_registrations r on r.event_id=e.id
where e.is_active=true group by e.id order by e.event_date,e.start_time;
$$;
grant execute on function public.active_seminar_events() to anon,authenticated;

-- Example session. Update this row with the real date/time/venue before publishing bookings.
-- insert into public.seminar_events(title,description,event_date,start_time,end_time,venue,capacity)
-- values ('Defensive Driving Seminar','Practical defensive driving, hazard awareness and road-safety techniques.','2026-09-26','09:00','12:00','Raju Driving School',90);
