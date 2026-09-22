-- Run this AFTER creating the admin account in:
-- Supabase Dashboard -> Authentication -> Users
--
-- Replace the UUID below with that user's Auth UID.

insert into public.lesson_admins (user_id)
values ('YOUR-AUTH-USER-UUID-HERE')
on conflict (user_id) do nothing;

-- Verify:
select * from public.lesson_admins order by created_at desc;
