/*
  IELTS Writing Platform - Supabase Schema (single-role version)

  Setup notes:
  1. Run this SQL in the Supabase SQL Editor (safe to re-run).
  2. Enable Realtime for `submissions` in Database > Replication, or run:
     alter publication supabase_realtime add table submissions;
  3. There is no role system anymore:
     - Anyone who is logged in (Supabase Auth) is treated as a "teacher" and can
       create tests and see/grade every submission.
     - Students never need an account. They open a test link, type their name,
       and the anti-cheat + timer flow kicks in. All student writes go through
       server API routes using the service-role key, so anonymous students never
       need direct table access — this keeps RLS simple.
*/

create extension if not exists pgcrypto;

-- Optional: lightweight profile row for teachers who log in (display name only).
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  created_at timestamptz not null default now()
);

-- Drop the old role column/constraint if this DB still has it (safe to run repeatedly).
alter table profiles drop column if exists role;

create table if not exists tests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  task1_prompt text not null default '',
  task2_prompt text not null default '',
  image_url text,
  duration_minutes integer not null default 60,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Migrate an existing `tests` table (old schema had `prompt`/`type` instead).
alter table tests add column if not exists task1_prompt text not null default '';
alter table tests add column if not exists task2_prompt text not null default '';
alter table tests add column if not exists image_url text;
alter table tests add column if not exists duration_minutes integer not null default 60;
alter table tests drop column if exists prompt;
alter table tests drop column if exists type;

create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references tests(id) on delete cascade,
  student_id uuid references profiles(id) on delete set null, -- null for anonymous students
  student_name text not null default 'Học sinh',
  content text not null default '',
  warning_count integer not null default 0 check (warning_count between 0 and 3),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'disqualified')),
  end_reason text check (end_reason in ('manual', 'timeout', 'disqualified')),
  band_score numeric(2, 1) check (band_score between 0 and 9),
  feedback jsonb,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  created_at timestamptz not null default now()
);

-- Migrate an existing `submissions` table.
alter table submissions add column if not exists student_name text not null default 'Học sinh';
alter table submissions add column if not exists end_reason text;
alter table submissions drop constraint if exists submissions_end_reason_check;
alter table submissions add constraint submissions_end_reason_check check (end_reason in ('manual', 'timeout', 'disqualified'));
alter table submissions alter column student_id drop not null;

create table if not exists warnings (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions(id) on delete cascade,
  reason text not null,
  warning_number integer not null check (warning_number between 1 and 3),
  created_at timestamptz not null default now()
);

-- Migrate an existing `warnings` table (old schema required student_id).
alter table warnings drop column if exists student_id;

create index if not exists submissions_status_idx on submissions(status);
create index if not exists submissions_test_id_idx on submissions(test_id);
create index if not exists warnings_submission_id_idx on warnings(submission_id);

-- Clean up every policy/function/trigger from the old role-based schema so this
-- script can be re-run safely against a database that still has them.
drop policy if exists "Users can read own profile, admins read all" on profiles;
drop policy if exists "Users can update own profile" on profiles;
drop policy if exists "Admins assign roles" on profiles;
drop policy if exists "Teachers and admins manage tests" on tests;
drop policy if exists "Authenticated users read tests" on tests;
drop policy if exists "Students create own submissions" on submissions;
drop policy if exists "Students read own submissions, teachers/admins read all" on submissions;
drop policy if exists "Students update own submissions, teachers/admins update all" on submissions;
drop policy if exists "Students insert own warnings" on warnings;
drop policy if exists "Students read own warnings, teachers/admins read all" on warnings;
drop trigger if exists prevent_non_admin_role_change on profiles;
drop function if exists prevent_non_admin_role_change();
drop function if exists is_admin();
drop function if exists is_teacher_or_admin();
drop function if exists is_teacher();

alter table profiles enable row level security;
alter table tests enable row level security;
alter table submissions enable row level security;
alter table warnings enable row level security;

-- profiles: every logged-in user can see/manage their own profile row only.
drop policy if exists "Users manage own profile" on profiles;
create policy "Users manage own profile" on profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- tests: anyone (including anonymous students opening a test link) can read tests.
-- Only logged-in users (teachers) can create/edit/delete tests.
drop policy if exists "Anyone can read tests" on tests;
create policy "Anyone can read tests" on tests
  for select using (true);

drop policy if exists "Authenticated users manage tests" on tests;
create policy "Authenticated users manage tests" on tests
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- submissions & warnings: students never talk to these tables directly.
-- All student writes (start / autosave / warning / submit) go through
-- Next.js API routes using the service-role key, which bypasses RLS.
-- Only logged-in users (teachers) can read submissions/warnings directly
-- for the live-monitoring dashboard.
drop policy if exists "Authenticated users read submissions" on submissions;
create policy "Authenticated users read submissions" on submissions
  for select using (auth.role() = 'authenticated');

drop policy if exists "Authenticated users read warnings" on warnings;
create policy "Authenticated users read warnings" on warnings
  for select using (auth.role() = 'authenticated');

-- No insert/update/delete policies for submissions/warnings on purpose:
-- anon and authenticated clients cannot write to these tables directly,
-- only the service-role key used inside the API routes can.
