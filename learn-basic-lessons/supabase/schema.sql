-- Raju Driving School / basic_lesson_class
-- Supabase setup: run this whole file in Supabase SQL Editor.
-- This extension reuses your existing Supabase project. No service-role key belongs in the frontend.

create extension if not exists pgcrypto;

create table if not exists public.lesson_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_lesson_admin(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.lesson_admins where user_id = p_user_id);
$$;

revoke all on function public.is_lesson_admin(uuid) from public;
grant execute on function public.is_lesson_admin(uuid) to anon, authenticated;

create table if not exists public.lesson_categories (
  id text primary key,
  name_en text not null,
  name_ml text not null,
  display_order integer not null default 0,
  is_active boolean not null default true
);

create table if not exists public.lesson_signs (
  sign_id text primary key,
  category_id text not null references public.lesson_categories(id) on update cascade,
  shape text not null default 'Sign',
  visual_type text,
  visual_key text,
  title_en text not null,
  title_ml text not null,
  rule_en text not null default '',
  rule_ml text not null default '',
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lesson_media (
  sign_id text primary key references public.lesson_signs(sign_id) on delete cascade,
  photo_path text,
  video_path text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create or replace function public.touch_lesson_sign() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists trg_touch_lesson_sign on public.lesson_signs;
create trigger trg_touch_lesson_sign before update on public.lesson_signs for each row execute function public.touch_lesson_sign();

alter table public.lesson_admins enable row level security;
alter table public.lesson_categories enable row level security;
alter table public.lesson_signs enable row level security;
alter table public.lesson_media enable row level security;

drop policy if exists "lesson categories public read" on public.lesson_categories;
create policy "lesson categories public read" on public.lesson_categories for select using (is_active = true);
drop policy if exists "lesson categories admin write" on public.lesson_categories;
create policy "lesson categories admin write" on public.lesson_categories for all to authenticated using (public.is_lesson_admin()) with check (public.is_lesson_admin());

drop policy if exists "lesson signs public read" on public.lesson_signs;
create policy "lesson signs public read" on public.lesson_signs for select using (is_active = true);
drop policy if exists "lesson signs admin write" on public.lesson_signs;
create policy "lesson signs admin write" on public.lesson_signs for all to authenticated using (public.is_lesson_admin()) with check (public.is_lesson_admin());

drop policy if exists "lesson media public read" on public.lesson_media;
create policy "lesson media public read" on public.lesson_media for select using (true);
drop policy if exists "lesson media admin write" on public.lesson_media;
create policy "lesson media admin write" on public.lesson_media for all to authenticated using (public.is_lesson_admin()) with check (public.is_lesson_admin());

insert into public.lesson_categories(id,name_en,name_ml,display_order) values
('signals','Traffic Signals','ട്രാഫിക് സിഗ്നലുകൾ',1),
('mandatory','Mandatory / Regulatory','നിർബന്ധിത / നിയന്ത്രണ അടയാളങ്ങൾ',2),
('cautionary','Cautionary / Warning','മുന്നറിയിപ്പ് അടയാളങ്ങൾ',3),
('informatory','Informatory','വിവരാത്മക അടയാളങ്ങൾ',4),
('roadmarking','Road Markings','റോഡ് മാർക്കിംഗുകൾ',5)
on conflict (id) do update set name_en=excluded.name_en,name_ml=excluded.name_ml,display_order=excluded.display_order;

insert into public.lesson_signs(sign_id,category_id,shape,visual_type,visual_key,title_en,title_ml,rule_en,rule_ml,display_order) values
('sig_red','signals','Signal','signal','red','Red Traffic Signal','ചുവപ്പ് ട്രാഫിക് സിഗ്നൽ','Stop before the stop line and remain stopped until the signal changes.','ചുവപ്പ് സിഗ്നൽ തെളിയുമ്പോൾ സ്റ്റോപ്പ് ലൈനിന് മുമ്പിൽ വാഹനം പൂർണ്ണമായി നിർത്തണം. പച്ച സിഗ്നൽ ലഭിക്കുന്നതുവരെ കാത്തിരിക്കുക.',1),
('sig_yellow','signals','Signal','signal','yellow','Amber / Yellow Traffic Signal','മഞ്ഞ ട്രാഫിക് സിഗ്നൽ','Proceed only when safe; prepare to stop unless you have already crossed the stop line.','മഞ്ഞ സിഗ്നൽ തെളിയുമ്പോൾ നിർത്താൻ തയ്യാറാകണം. സുരക്ഷിതമായി മാത്രമേ മുന്നോട്ട് പോകാവൂ.',2),
('sig_green','signals','Signal','signal','green','Green Traffic Signal','പച്ച ട്രാഫിക് സിഗ്നൽ','Proceed when the junction is clear and it is safe to move.','പച്ച സിഗ്നൽ തെളിയുമ്പോൾ ജംഗ്ഷൻ സുരക്ഷിതമാണെന്ന് ഉറപ്പാക്കി മുന്നോട്ട് പോകാം.',3),
('sig_ped','signals','Pedestrian Signal','signal','green','Pedestrian Crossing Signal','കാൽനട സിഗ്നൽ','Follow the pedestrian signal and give pedestrians the protection and priority required at crossings.','കാൽനട സിഗ്നൽ ശ്രദ്ധിക്കുക. കാൽനടക്കാർക്ക് റോഡ് സുരക്ഷിതമായി മുറിച്ചുകടക്കാൻ ആവശ്യമായ അവസരം നൽകണം.',4),
('man_01','mandatory','Octagonal','stop','','Stop','നിർത്തുക','Bring the vehicle to a complete halt before the stop line and proceed only when safe.','സ്റ്റോപ്പ് ലൈനിന് മുമ്പിൽ വാഹനം പൂർണ്ണമായി നിർത്തണം. സുരക്ഷിതമാണെന്ന് ഉറപ്പാക്കിയ ശേഷം മാത്രമേ മുന്നോട്ട് പോകാവൂ.',5),
('man_02','mandatory','Inverted Triangle','triangle','','Give Way','വഴി കൊടുക്കുക','Yield to traffic that has priority before entering or crossing the road.','മുൻഗണനയുള്ള വാഹനങ്ങൾക്ക് ആദ്യം വഴി നൽകണം. സുരക്ഷിതമാണെന്ന് ഉറപ്പാക്കിയ ശേഷം മാത്രമേ റോഡിലേക്ക് പ്രവേശിക്കാവൂ.',6),
('man_03','mandatory','Circular','noentry','','No Entry','പ്രവേശനമില്ല','Vehicles must not enter the road or lane beyond this sign.','ഈ അടയാളത്തിന് ശേഷം ഈ റോഡിലേക്കോ ലെയിനിലേക്കോ വാഹനങ്ങൾ പ്രവേശിക്കരുത്.',7),
('man_04','mandatory','Circular','noright','','No Right Turn','വലത്തോട്ട് തിരിയരുത്','Do not make a right turn at the location indicated.','ഈ സ്ഥലത്ത് വാഹനം വലത്തോട്ട് തിരിക്കാൻ പാടില്ല.',8),
('man_05','mandatory','Circular','noleft','','No Left Turn','ഇടത്തോട്ട് തിരിയരുത്','Do not make a left turn at the location indicated.','ഈ സ്ഥലത്ത് വാഹനം ഇടത്തോട്ട് തിരിക്കാൻ പാടില്ല.',9),
('man_06','mandatory','Circular','no_u','','No U-Turn','യൂ-ടേൺ പാടില്ല','U-turns are prohibited at this location.','ഈ സ്ഥലത്ത് വാഹനം യൂ-ടേൺ എടുക്കാൻ പാടില്ല.',10),
('man_07','mandatory','Circular','speed','30','Speed Limit 30 km/h','വേഗപരിധി 30 കി.മീ/മണിക്കൂർ','Do not drive faster than the displayed speed limit.','അടയാളത്തിൽ കാണിച്ചിരിക്കുന്ന വേഗപരിധിയിൽ കൂടുതലായി വാഹനം ഓടിക്കരുത്.',11),
('man_08','mandatory','Circular','speed','40','Speed Limit 40 km/h','വേഗപരിധി 40 കി.മീ/മണിക്കൂർ','Do not exceed 40 km/h unless another lawful limit applies.','മറ്റൊരു നിയമപരമായ വേഗപരിധി ബാധകമല്ലെങ്കിൽ മണിക്കൂറിൽ 40 കി.മീ കവിയരുത്.',12),
('man_09','mandatory','Circular','speed','50','Speed Limit 50 km/h','വേഗപരിധി 50 കി.മീ/മണിക്കൂർ','Do not exceed the posted 50 km/h limit.','അടയാളപ്പെടുത്തിയ 50 കി.മീ/മണിക്കൂർ വേഗപരിധി കവിയരുത്.',13),
('man_10','mandatory','Circular','speed','60','Speed Limit 60 km/h','വേഗപരിധി 60 കി.മീ/മണിക്കൂർ','Do not exceed the posted 60 km/h limit.','അടയാളപ്പെടുത്തിയ 60 കി.മീ/മണിക്കൂർ വേഗപരിധി കവിയരുത്.',14),
('man_11','mandatory','Circular','nopark','','No Parking','പാർക്കിംഗ് പാടില്ല','Do not park the vehicle in the restricted area indicated by this sign.','ഈ അടയാളം കാണുന്ന നിയന്ത്രിത സ്ഥലത്ത് വാഹനം പാർക്ക് ചെയ്യരുത്.',15),
('man_12','mandatory','Circular','nostop','','No Stopping','നിർത്തലും പാടില്ല','Stopping is prohibited except where specifically permitted.','അനുവദിച്ചിട്ടില്ലാത്തിടത്ത് വാഹനം നിർത്താൻ പാടില്ല.',16),
('man_13','mandatory','Circular','overtake','','No Overtaking','ഓവർടേക്ക് ചെയ്യരുത്','Do not overtake other vehicles in the restricted section.','ഈ നിയന്ത്രിത ഭാഗത്ത് മറ്റൊരു വാഹനത്തെ ഓവർടേക്ക് ചെയ്യരുത്.',17),
('man_14','mandatory','Circular','horn','','Horn Prohibited','ഹോൺ ഉപയോഗിക്കരുത്','Avoid using the horn in the area covered by the restriction.','ഈ നിയന്ത്രിത മേഖലയിലെത്തിയാൽ ഹോൺ മുഴക്കരുത്.',18),
('man_15','mandatory','Circular','left','','Compulsory Keep Left','ഇടതുവശം ചേർന്ന് പോകുക','Keep the vehicle to the left side as directed.','അടയാളം നിർദ്ദേശിക്കുന്ന രീതിയിൽ റോഡിന്റെ ഇടതുവശം ചേർന്ന് വാഹനം ഓടിക്കണം.',19),
('man_16','mandatory','Circular','ahead','','Compulsory Ahead Only','മുന്നോട്ട് മാത്രം','Traffic must proceed straight ahead in the indicated direction.','വാഹനം നിർദ്ദേശിച്ച ദിശയിൽ നേരെ മുന്നോട്ട് മാത്രമേ പോകാവൂ.',20),
('man_17','mandatory','Circular','right','','Compulsory Turn Right','വലത്തോട്ട് തിരിയുക','Turn right in the direction indicated by the sign.','അടയാളം കാണിക്കുന്ന ദിശയിൽ വലത്തോട്ട് തിരിയണം.',21),
('man_18','mandatory','Circular','leftturn','','Compulsory Turn Left','ഇടത്തോട്ട് തിരിയുക','Turn left in the direction indicated by the sign.','അടയാളം കാണിക്കുന്ന ദിശയിൽ ഇടത്തോട്ട് തിരിയണം.',22),
('man_19','mandatory','Circular','cycle','','Compulsory Cycle Track','നിർബന്ധിത സൈക്കിൾ പാത','Cycles must use the designated cycle path where provided.','നിർദ്ദേശിച്ച സൈക്കിൾ പാത ലഭ്യമാണെങ്കിൽ സൈക്കിൾ അതിലൂടെ തന്നെ സഞ്ചരിക്കണം.',23),
('caut_01','cautionary','Triangular','triangle','ped','Pedestrian Crossing Ahead','മുന്നിൽ കാൽനട ക്രോസിംഗ്','Slow down and be prepared to give way to pedestrians at the crossing.','മുന്നിൽ കാൽനട ക്രോസിംഗ് ഉണ്ടാകാം. വേഗത കുറച്ച് കാൽനടക്കാർക്ക് സുരക്ഷിതമായി വഴി നൽകാൻ തയ്യാറാകണം.',24),
('caut_02','cautionary','Triangular','triangle','hump','Speed Breaker / Hump Ahead','മുന്നിൽ സ്പീഡ് ബ്രേക്കർ','Reduce speed and cross the hump smoothly.','മുന്നിൽ സ്പീഡ് ബ്രേക്കർ ഉണ്ട്. വേഗത കുറച്ച് നിയന്ത്രിതമായി കടന്നുപോകണം.',25),
('caut_03','cautionary','Triangular','triangle','curveR','Right Hand Curve','വലത് വളവ്','A curve is ahead. Reduce speed and maintain lane position.','മുന്നിൽ വലത് വളവുണ്ട്. വേഗത കുറച്ച് സ്വന്തം ലെയിനിൽ സുരക്ഷിതമായി തുടരുക.',26),
('caut_04','cautionary','Triangular','triangle','curveL','Left Hand Curve','ഇടത് വളവ്','A curve is ahead. Reduce speed and maintain lane position.','മുന്നിൽ ഇടത് വളവുണ്ട്. വേഗത കുറച്ച് സ്വന്തം ലെയിനിൽ സുരക്ഷിതമായി തുടരുക.',27),
('caut_05','cautionary','Triangular','triangle','school','School Ahead','മുന്നിൽ സ്കൂൾ','Children may be crossing. Slow down and watch carefully.','മുന്നിൽ സ്കൂൾ പ്രദേശമാണ്. കുട്ടികൾ റോഡ് മുറിച്ചുകടക്കാൻ സാധ്യതയുള്ളതിനാൽ വേഗത കുറച്ച് ശ്രദ്ധയോടെ ഓടിക്കുക.',28),
('caut_06','cautionary','Triangular','triangle','work','Men at Work','മുന്നിൽ റോഡ് പണി','Road works may be in progress. Slow down and follow temporary controls.','മുന്നിൽ റോഡ് പണി നടക്കാം. വേഗത കുറച്ച് താൽക്കാലിക ഗതാഗത നിയന്ത്രണങ്ങൾ പാലിക്കുക.',29),
('caut_07','cautionary','Triangular','triangle','narrow','Narrow Bridge','ഇടുങ്ങിയ പാലം','The road or bridge narrows ahead. Slow down and pass carefully.','മുന്നിൽ ഇടുങ്ങിയ പാലമാണ്. വേഗത കുറച്ച് സുരക്ഷിതമായി കടന്നുപോകണം.',30),
('caut_08','cautionary','Triangular','triangle','roadnarrow','Road Narrows Ahead','മുന്നിൽ റോഡ് ഇടുങ്ങുന്നു','The carriageway becomes narrower ahead. Adjust speed and road position.','മുന്നിൽ റോഡ് ഇടുങ്ങുന്നു. വേഗതയും വാഹനത്തിന്റെ സ്ഥാനവും നിയന്ത്രിക്കുക.',31),
('caut_09','cautionary','Triangular','triangle','cross','Cross Road Ahead','മുന്നിൽ ക്രോസ് റോഡ്','Cross traffic may be encountered. Approach the junction carefully.','മുന്നിൽ ക്രോസ് റോഡ് ജംഗ്ഷൻ ഉണ്ടാകാം. വേഗത കുറച്ച് ശ്രദ്ധയോടെ സമീപിക്കുക.',32),
('caut_10','cautionary','Triangular','triangle','T','T-Intersection Ahead','മുന്നിൽ ടി ജംഗ്ഷൻ','The road ends at a T-junction. Be prepared to turn and give way as required.','മുന്നിൽ ടി ജംഗ്ഷനാണ്. തിരിയാനുള്ള തയ്യാറെടുപ്പോടെ വേഗത കുറച്ച് ആവശ്യമായിടത്ത് വഴി നൽകുക.',33),
('caut_11','cautionary','Triangular','triangle','Y','Y-Intersection Ahead','മുന്നിൽ വൈ ജംഗ്ഷൻ','The road branches ahead. Slow down and choose the correct route.','മുന്നിൽ വൈ ആകൃതിയിലുള്ള ജംഗ്ഷനാണ്. വേഗത കുറച്ച് ശരിയായ വഴി തിരഞ്ഞെടുക്കുക.',34),
('caut_12','cautionary','Triangular','triangle','round','Roundabout Ahead','മുന്നിൽ റൗണ്ടബൗട്ട്','Slow down and follow the roundabout circulation and priority rules.','മുന്നിൽ റൗണ്ടബൗട്ടാണ്. വേഗത കുറച്ച് റൗണ്ടബൗട്ടിലെ മുൻഗണനയും സഞ്ചാരനിയമങ്ങളും പാലിക്കുക.',35),
('caut_13','cautionary','Triangular','triangle','rail','Railway Crossing Ahead','മുന്നിൽ റെയിൽവേ ക്രോസിംഗ്','A railway crossing is ahead. Slow down, look, and cross only when it is safe.','മുന്നിൽ റെയിൽവേ ക്രോസിംഗാണ്. വേഗത കുറച്ച് ഇരുവശവും നോക്കി സുരക്ഷിതമാണെന്ന് ഉറപ്പാക്കിയ ശേഷം മാത്രം കടക്കുക.',36),
('caut_14','cautionary','Triangular','triangle','slippery','Slippery Road','തെന്നുന്ന റോഡ്','The road surface may be slippery. Reduce speed and avoid sudden braking or steering.','റോഡ് തെന്നാൻ സാധ്യതയുണ്ട്. വേഗത കുറച്ച് പെട്ടെന്ന് ബ്രേക്ക് ചെയ്യുകയോ സ്റ്റിയറിംഗ് മാറ്റുകയോ ചെയ്യരുത്.',37),
('caut_15','cautionary','Triangular','triangle','rock','Falling Rocks','പാറകൾ വീഴാൻ സാധ്യത','Rocks or debris may fall onto the roadway. Proceed carefully.','റോഡിലേക്ക് പാറകളോ മണ്ണോ വീഴാൻ സാധ്യതയുണ്ട്. അതീവ ശ്രദ്ധയോടെ സഞ്ചരിക്കുക.',38),
('caut_16','cautionary','Triangular','triangle','animal','Animal Crossing','മൃഗങ്ങൾ കടന്നുപോകുന്ന സ്ഥലം','Animals may enter the road. Slow down and stay alert.','മൃഗങ്ങൾ റോഡിലേക്ക് കടന്നുവരാൻ സാധ്യതയുണ്ട്. വേഗത കുറച്ച് ജാഗ്രതയോടെ ഓടിക്കുക.',39),
('info_01','informatory','Rectangular','info','H','Hospital','ആശുപത്രി','Hospital facilities are nearby. Avoid unnecessary horn use and drive quietly.','സമീപത്ത് ആശുപത്രിയുണ്ട്. അനാവശ്യമായി ഹോൺ മുഴക്കാതെ ശാന്തമായി വാഹനം ഓടിക്കുക.',40),
('info_02','informatory','Rectangular','info','P','Parking','പാർക്കിംഗ്','Parking is available or permitted in the indicated area, subject to local restrictions.','അടയാളം കാണിക്കുന്ന സ്ഥലത്ത് പാർക്കിംഗ് അനുവദിച്ചിരിക്കാം. പ്രാദേശിക നിയന്ത്രണങ്ങൾ കൂടി പാലിക്കുക.',41),
('info_03','informatory','Rectangular','info','⛽','Petrol Pump','പെട്രോൾ പമ്പ്','Fuel station is available nearby.','സമീപത്ത് ഇന്ധന സ്റ്റേഷൻ ലഭ്യമാണ്.',42),
('info_04','informatory','Rectangular','info','☎','Telephone','ടെലിഫോൺ','A public telephone or telephone facility is available nearby.','സമീപത്ത് ടെലിഫോൺ സൗകര്യം ലഭ്യമാണ്.',43),
('info_05','informatory','Rectangular','info','B','Bus Stop','ബസ് സ്റ്റോപ്പ്','A designated bus stopping point is nearby.','സമീപത്ത് നിശ്ചിത ബസ് സ്റ്റോപ്പ് ഉണ്ട്.',44),
('info_06','informatory','Rectangular','info','F','First Aid','പ്രഥമ ശുശ്രൂഷ','First-aid assistance is available nearby.','സമീപത്ത് പ്രഥമ ശുശ്രൂഷാ സൗകര്യം ലഭ്യമാണ്.',45),
('info_07','informatory','Rectangular','info','R','Rest Area','വിശ്രമ കേന്ദ്രം','A rest facility is available nearby.','സമീപത്ത് വിശ്രമിക്കാനുള്ള സൗകര്യം ലഭ്യമാണ്.',46),
('info_08','informatory','Rectangular','info','🍴','Restaurant / Refreshment','ഭക്ഷണശാല','Food or refreshments are available nearby.','സമീപത്ത് ഭക്ഷണവും പാനീയങ്ങളും ലഭിക്കുന്ന സൗകര്യമുണ്ട്.',47),
('info_09','informatory','Rectangular','info','WC','Public Toilet','പൊതു ശൗചാലയം','Public toilet facilities are available nearby.','സമീപത്ത് പൊതു ശൗചാലയ സൗകര്യം ലഭ്യമാണ്.',48),
('info_10','informatory','Rectangular','info','🚉','Railway Station','റെയിൽവേ സ്റ്റേഷൻ','A railway station is located nearby.','സമീപത്ത് റെയിൽവേ സ്റ്റേഷൻ സ്ഥിതി ചെയ്യുന്നു.',49),
('rm_01','roadmarking','Road Marking','roadmark','stopline','Stop Line','സ്റ്റോപ്പ് ലൈൻ','Stop the vehicle before the marked line when required by the traffic control.','ട്രാഫിക് നിയന്ത്രണം ആവശ്യപ്പെടുമ്പോൾ അടയാളപ്പെടുത്തിയ ലൈനിന് മുമ്പിൽ വാഹനം നിർത്തണം.',50),
('rm_02','roadmarking','Road Marking','roadmark','solid','Solid Centre Line','തുടർച്ചയായ മധ്യരേഖ','Do not cross the line except where a lawful manoeuvre is permitted.','നിയമപരമായി അനുവദിച്ചിട്ടില്ലെങ്കിൽ ഈ തുടർച്ചയായ മധ്യരേഖ മുറിച്ചുകടക്കരുത്.',51),
('rm_03','roadmarking','Road Marking','roadmark','broken','Broken Centre Line','തുടർച്ചയില്ലാത്ത മധ്യരേഖ','The line may be crossed when safe and permitted, with due care.','സുരക്ഷിതവും അനുവദനീയവുമായ സാഹചര്യത്തിൽ മാത്രം ആവശ്യമായ മുൻകരുതലോടെ ഈ രേഖ മുറിച്ചുകടക്കാം.',52),
('rm_04','roadmarking','Road Marking','roadmark','zebra','Zebra Crossing','സീബ്ര ക്രോസിംഗ്','Slow down and give pedestrians the required opportunity to cross safely.','സീബ്ര ക്രോസിംഗിന് സമീപം വേഗത കുറച്ച് കാൽനടക്കാർക്ക് സുരക്ഷിതമായി മുറിച്ചുകടക്കാൻ അവസരം നൽകണം.',53)
on conflict (sign_id) do update set category_id=excluded.category_id,shape=excluded.shape,visual_type=excluded.visual_type,visual_key=excluded.visual_key,title_en=excluded.title_en,title_ml=excluded.title_ml,rule_en=excluded.rule_en,rule_ml=excluded.rule_ml,display_order=excluded.display_order;

-- Public bucket for classroom media. Read access is public; uploads/deletes are admin-only.
insert into storage.buckets (id, name, public) values ('lesson-media','lesson-media',true)
on conflict (id) do update set public = true;

drop policy if exists "lesson media storage read" on storage.objects;
create policy "lesson media storage read" on storage.objects for select using (bucket_id = 'lesson-media');
drop policy if exists "lesson media storage admin insert" on storage.objects;
create policy "lesson media storage admin insert" on storage.objects for insert to authenticated with check (bucket_id = 'lesson-media' and public.is_lesson_admin());
drop policy if exists "lesson media storage admin update" on storage.objects;
create policy "lesson media storage admin update" on storage.objects for update to authenticated using (bucket_id = 'lesson-media' and public.is_lesson_admin()) with check (bucket_id = 'lesson-media' and public.is_lesson_admin());
drop policy if exists "lesson media storage admin delete" on storage.objects;
create policy "lesson media storage admin delete" on storage.objects for delete to authenticated using (bucket_id = 'lesson-media' and public.is_lesson_admin());

-- After creating an Admin user in Supabase Authentication, add that user's UUID here:
-- insert into public.lesson_admins(user_id) values ('YOUR_AUTH_USER_UUID') on conflict do nothing;

-- Optional helper: see existing admin UUIDs
-- select * from public.lesson_admins;