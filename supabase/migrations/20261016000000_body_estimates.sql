-- Height/sex for body-fat formulas (RFM), AI-photo consent, and AI body-fat estimates on photos.
alter table public.settings add column if not exists height_cm numeric;
alter table public.settings add column if not exists sex text check (sex in ('male', 'female'));
alter table public.settings add column if not exists ai_photo_consent boolean not null default false;
alter table public.progress_photos add column if not exists ai_estimate jsonb;
