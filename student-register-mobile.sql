-- RAJU DRIVING SCHOOL — DIGITAL STUDENT REGISTER ACCESS
-- Standalone from the Defensive Driving Seminar system.
-- Student access uses Mobile Number + Date of Birth. No SMS/OTP is required.

alter table public.student_register_entries add column if not exists student_id uuid references public.student_profiles(id) on delete set null;

-- Admin save/update function. All register fields may be blank and can be completed later.
create or replace function public.admin_upsert_student_register(p_id uuid, p_payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_student_id uuid; v_dob date;
begin
  if not public.is_admin() then raise exception 'Admin access required.'; end if;
  v_student_id := nullif(trim(coalesce(p_payload->>'student_id','')), '')::uuid;
  v_dob := nullif(trim(coalesce(p_payload->>'date_of_birth','')), '')::date;
  if p_id is null then
    insert into public.student_register_entries(student_id,enrolment_number,full_name,parent_relation_name,phone,email,permanent_address,temporary_address,official_address,date_of_birth,vehicle_class,enrollment_date,learner_license_number,learner_license_expiry,course_completion_date,competency_test_date,driving_license_number,driving_license_issue_date,driving_license_authority,remarks,blood_group,photo_data)
    values(v_student_id,nullif(trim(coalesce(p_payload->>'enrolment_number','')), ''),nullif(trim(coalesce(p_payload->>'full_name','')), ''),nullif(trim(coalesce(p_payload->>'parent_relation_name','')), ''),nullif(trim(coalesce(p_payload->>'phone','')), ''),nullif(trim(coalesce(p_payload->>'email','')), ''),nullif(trim(coalesce(p_payload->>'permanent_address','')), ''),nullif(trim(coalesce(p_payload->>'temporary_address','')), ''),nullif(trim(coalesce(p_payload->>'official_address','')), ''),v_dob,nullif(trim(coalesce(p_payload->>'vehicle_class','')), ''),nullif(trim(coalesce(p_payload->>'enrollment_date','')), '')::date,nullif(trim(coalesce(p_payload->>'learner_license_number','')), ''),nullif(trim(coalesce(p_payload->>'learner_license_expiry','')), '')::date,nullif(trim(coalesce(p_payload->>'course_completion_date','')), '')::date,nullif(trim(coalesce(p_payload->>'competency_test_date','')), '')::date,nullif(trim(coalesce(p_payload->>'driving_license_number','')), ''),nullif(trim(coalesce(p_payload->>'driving_license_issue_date','')), '')::date,nullif(trim(coalesce(p_payload->>'driving_license_authority','')), ''),nullif(trim(coalesce(p_payload->>'remarks','')), ''),nullif(trim(coalesce(p_payload->>'blood_group','')), ''),nullif(trim(coalesce(p_payload->>'photo_data','')), '')) returning id into v_id;
  else
    update public.student_register_entries set student_id=v_student_id,enrolment_number=nullif(trim(coalesce(p_payload->>'enrolment_number','')), ''),full_name=nullif(trim(coalesce(p_payload->>'full_name','')), ''),parent_relation_name=nullif(trim(coalesce(p_payload->>'parent_relation_name','')), ''),phone=nullif(trim(coalesce(p_payload->>'phone','')), ''),email=nullif(trim(coalesce(p_payload->>'email','')), ''),permanent_address=nullif(trim(coalesce(p_payload->>'permanent_address','')), ''),temporary_address=nullif(trim(coalesce(p_payload->>'temporary_address','')), ''),official_address=nullif(trim(coalesce(p_payload->>'official_address','')), ''),date_of_birth=v_dob,vehicle_class=nullif(trim(coalesce(p_payload->>'vehicle_class','')), ''),enrollment_date=nullif(trim(coalesce(p_payload->>'enrollment_date','')), '')::date,learner_license_number=nullif(trim(coalesce(p_payload->>'learner_license_number','')), ''),learner_license_expiry=nullif(trim(coalesce(p_payload->>'learner_license_expiry','')), '')::date,course_completion_date=nullif(trim(coalesce(p_payload->>'course_completion_date','')), '')::date,competency_test_date=nullif(trim(coalesce(p_payload->>'competency_test_date','')), '')::date,driving_license_number=nullif(trim(coalesce(p_payload->>'driving_license_number','')), ''),driving_license_issue_date=nullif(trim(coalesce(p_payload->>'driving_license_issue_date','')), '')::date,driving_license_authority=nullif(trim(coalesce(p_payload->>'driving_license_authority','')), ''),remarks=nullif(trim(coalesce(p_payload->>'remarks','')), ''),blood_group=nullif(trim(coalesce(p_payload->>'blood_group','')), ''),photo_data=nullif(trim(coalesce(p_payload->>'photo_data','')), ''),updated_at=now() where id=p_id returning id into v_id;
    if v_id is null then raise exception 'Register entry not found.'; end if;
  end if;
  return v_id;
end; $$;
grant execute on function public.admin_upsert_student_register(uuid,jsonb) to authenticated;

create or replace function public.admin_replace_student_driving_hours(p_register_id uuid,p_hours jsonb)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.is_admin() then raise exception 'Admin access required.'; end if;
 delete from public.student_driving_hours where student_register_id=p_register_id;
 if jsonb_typeof(coalesce(p_hours,'[]'::jsonb))='array' then
  insert into public.student_driving_hours(student_register_id,date,from_time,to_time,vehicle_class)
  select p_register_id,nullif(x->>'date','')::date,nullif(x->>'from_time','')::time,nullif(x->>'to_time','')::time,nullif(x->>'vehicle_class','') from jsonb_array_elements(p_hours) x;
 end if;
end; $$;
grant execute on function public.admin_replace_student_driving_hours(uuid,jsonb) to authenticated;

alter table public.student_register_entries enable row level security;
alter table public.student_driving_hours enable row level security;
drop policy if exists "Admins manage student register entries" on public.student_register_entries;
create policy "Admins manage student register entries" on public.student_register_entries for all to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists "Admins manage student driving hours" on public.student_driving_hours;
create policy "Admins manage student driving hours" on public.student_driving_hours for all to authenticated using(public.is_admin()) with check(public.is_admin());

-- Public student lookup by the two pieces of information supplied by the student.
-- Only the matching register row is returned; no table-wide public SELECT is granted.
create or replace function public.student_register_login(p_phone text,p_dob date)
returns setof public.student_register_entries
language sql security definer set search_path=public as $$
  select * from public.student_register_entries
  where regexp_replace(coalesce(phone,''),'\\D','','g') = regexp_replace(coalesce(p_phone,''),'\\D','','g')
    and date_of_birth = p_dob
  order by updated_at desc
  limit 1
$$;
grant execute on function public.student_register_login(text,date) to anon, authenticated;

-- Student can update only the row matching the supplied mobile + DOB.
-- Mobile number and DOB themselves are never changed through this function.
create or replace function public.student_register_update(p_phone text,p_dob date,p_payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
 select id into v_id from public.student_register_entries
 where regexp_replace(coalesce(phone,''),'\\D','','g')=regexp_replace(coalesce(p_phone,''),'\\D','','g') and date_of_birth=p_dob
 order by updated_at desc limit 1;
 if v_id is null then raise exception 'No matching student register found.'; end if;
 update public.student_register_entries set
   full_name=coalesce(nullif(trim(coalesce(p_payload->>'full_name','')), ''),full_name),
   parent_relation_name=nullif(trim(coalesce(p_payload->>'parent_relation_name','')), ''),
   email=nullif(trim(coalesce(p_payload->>'email','')), ''),
   permanent_address=nullif(trim(coalesce(p_payload->>'permanent_address','')), ''),
   temporary_address=nullif(trim(coalesce(p_payload->>'temporary_address','')), ''),
   official_address=nullif(trim(coalesce(p_payload->>'official_address','')), ''),
   blood_group=nullif(trim(coalesce(p_payload->>'blood_group','')), ''),
   learner_license_number=nullif(trim(coalesce(p_payload->>'learner_license_number','')), ''),
   learner_license_expiry=nullif(trim(coalesce(p_payload->>'learner_license_expiry','')), '')::date,
   driving_license_number=nullif(trim(coalesce(p_payload->>'driving_license_number','')), ''),
   driving_license_issue_date=nullif(trim(coalesce(p_payload->>'driving_license_issue_date','')), '')::date,
   driving_license_authority=nullif(trim(coalesce(p_payload->>'driving_license_authority','')), ''),
   course_completion_date=nullif(trim(coalesce(p_payload->>'course_completion_date','')), '')::date,
   competency_test_date=nullif(trim(coalesce(p_payload->>'competency_test_date','')), '')::date,
   remarks=nullif(trim(coalesce(p_payload->>'remarks','')), ''),
   updated_at=now()
 where id=v_id;
 return v_id;
end; $$;
grant execute on function public.student_register_update(text,date,jsonb) to anon, authenticated;

notify pgrst,'reload schema';
