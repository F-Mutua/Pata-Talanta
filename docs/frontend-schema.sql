-- Pata Talanta — video upload and heatmap tables used by the frontend.
--
-- Run AFTER pata-talanta-scout-access.sql (that script adds the consent
-- columns, contact_requests, player_contacts, notifications, profile_views
-- and scout access rules). This file only adds what that script does not:
-- match videos (+ storage bucket) and heatmaps. Safe to run twice.
--
-- Scout access follows the same rule as the scout-access script: an
-- approved scout_applications row, and the player has turned on
-- `discoverable`.

create or replace function public.is_approved_scout()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.scout_applications
    where applicant_id = auth.uid() and status = 'approved'
  );
$$;

create or replace function public.is_discoverable_player(p uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = p and role = 'player' and discoverable = true
  );
$$;

-- ---------------------------------------------------------------------------
-- Match videos
-- ---------------------------------------------------------------------------
create table if not exists public.match_videos (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles (id) on delete cascade,
  match_id uuid references public.matches (id) on delete set null,
  title text not null,
  description text,
  storage_path text not null unique,
  file_size_bytes bigint,
  processing_status text not null default 'uploaded'
    check (processing_status in ('uploaded', 'processing', 'processed', 'failed')),
  created_at timestamptz not null default now()
);
alter table public.match_videos enable row level security;

drop policy if exists "Players manage own videos" on public.match_videos;
create policy "Players manage own videos" on public.match_videos
  for all to authenticated
  using (player_id = auth.uid())
  with check (player_id = auth.uid() and processing_status = 'uploaded');

drop policy if exists "Approved scouts read videos" on public.match_videos;
create policy "Approved scouts read videos" on public.match_videos
  for select to authenticated
  using (public.is_approved_scout() and public.is_discoverable_player(player_id));

-- Private bucket; files are stored as <player uuid>/<random>.<ext>
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('match-videos', 'match-videos', false, 52428800,
        array['video/mp4', 'video/quicktime', 'video/webm'])
on conflict (id) do nothing;

drop policy if exists "Players upload to own folder" on storage.objects;
create policy "Players upload to own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'match-videos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Players read own videos" on storage.objects;
create policy "Players read own videos" on storage.objects
  for select to authenticated
  using (bucket_id = 'match-videos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Players delete own videos" on storage.objects;
create policy "Players delete own videos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'match-videos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Approved scouts read discoverable videos" on storage.objects;
create policy "Approved scouts read discoverable videos" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'match-videos'
    and public.is_approved_scout()
    and public.is_discoverable_player(((storage.foldername(name))[1])::uuid)
  );

-- ---------------------------------------------------------------------------
-- Heatmaps — written by the video pipeline (service role), read by the app.
-- intensities: JSON array of grid_rows arrays, each with grid_cols numbers >= 0.
-- Columns run goal-to-goal (col 0 = player's own goal), rows touchline to
-- touchline. Values need not be normalised; the UI scales to the maximum.
-- ---------------------------------------------------------------------------
create table if not exists public.player_heatmaps (
  id uuid primary key default gen_random_uuid(),
  match_player_id uuid not null unique references public.match_players (id) on delete cascade,
  grid_rows int not null check (grid_rows > 0),
  grid_cols int not null check (grid_cols > 0),
  intensities jsonb not null,
  data_source text not null default 'video_pipeline',
  created_at timestamptz not null default now()
);
alter table public.player_heatmaps enable row level security;

drop policy if exists "Players read own heatmaps" on public.player_heatmaps;
create policy "Players read own heatmaps" on public.player_heatmaps
  for select to authenticated using (
    exists (select 1 from public.match_players mp
            where mp.id = match_player_id and mp.player_id = auth.uid())
  );

drop policy if exists "Approved scouts read heatmaps" on public.player_heatmaps;
create policy "Approved scouts read heatmaps" on public.player_heatmaps
  for select to authenticated using (
    public.is_approved_scout() and exists (
      select 1 from public.match_players mp
      where mp.id = match_player_id and public.is_discoverable_player(mp.player_id)
    )
  );

-- Demo data: a heatmap for a player's first logged appearance (12 × 8 grid).
-- Replace the uuid, then uncomment to test the UI before the pipeline exists.
-- insert into public.player_heatmaps (match_player_id, grid_rows, grid_cols, intensities)
-- values ('<match_players.id>', 8, 12, '[
--   [0,0,1,1,2,2,1,1,0,0,0,0],[0,1,2,3,3,2,2,1,1,0,0,0],[0,1,3,5,6,5,4,3,2,1,0,0],
--   [0,2,4,7,9,8,6,5,3,2,1,0],[0,2,4,6,8,9,7,5,4,2,1,0],[0,1,3,5,6,6,5,4,3,2,1,0],
--   [0,1,2,3,3,4,3,2,2,1,0,0],[0,0,1,1,2,2,1,1,1,0,0,0]]'::jsonb);
