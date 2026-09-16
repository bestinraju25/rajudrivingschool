-- RAJU HPT — Supabase schema
-- This schema stores ONLY small HPT metadata/results. Video binaries stay in GitHub/static hosting.

create extension if not exists pgcrypto;

create table if not exists public.hpt_videos (
  id uuid primary key default gen_random_uuid(),
  clip_code text not null unique,
  title text not null,
  video_path text not null,
  duration_seconds numeric(8,2) default 50,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hpt_hazards (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.hpt_videos(id) on delete cascade,
  hazard_no integer not null check (hazard_no between 1 and 2),
  timestamp_seconds numeric(8,2) not null check (timestamp_seconds >= 0),
  label text,
  created_at timestamptz not null default now(),
  unique(video_id, hazard_no)
);

create table if not exists public.hpt_attempts (
  id uuid primary key default gen_random_uuid(),
  candidate_name text not null,
  phone text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  total_score integer not null default 0 check (total_score between 0 and 100),
  passed boolean,
  clip_order jsonb not null default '[]'::jsonb
);

create table if not exists public.hpt_responses (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.hpt_attempts(id) on delete cascade,
  video_id uuid references public.hpt_videos(id) on delete set null,
  response_no integer not null,
  click_time_seconds numeric(8,2) not null,
  hazard_no integer,
  awarded_marks integer not null default 0 check (awarded_marks between 0 and 5),
  created_at timestamptz not null default now()
);

create index if not exists hpt_hazards_video_idx on public.hpt_hazards(video_id);
create index if not exists hpt_attempts_date_idx on public.hpt_attempts(started_at desc);
create index if not exists hpt_responses_attempt_idx on public.hpt_responses(attempt_id);

alter table public.hpt_videos enable row level security;
alter table public.hpt_hazards enable row level security;
alter table public.hpt_attempts enable row level security;
alter table public.hpt_responses enable row level security;

-- Candidate side: read only active video metadata/hazards; submit attempts/responses.
create policy "hpt active videos public read" on public.hpt_videos for select using (active = true);
create policy "hpt hazards public read" on public.hpt_hazards for select using (exists (select 1 from public.hpt_videos v where v.id = video_id and v.active = true));
create policy "hpt attempts public insert" on public.hpt_attempts for insert with check (true);
create policy "hpt responses public insert" on public.hpt_responses for insert with check (true);

-- Admin reads/changes should be done through authenticated users who are present in admin_users.
-- If your existing admin_users table is already protected, use the policies below.
create policy "hpt admin authenticated read videos" on public.hpt_videos for select to authenticated using (true);
create policy "hpt admin authenticated insert videos" on public.hpt_videos for insert to authenticated with check (true);
create policy "hpt admin authenticated update videos" on public.hpt_videos for update to authenticated using (true) with check (true);
create policy "hpt admin authenticated delete videos" on public.hpt_videos for delete to authenticated using (true);
create policy "hpt admin authenticated read hazards" on public.hpt_hazards for select to authenticated using (true);
create policy "hpt admin authenticated insert hazards" on public.hpt_hazards for insert to authenticated with check (true);
create policy "hpt admin authenticated update hazards" on public.hpt_hazards for update to authenticated using (true) with check (true);
create policy "hpt admin authenticated delete hazards" on public.hpt_hazards for delete to authenticated using (true);
create policy "hpt admin authenticated read attempts" on public.hpt_attempts for select to authenticated using (true);
create policy "hpt admin authenticated read responses" on public.hpt_responses for select to authenticated using (true);

-- Seed the currently available 10 static clips. Run only after videos exist in GitHub/static hosting.
-- Change video_path to the exact public path on your deployed site if needed.

-- Optional seed: current bundled 10 clips + the reviewed hazard timestamps.
-- video_path is relative to the deployed site root.
do $$
declare v uuid;
begin
  for v in select id from public.hpt_videos where clip_code in ('01','02','03','04','05','06','07','08','09','10') loop
    delete from public.hpt_hazards where video_id=v;
  end loop;
  insert into public.hpt_videos (clip_code,title,video_path,duration_seconds,active) values
  ('01','Hazard Perception Clip 01','videos/1.webm',50,true),
  ('02','Hazard Perception Clip 02','videos/2.webm',50,true),
  ('03','Hazard Perception Clip 03','videos/3.webm',50,true),
  ('04','Hazard Perception Clip 04','videos/4.webm',50,true),
  ('05','Hazard Perception Clip 05','videos/5.webm',50,true),
  ('06','Hazard Perception Clip 06','videos/6.webm',50,true),
  ('07','Hazard Perception Clip 07','videos/7.webm',50,true),
  ('08','Hazard Perception Clip 08','videos/8.webm',50,true),
  ('09','Hazard Perception Clip 09','videos/9.webm',50,true),
  ('10','Hazard Perception Clip 10','videos/10.webm',50,true)
  on conflict (clip_code) do update set title=excluded.title,video_path=excluded.video_path,duration_seconds=excluded.duration_seconds,active=true;
  insert into public.hpt_hazards(video_id,hazard_no,timestamp_seconds,label)
  select id,1,22,'Oncoming vehicle conflict' from public.hpt_videos where clip_code='01' union all
  select id,2,30,'Vehicle approaching tunnel' from public.hpt_videos where clip_code='01' union all
  select id,1,9,'Vehicle conflict at junction' from public.hpt_videos where clip_code='02' union all
  select id,2,35,'Cyclist developing hazard' from public.hpt_videos where clip_code='02' union all
  select id,1,6,'Vehicle emerging from side road' from public.hpt_videos where clip_code='03' union all
  select id,2,24,'Vehicle crossing / converging' from public.hpt_videos where clip_code='03' union all
  select id,1,32,'Large vehicle entering / converging' from public.hpt_videos where clip_code='04' union all
  select id,2,38,'Pedestrian crossing' from public.hpt_videos where clip_code='04' union all
  select id,1,14,'Van approaching close' from public.hpt_videos where clip_code='05' union all
  select id,2,35,'Large tractor passing close' from public.hpt_videos where clip_code='05' union all
  select id,1,7,'Vehicle emerging from side road' from public.hpt_videos where clip_code='06' union all
  select id,2,34,'Cyclist / vehicle conflict' from public.hpt_videos where clip_code='06' union all
  select id,1,2,'Roadworks / refuge obstruction' from public.hpt_videos where clip_code='07' union all
  select id,2,47,'Cyclist close to lane' from public.hpt_videos where clip_code='07' union all
  select id,1,32,'Truck moving into lane' from public.hpt_videos where clip_code='08' union all
  select id,2,39,'Large vehicle passing close' from public.hpt_videos where clip_code='08' union all
  select id,1,7,'Vehicle crossing from side road' from public.hpt_videos where clip_code='09' union all
  select id,2,37,'Large vehicle crossing' from public.hpt_videos where clip_code='09' union all
  select id,1,8,'Oncoming vehicle conflict' from public.hpt_videos where clip_code='10' union all
  select id,2,42,'Pedestrian / roadside conflict' from public.hpt_videos where clip_code='10';
end $$;
