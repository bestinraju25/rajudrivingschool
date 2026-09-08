-- RAJU DRIVING SCHOOL — ADMIN STUDENT DATA ACCESS
-- Run once in Supabase SQL Editor after the student portal repair.
-- Allows authenticated admins to inspect learner progress and mock-test history.

alter table public.student_learning_progress enable row level security;
drop policy if exists "Admins view all learning progress" on public.student_learning_progress;
create policy "Admins view all learning progress"
on public.student_learning_progress
for select to authenticated
using (public.is_admin());

alter table public.student_mock_test_attempts enable row level security;
drop policy if exists "Admins view all mock attempts" on public.student_mock_test_attempts;
create policy "Admins view all mock attempts"
on public.student_mock_test_attempts
for select to authenticated
using (public.is_admin());

notify pgrst, 'reload schema';

select 'Admin student dashboard access installed successfully.' as result;
