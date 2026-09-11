-- RAJU DRIVING SCHOOL — DIGITAL STUDENT REGISTER BASE TABLES
-- Standalone from the Defensive Driving Seminar system.
create extension if not exists pgcrypto;

create table if not exists public.student_register_entries (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.student_profiles(id) on delete set null,
  enrolment_number text, full_name text, parent_relation_name text, phone text, email text,
  permanent_address text, temporary_address text, official_address text, date_of_birth date,
  vehicle_class text, enrollment_date date, learner_license_number text, learner_license_expiry date,
  course_completion_date date, competency_test_date date, driving_license_number text,
  driving_license_issue_date date, driving_license_authority text, remarks text, blood_group text,
  photo_data text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.student_driving_hours (
  id uuid primary key default gen_random_uuid(),
  student_register_id uuid not null references public.student_register_entries(id) on delete cascade,
  date date, from_time time, to_time time, vehicle_class text, created_at timestamptz not null default now()
);

-- RAJU DRIVING SCHOOL — DIGITAL STUDENT REGISTER REPAIR V3
-- Run this after the earlier student-register SQL files.
-- This script only touches the Digital Student Register tables/functions.
-- Defensive Driving Seminar objects are not referenced.

create extension if not exists pgcrypto;

-- 1) Make sure the register columns/tables exist.
alter table public.student_register_entries alter column full_name drop not null;

-- 2) Clean duplicate register rows created for the same mobile + DOB.
-- Keep the most recently updated row, move its driving-hour rows, then remove older duplicates.
do $$
declare
  g record;
  keep_id uuid;
  dup record;
begin
  for g in
    select regexp_replace(coalesce(phone,''),'[^0-9]','','g') as phone_key, date_of_birth
    from public.student_register_entries
    where date_of_birth is not null
      and regexp_replace(coalesce(phone,''),'[^0-9]','','g') <> ''
    group by regexp_replace(coalesce(phone,''),'[^0-9]','','g'), date_of_birth
    having count(*) > 1
  loop
    select id into keep_id
    from public.student_register_entries
    where date_of_birth = g.date_of_birth
      and regexp_replace(coalesce(phone,''),'[^0-9]','','g') = g.phone_key
    order by updated_at desc nulls last, created_at desc nulls last, id
    limit 1;

    for dup in
      select id
      from public.student_register_entries
      where date_of_birth = g.date_of_birth
        and regexp_replace(coalesce(phone,''),'[^0-9]','','g') = g.phone_key
        and id <> keep_id
    loop
      update public.student_driving_hours
      set student_register_id = keep_id
      where student_register_id = dup.id;

      delete from public.student_register_entries where id = dup.id;
    end loop;
  end loop;
end $$;

-- 3) Prevent the same person from being created again by phone + DOB.
drop index if exists public.student_register_entries_phone_dob_unique_idx;
create unique index student_register_entries_phone_dob_unique_idx
on public.student_register_entries (
  regexp_replace(coalesce(phone,''),'[^0-9]','','g'),
  date_of_birth
)
where date_of_birth is not null
  and regexp_replace(coalesce(phone,''),'[^0-9]','','g') <> '';

