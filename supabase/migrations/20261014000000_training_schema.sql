-- Training history. Mirrors the app's local records (camelCase -> snake_case).
-- Logs are append-only from the app's point of view; deletion is soft (deleted_at).
-- Timestamps are stored as ISO text so they round-trip exactly with the client.

create table public.workout_sessions (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id uuid not null,
  date date not null,
  program_day_id text not null,
  status text not null check (status in ('in_progress', 'completed', 'skipped')),
  readiness jsonb,
  session_rpe numeric,
  deload boolean not null default false,
  started_at text not null,
  completed_at text,
  notes text,
  created_at text not null,
  updated_at text not null,
  deleted_at text,
  primary key (user_id, id)
);

create table public.session_exercises (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id uuid not null,
  session_id uuid not null,
  exercise_id text not null,
  slot_exercise_id text not null,
  position int not null,
  prescription jsonb not null,
  created_at text not null,
  updated_at text not null,
  deleted_at text,
  primary key (user_id, id)
);

create table public.set_logs (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id uuid not null,
  session_id uuid not null,
  session_exercise_id uuid not null,
  exercise_id text not null,
  set_index int not null,
  kind text not null check (kind in ('warmup', 'working')),
  target_weight numeric,
  target_reps int,
  target_rir_min int,
  target_rir_max int,
  weight numeric not null,
  reps int not null,
  rir int,
  technique_ok boolean not null default true,
  completed_at text not null,
  created_at text not null,
  updated_at text not null,
  deleted_at text,
  primary key (user_id, id)
);

create table public.cardio_sessions (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id uuid not null,
  date date not null,
  workout_session_id uuid,
  slot text not null check (slot in ('A', 'B', 'C')),
  kind text not null,
  modality text not null,
  duration_min numeric not null,
  completed boolean not null,
  rpe numeric not null,
  talk_test_ok boolean,
  intensity numeric,
  incline_pct numeric,
  distance_km numeric,
  avg_hr int,
  intervals jsonb,
  prescription jsonb,
  created_at text not null,
  updated_at text not null,
  deleted_at text,
  primary key (user_id, id)
);

create table public.rehab_logs (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id uuid not null,
  date date not null,
  phase int not null,
  level int not null,
  completed boolean not null,
  pain_during int not null check (pain_during between 0 and 10),
  pain_next_morning int check (pain_next_morning between 0 and 10),
  created_at text not null,
  updated_at text not null,
  deleted_at text,
  primary key (user_id, id)
);

create table public.calibrations (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id uuid not null,
  exercise_id text not null,
  date date not null,
  weight numeric not null,
  reps int not null,
  rir int not null,
  created_at text not null,
  updated_at text not null,
  deleted_at text,
  primary key (user_id, id)
);

create table public.settings (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id uuid not null,
  onboarded boolean not null default false,
  name text not null default '',
  birth_year int,
  body_weight_kg numeric,
  resting_hr int,
  max_hr int,
  experience text not null,
  goal text not null,
  equipment jsonb not null,
  rehab jsonb not null,
  substitutions jsonb not null default '{}',
  volume_modifiers jsonb not null default '{}',
  deload_weeks jsonb not null default '[]',
  cardio_preferred jsonb not null default '{}',
  created_at text not null,
  updated_at text not null,
  deleted_at text,
  primary key (user_id, id)
);

create index on public.workout_sessions (user_id, updated_at);
create index on public.session_exercises (user_id, updated_at);
create index on public.set_logs (user_id, updated_at);
create index on public.set_logs (user_id, exercise_id);
create index on public.cardio_sessions (user_id, updated_at);
create index on public.rehab_logs (user_id, updated_at);
create index on public.calibrations (user_id, updated_at);
create index on public.settings (user_id, updated_at);

-- Row level security: each user only sees and writes their own rows. No delete policy:
-- history can't be hard-deleted from the client.
do $$
declare t text;
begin
  foreach t in array array['workout_sessions','session_exercises','set_logs','cardio_sessions','rehab_logs','calibrations','settings']
  loop
    -- Explicit grants (works with "automatically expose new tables" off). No DELETE.
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "own rows select" on public.%I for select using (auth.uid() = user_id)', t);
    execute format('create policy "own rows insert" on public.%I for insert with check (auth.uid() = user_id)', t);
    execute format('create policy "own rows update" on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;
