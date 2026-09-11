-- RAJU DRIVING SCHOOL — DIGITAL STUDENT REGISTER
-- Enable students to view/edit their own Form 15 driving-hour rows.
-- Run once after the existing student-register-repair-v3.sql / migration.
-- Defensive Driving Seminar objects are not referenced.

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

  if jsonb_typeof(coalesce(p_payload->'driving_hours','[]'::jsonb))='array' then
    delete from public.student_driving_hours where student_register_id=v_id;
    insert into public.student_driving_hours(student_register_id,date,from_time,to_time,vehicle_class)
    select v_id,
      nullif(x->>'date','')::date,
      nullif(x->>'from_time','')::time,
      nullif(x->>'to_time','')::time,
      nullif(trim(coalesce(x->>'vehicle_class','')), '')
    from jsonb_array_elements(p_payload->'driving_hours') x
    where nullif(x->>'date','') is not null
       or nullif(x->>'from_time','') is not null
       or nullif(x->>'to_time','') is not null
       or nullif(trim(coalesce(x->>'vehicle_class','')), '') is not null;
  end if;

  return v_id;
end;
$$;

grant execute on function public.student_register_update(text,date,jsonb) to anon,authenticated;
notify pgrst,'reload schema';