-- 4) Admin create/update. A new entry first looks for an existing matching
-- student (student_id or normalized phone + DOB) and updates it instead of duplicating it.
create or replace function public.admin_upsert_student_register(p_id uuid, p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_id uuid := p_id;
  v_student_id uuid;
  v_phone text;
  v_dob date;
begin
  if not public.is_admin() then
    raise exception 'Admin access required.';
  end if;

  v_student_id := nullif(trim(coalesce(p_payload->>'student_id','')), '')::uuid;
  v_phone := nullif(trim(coalesce(p_payload->>'phone','')), '');
  v_dob := nullif(trim(coalesce(p_payload->>'date_of_birth','')), '')::date;

  if v_id is null then
    if v_student_id is not null then
      select id into v_id
      from public.student_register_entries
      where student_id = v_student_id
      order by updated_at desc nulls last, created_at desc nulls last
      limit 1;
    end if;

    if v_id is null and v_phone is not null and v_dob is not null then
      select id into v_id
      from public.student_register_entries
      where date_of_birth = v_dob
        and regexp_replace(coalesce(phone,''),'[^0-9]','','g') = regexp_replace(v_phone,'[^0-9]','','g')
      order by updated_at desc nulls last, created_at desc nulls last
      limit 1;
    end if;
  end if;

  if v_id is null then
    insert into public.student_register_entries (
      student_id,enrolment_number,full_name,parent_relation_name,phone,email,
      permanent_address,temporary_address,official_address,date_of_birth,vehicle_class,
      enrollment_date,learner_license_number,learner_license_expiry,course_completion_date,
      competency_test_date,driving_license_number,driving_license_issue_date,
      driving_license_authority,remarks,blood_group,photo_data,updated_at
    ) values (
      v_student_id,
      nullif(trim(coalesce(p_payload->>'enrolment_number','')), ''),
      nullif(trim(coalesce(p_payload->>'full_name','')), ''),
      nullif(trim(coalesce(p_payload->>'parent_relation_name','')), ''),
      v_phone,
      nullif(trim(coalesce(p_payload->>'email','')), ''),
      nullif(trim(coalesce(p_payload->>'permanent_address','')), ''),
      nullif(trim(coalesce(p_payload->>'temporary_address','')), ''),
      nullif(trim(coalesce(p_payload->>'official_address','')), ''),
      v_dob,
      nullif(trim(coalesce(p_payload->>'vehicle_class','')), ''),
      nullif(trim(coalesce(p_payload->>'enrollment_date','')), '')::date,
      nullif(trim(coalesce(p_payload->>'learner_license_number','')), ''),
      nullif(trim(coalesce(p_payload->>'learner_license_expiry','')), '')::date,
      nullif(trim(coalesce(p_payload->>'course_completion_date','')), '')::date,
      nullif(trim(coalesce(p_payload->>'competency_test_date','')), '')::date,
      nullif(trim(coalesce(p_payload->>'driving_license_number','')), ''),
      nullif(trim(coalesce(p_payload->>'driving_license_issue_date','')), '')::date,
      nullif(trim(coalesce(p_payload->>'driving_license_authority','')), ''),
      nullif(trim(coalesce(p_payload->>'remarks','')), ''),
      nullif(trim(coalesce(p_payload->>'blood_group','')), ''),
      nullif(trim(coalesce(p_payload->>'photo_data','')), ''),
      now()
    ) returning id into v_id;
  else
    update public.student_register_entries set
      student_id = coalesce(v_student_id, student_id),
      enrolment_number = nullif(trim(coalesce(p_payload->>'enrolment_number','')), ''),
      full_name = nullif(trim(coalesce(p_payload->>'full_name','')), ''),
      parent_relation_name = nullif(trim(coalesce(p_payload->>'parent_relation_name','')), ''),
      phone = v_phone,
      email = nullif(trim(coalesce(p_payload->>'email','')), ''),
      permanent_address = nullif(trim(coalesce(p_payload->>'permanent_address','')), ''),
      temporary_address = nullif(trim(coalesce(p_payload->>'temporary_address','')), ''),
      official_address = nullif(trim(coalesce(p_payload->>'official_address','')), ''),
      date_of_birth = v_dob,
      vehicle_class = nullif(trim(coalesce(p_payload->>'vehicle_class','')), ''),
      enrollment_date = nullif(trim(coalesce(p_payload->>'enrollment_date','')), '')::date,
      learner_license_number = nullif(trim(coalesce(p_payload->>'learner_license_number','')), ''),
      learner_license_expiry = nullif(trim(coalesce(p_payload->>'learner_license_expiry','')), '')::date,
      course_completion_date = nullif(trim(coalesce(p_payload->>'course_completion_date','')), '')::date,
      competency_test_date = nullif(trim(coalesce(p_payload->>'competency_test_date','')), '')::date,
      driving_license_number = nullif(trim(coalesce(p_payload->>'driving_license_number','')), ''),
      driving_license_issue_date = nullif(trim(coalesce(p_payload->>'driving_license_issue_date','')), '')::date,
      driving_license_authority = nullif(trim(coalesce(p_payload->>'driving_license_authority','')), ''),
      remarks = nullif(trim(coalesce(p_payload->>'remarks','')), ''),
      blood_group = nullif(trim(coalesce(p_payload->>'blood_group','')), ''),
      photo_data = nullif(trim(coalesce(p_payload->>'photo_data','')), ''),
      updated_at = now()
    where id = v_id;

    if not found then
      raise exception 'Register entry not found.';
    end if;
  end if;

  return v_id;
end;
$$;
grant execute on function public.admin_upsert_student_register(uuid,jsonb) to authenticated;

-- 5) Replace driving-hour rows atomically for an admin edit.
create or replace function public.admin_replace_student_driving_hours(p_register_id uuid,p_hours jsonb)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.is_admin() then raise exception 'Admin access required.'; end if;
  delete from public.student_driving_hours where student_register_id=p_register_id;
  if jsonb_typeof(coalesce(p_hours,'[]'::jsonb))='array' then
    insert into public.student_driving_hours(student_register_id,date,from_time,to_time,vehicle_class)
    select p_register_id,
      nullif(x->>'date','')::date,
      nullif(x->>'from_time','')::time,
      nullif(x->>'to_time','')::time,
      nullif(x->>'vehicle_class','')
    from jsonb_array_elements(p_hours) x;
  end if;
