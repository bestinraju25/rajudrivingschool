-- Raju Driving School — Defensive Seminar management upgrade
-- Run this after the original defensive-driving-seminar.sql if that has already been installed.
-- Adds: public booking lookup/cancellation + admin deletion permission.

create policy if not exists "Admins can delete seminar registrations" on public.seminar_registrations
for delete to authenticated using (public.is_admin());

create or replace function public.lookup_seminar_booking(
  p_booking_code text, p_phone text
) returns jsonb
language plpgsql security definer set search_path=public
as $$
declare r public.seminar_registrations%rowtype; e public.seminar_events%rowtype;
begin
  select * into r from public.seminar_registrations
   where booking_code=upper(trim(p_booking_code))
     and phone=regexp_replace(p_phone,'[^0-9]','','g') limit 1;
  if not found then raise exception 'NOT_FOUND'; end if;
  select * into e from public.seminar_events where id=r.event_id;
  return jsonb_build_object('id',r.id,'booking_code',r.booking_code,'full_name',r.full_name,'phone',r.phone,'email',r.email,'seat_number',r.seat_number,'status',r.status,'registered_at',r.registered_at,'event_id',e.id,'title',e.title,'event_date',e.event_date,'start_time',e.start_time,'end_time',e.end_time,'venue',e.venue);
end;
$$;
grant execute on function public.lookup_seminar_booking(text,text) to anon,authenticated;

create or replace function public.cancel_seminar_booking(
  p_booking_code text, p_phone text
) returns jsonb
language plpgsql security definer set search_path=public
as $$
declare r public.seminar_registrations%rowtype;
begin
  select * into r from public.seminar_registrations
   where booking_code=upper(trim(p_booking_code))
     and phone=regexp_replace(p_phone,'[^0-9]','','g') limit 1 for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if r.status='attended' then raise exception 'ALREADY_ATTENDED'; end if;
  if r.status='cancelled' then return jsonb_build_object('id',r.id,'status','cancelled','booking_code',r.booking_code); end if;
  update public.seminar_registrations set status='cancelled',cancelled_at=now() where id=r.id;
  return jsonb_build_object('id',r.id,'status','cancelled','booking_code',r.booking_code,'seat_number',r.seat_number);
end;
$$;
grant execute on function public.cancel_seminar_booking(text,text) to anon,authenticated;
