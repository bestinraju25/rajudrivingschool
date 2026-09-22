-- Raju Driving School — Authorize an existing Supabase Auth user
-- 1) Create the user first in Supabase Dashboard → Authentication → Users.
-- 2) Copy that user's UUID.
-- 3) Replace YOUR_AUTH_USER_UUID below and run this script.

insert into public.lesson_admins (user_id)
values ('YOUR_AUTH_USER_UUID')
on conflict (user_id) do nothing;

-- Verify:
select * from public.lesson_admins
order by created_at desc;