end;
$$;
grant execute on function public.admin_replace_student_driving_hours(uuid,jsonb) to authenticated;

-- 6) Student lookup: Mobile + DOB. Normalize mobile formatting so
-- 98765 43210, +91 9876543210 and 9876543210 can be compared consistently.
create or replace function public.student_register_login(p_phone text,p_dob date)
returns setof public.student_register_entries
language sql
security definer
set search_path=public
as $$
  select *
  from public.student_register_entries
  where regexp_replace(coalesce(phone,''),'[^0-9]','','g') = regexp_replace(coalesce(p_phone,''),'[^0-9]','','g')
    and date_of_birth = p_dob
  order by updated_at desc nulls last, created_at desc nulls last
  limit 1
$$;
grant execute on function public.student_register_login(text,date) to anon,authenticated;

-- 7) Student updates the same matched record. Identity fields remain unchanged.
create or replace function public.student_register_update(p_phone text,p_dob date,p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare v_id uuid;
begin
  select id into v_id
  from public.student_register_entries
  where regexp_replace(coalesce(phone,''),'[^0-9]','','g') = regexp_replace(coalesce(p_phone,''),'[^0-9]','','g')
    and date_of_birth = p_dob
  order by updated_at desc nulls last, created_at desc nulls last
  limit 1;

  if v_id is null then raise exception 'No matching student register found.'; end if;

  update public.student_register_entries set
    full_name = nullif(trim(coalesce(p_payload->>'full_name','')), ''),
    parent_relation_name = nullif(trim(coalesce(p_payload->>'parent_relation_name','')), ''),
    blood_group = nullif(trim(coalesce(p_payload->>'blood_group','')), ''),
    permanent_address = nullif(trim(coalesce(p_payload->>'permanent_address','')), ''),
    temporary_address = nullif(trim(coalesce(p_payload->>'temporary_address','')), ''),
    official_address = nullif(trim(coalesce(p_payload->>'official_address','')), ''),
    learner_license_number = nullif(trim(coalesce(p_payload->>'learner_license_number','')), ''),
    learner_license_expiry = nullif(trim(coalesce(p_payload->>'learner_license_expiry','')), '')::date,
    driving_license_number = nullif(trim(coalesce(p_payload->>'driving_license_number','')), ''),
    driving_license_issue_date = nullif(trim(coalesce(p_payload->>'driving_license_issue_date','')), '')::date,
    driving_license_authority = nullif(trim(coalesce(p_payload->>'driving_license_authority','')), ''),
    course_completion_date = nullif(trim(coalesce(p_payload->>'course_completion_date','')), '')::date,
    competency_test_date = nullif(trim(coalesce(p_payload->>'competency_test_date','')), '')::date,
    remarks = nullif(trim(coalesce(p_payload->>'remarks','')), ''),
    updated_at = now()
  where id = v_id;

  return v_id;
end;
$$;
grant execute on function public.student_register_update(text,date,jsonb) to anon,authenticated;

-- Keep RLS in place. Students do not receive table-wide SELECT/UPDATE access.
alter table public.student_register_entries enable row level security;
alter table public.student_driving_hours enable row level security;

drop policy if exists "Admins manage student register entries" on public.student_register_entries;
create policy "Admins manage student register entries"
on public.student_register_entries for all to authenticated
using(public.is_admin()) with check(public.is_admin());

drop policy if exists "Admins manage student driving hours" on public.student_driving_hours;
create policy "Admins manage student driving hours"
on public.student_driving_hours for all to authenticated
using(public.is_admin()) with check(public.is_admin());

notify pgrst,'reload schema';
