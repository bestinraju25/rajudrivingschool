-- RAJU DRIVING SCHOOL — DIGITAL STUDENT REGISTER MOBILE ACCESS
-- This is ONLY for the Digital Student Register. It does not modify seminar tables.

alter table public.student_register_entries add column if not exists student_id uuid references public.student_profiles(id) on delete set null;

create or replace function public.admin_upsert_student_register(p_id uuid, p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then raise exception 'Admin access required.'; end if;
  if p_id is null then
    insert into public.student_register_entries (
      student_id,enrolment_number,full_name,parent_relation_name,phone,email,permanent_address,temporary_address,official_address,
      date_of_birth,vehicle_class,enrollment_date,learner_license_number,learner_license_expiry,course_completion_date,
      competency_test_date,driving_license_number,driving_license_issue_date,driving_license_authority,remarks,blood_group,photo_data
    ) values (
      nullif(p_payload->>'student_id','')::uuid,nullif(p_payload->>'enrolment_number',''),nullif(p_payload->>'full_name',''),nullif(p_payload->>'parent_relation_name',''),
      nullif(p_payload->>'phone',''),nullif(p_payload->>'email',''),nullif(p_payload->>'permanent_address',''),nullif(p_payload->>'temporary_address',''),nullif(p_payload->>'official_address',''),
      nullif(p_payload->>'date_of_birth','')::date,nullif(p_payload->>'vehicle_class',''),nullif(p_payload->>'enrollment_date','')::date,nullif(p_payload->>'learner_license_number',''),
      nullif(p_payload->>'learner_license_expiry','')::date,nullif(p_payload->>'course_completion_date','')::date,nullif(p_payload->>'competency_test_date','')::date,
      nullif(p_payload->>'driving_license_number',''),nullif(p_payload->>'driving_license_issue_date','')::date,nullif(p_payload->>'driving_license_authority',''),
      nullif(p_payload->>'remarks',''),nullif(p_payload->>'blood_group',''),nullif(p_payload->>'photo_data','')
    ) returning id into v_id;
  else
    update public.student_register_entries set
      student_id=nullif(p_payload->>'student_id','')::uuid,enrolment_number=nullif(p_payload->>'enrolment_number',''),full_name=nullif(p_payload->>'full_name',''),
      parent_relation_name=nullif(p_payload->>'parent_relation_name',''),phone=nullif(p_payload->>'phone',''),email=nullif(p_payload->>'email',''),
      permanent_address=nullif(p_payload->>'permanent_address',''),temporary_address=nullif(p_payload->>'temporary_address',''),official_address=nullif(p_payload->>'official_address',''),
      date_of_birth=nullif(p_payload->>'date_of_birth','')::date,vehicle_class=nullif(p_payload->>'vehicle_class',''),enrollment_date=nullif(p_payload->>'enrollment_date','')::date,
      learner_license_number=nullif(p_payload->>'learner_license_number',''),learner_license_expiry=nullif(p_payload->>'learner_license_expiry','')::date,
      course_completion_date=nullif(p_payload->>'course_completion_date','')::date,competency_test_date=nullif(p_payload->>'competency_test_date','')::date,
      driving_license_number=nullif(p_payload->>'driving_license_number',''),driving_license_issue_date=nullif(p_payload->>'driving_license_issue_date','')::date,
      driving_license_authority=nullif(p_payload->>'driving_license_authority',''),remarks=nullif(p_payload->>'remarks',''),blood_group=nullif(p_payload->>'blood_group',''),
      photo_data=nullif(p_payload->>'photo_data',''),updated_at=now()
    where id=p_id returning id into v_id;
    if v_id is null then raise exception 'Register entry not found.'; end if;
  end if;
  return v_id;
end;
$$;
grant execute on function public.admin_upsert_student_register(uuid,jsonb) to authenticated;

create or replace function public.admin_replace_student_driving_hours(p_register_id uuid, p_hours jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Admin access required.'; end if;
  delete from public.student_driving_hours where student_register_id=p_register_id;
  if jsonb_typeof(coalesce(p_hours,'[]'::jsonb))='array' then
    insert into public.student_driving_hours(student_register_id,date,from_time,to_time,vehicle_class)
    select p_register_id,
      nullif(x->>'date','')::date,nullif(x->>'from_time','')::time,nullif(x->>'to_time','')::time,nullif(x->>'vehicle_class','')
    from jsonb_array_elements(p_hours) x;
  end if;
end;
$$;
grant execute on function public.admin_replace_student_driving_hours(uuid,jsonb) to authenticated;

-- Student register read/update access. Students may claim an unassigned register record by verifying
-- the same mobile number through Supabase Phone OTP.
drop policy if exists "Students can view own register entry" on public.student_register_entries;
create policy "Students can view own register entry"
on public.student_register_entries for select to authenticated
using (student_id = auth.uid() or (student_id is null and phone = coalesce(auth.jwt()->>'phone','')));

drop policy if exists "Students can update own register entry" on public.student_register_entries;
create policy "Students can update own register entry"
on public.student_register_entries for update to authenticated
using (student_id = auth.uid() or (student_id is null and phone = coalesce(auth.jwt()->>'phone','')))
with check (student_id = auth.uid());

alter table public.student_driving_hours enable row level security;
drop policy if exists "Students can view own register hours" on public.student_driving_hours;
create policy "Students can view own register hours"
on public.student_driving_hours for select to authenticated
using (exists (select 1 from public.student_register_entries r where r.id=student_register_id and (r.student_id=auth.uid() or (r.student_id is null and r.phone=coalesce(auth.jwt()->>'phone','')))));

create or replace function public.student_claim_register_entry()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid; v_phone text;
begin
  v_phone := nullif(auth.jwt()->>'phone','');
  if v_phone is null then raise exception 'Mobile number verification is required.'; end if;
  select id into v_id from public.student_register_entries where student_id is null and phone=v_phone order by created_at desc limit 1 for update;
  if v_id is not null then update public.student_register_entries set student_id=auth.uid(), updated_at=now() where id=v_id; end if;
  return v_id;
end;
$$;
grant execute on function public.student_claim_register_entry() to authenticated;

create or replace function public.student_update_register(p_register_id uuid, p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if p_register_id is null then raise exception 'Register entry is required.'; end if;
  update public.student_register_entries set
    student_id=auth.uid(),full_name=coalesce(nullif(p_payload->>'full_name',''),full_name),parent_relation_name=nullif(p_payload->>'parent_relation_name',''),
    email=nullif(p_payload->>'email',''),permanent_address=nullif(p_payload->>'permanent_address',''),temporary_address=nullif(p_payload->>'temporary_address',''),official_address=nullif(p_payload->>'official_address',''),
    date_of_birth=nullif(p_payload->>'date_of_birth','')::date,learner_license_number=nullif(p_payload->>'learner_license_number',''),learner_license_expiry=nullif(p_payload->>'learner_license_expiry','')::date,
    course_completion_date=nullif(p_payload->>'course_completion_date','')::date,competency_test_date=nullif(p_payload->>'competency_test_date','')::date,
    driving_license_number=nullif(p_payload->>'driving_license_number',''),driving_license_issue_date=nullif(p_payload->>'driving_license_issue_date','')::date,
    driving_license_authority=nullif(p_payload->>'driving_license_authority',''),remarks=nullif(p_payload->>'remarks',''),blood_group=nullif(p_payload->>'blood_group',''),
    updated_at=now()
  where id=p_register_id and (student_id=auth.uid() or (student_id is null and phone=coalesce(auth.jwt()->>'phone','')))
  returning id into v_id;
  if v_id is null then raise exception 'This mobile number is not linked to a register entry.'; end if;
  return v_id;
end;
$$;
grant execute on function public.student_update_register(uuid,jsonb) to authenticated;

notify pgrst, 'reload schema';
