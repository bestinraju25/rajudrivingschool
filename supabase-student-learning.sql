-- Raju Driving School: student learning + mock test scores
-- Run this AFTER the original supabase-schema.sql in Supabase SQL Editor.

create table if not exists public.student_mock_test_results (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  language text not null default 'english' check (language in ('english','malayalam')),
  score integer not null check (score >= 0 and score <= total_questions),
  total_questions integer not null default 30 check (total_questions > 0),
  pass_mark integer not null default 18 check (pass_mark > 0),
  passed boolean not null,
  completed_at timestamptz not null default now()
);

create index if not exists student_mock_test_results_student_completed_idx
on public.student_mock_test_results (student_id, completed_at desc);

alter table public.student_mock_test_results enable row level security;

drop policy if exists "Students can view own mock test results"
on public.student_mock_test_results;
create policy "Students can view own mock test results"
on public.student_mock_test_results
for select
to authenticated
using (auth.uid() = student_id);

drop policy if exists "Students can record own mock test results"
on public.student_mock_test_results;
create policy "Students can record own mock test results"
on public.student_mock_test_results
for insert
to authenticated
with check (auth.uid() = student_id);
