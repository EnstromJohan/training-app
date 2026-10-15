-- Body measurements, progress photos (metadata + private storage bucket) and mobility logs.

create table public.body_measurements (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id uuid not null,
  date date not null,
  weight_kg numeric,
  body_fat_pct numeric,
  muscle_mass_kg numeric,
  waist_cm numeric,
  chest_cm numeric,
  arm_cm numeric,
  thigh_cm numeric,
  hips_cm numeric,
  notes text,
  created_at text not null,
  updated_at text not null,
  deleted_at text,
  primary key (user_id, id)
);

create table public.progress_photos (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id uuid not null,
  date date not null,
  pose text not null check (pose in ('front', 'side', 'back')),
  width int not null,
  height int not null,
  storage_path text,
  created_at text not null,
  updated_at text not null,
  deleted_at text,
  primary key (user_id, id)
);

create table public.mobility_logs (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id uuid not null,
  date date not null,
  kind text not null check (kind in ('mobility', 'prehab')),
  item_ids jsonb not null default '[]',
  completed boolean not null,
  created_at text not null,
  updated_at text not null,
  deleted_at text,
  primary key (user_id, id)
);

create index on public.body_measurements (user_id, updated_at);
create index on public.progress_photos (user_id, updated_at);
create index on public.mobility_logs (user_id, updated_at);

do $$
declare t text;
begin
  foreach t in array array['body_measurements','progress_photos','mobility_logs']
  loop
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "own rows select" on public.%I for select using (auth.uid() = user_id)', t);
    execute format('create policy "own rows insert" on public.%I for insert with check (auth.uid() = user_id)', t);
    execute format('create policy "own rows update" on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;

-- Private bucket for progress photos: each user can only touch files under "<their user id>/".
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('progress-photos', 'progress-photos', false, 5242880, array['image/jpeg'])
on conflict (id) do nothing;

create policy "own photos select" on storage.objects for select to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own photos insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own photos update" on storage.objects for update to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own photos delete" on storage.objects for delete to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
