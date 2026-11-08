-- Pata Talanta — scouts without review.
--
-- Rule: anyone who signs up as a scout is a scout. Scouts can see only
-- players who turned on `discoverable`. No BCF approval is needed.
--
-- Run AFTER pata-talanta-scout-access.sql. Policies here are added alongside
-- the "approved scout" ones from that script (Postgres ORs permissive
-- policies), so nothing existing is removed. Safe to run twice.

-- ---------------------------------------------------------------------------
-- 1. Store the role chosen at signup on the profile.
--    The existing signup trigger creates every profile as "player". This
--    extra trigger runs after it (triggers fire in name order) and sets
--    "scout" when the signup form chose it. Only player/scout are possible.
-- ---------------------------------------------------------------------------
create or replace function public.set_profile_role_from_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.raw_user_meta_data ->> 'role' = 'scout' then
    update public.profiles set role = 'scout' where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists zz_set_profile_role_from_signup on auth.users;
create trigger zz_set_profile_role_from_signup
  after insert on auth.users
  for each row execute function public.set_profile_role_from_signup();

-- Fix scouts who already signed up.
update public.profiles p
set role = 'scout'
from auth.users u
where u.id = p.id
  and u.raw_user_meta_data ->> 'role' = 'scout'
  and p.role is distinct from 'scout';

-- ---------------------------------------------------------------------------
-- 2. Helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_scout()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'scout');
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
-- 3. Scouts read discoverable players' data (read-only)
-- ---------------------------------------------------------------------------
drop policy if exists "Scouts read discoverable profiles" on public.profiles;
create policy "Scouts read discoverable profiles" on public.profiles
  for select to authenticated
  using (public.is_scout() and role = 'player' and discoverable = true);

drop policy if exists "Scouts read discoverable club history" on public.player_club_history;
create policy "Scouts read discoverable club history" on public.player_club_history
  for select to authenticated
  using (public.is_scout() and public.is_discoverable_player(player_id));

drop policy if exists "Scouts read discoverable appearances" on public.match_players;
create policy "Scouts read discoverable appearances" on public.match_players
  for select to authenticated
  using (public.is_scout() and public.is_discoverable_player(player_id));

drop policy if exists "Scouts read matches of discoverable players" on public.matches;
create policy "Scouts read matches of discoverable players" on public.matches
  for select to authenticated
  using (
    public.is_scout() and exists (
      select 1 from public.match_players mp
      where mp.match_id = matches.id and public.is_discoverable_player(mp.player_id)
    )
  );

drop policy if exists "Scouts read discoverable stats" on public.performance_stats;
create policy "Scouts read discoverable stats" on public.performance_stats
  for select to authenticated
  using (
    public.is_scout() and exists (
      select 1 from public.match_players mp
      where mp.id = performance_stats.match_player_id
        and public.is_discoverable_player(mp.player_id)
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Contact requests, contact details and profile views
-- ---------------------------------------------------------------------------
drop policy if exists "Scouts send requests to discoverable players" on public.contact_requests;
create policy "Scouts send requests to discoverable players" on public.contact_requests
  for insert to authenticated
  with check (
    scout_id = auth.uid() and status = 'pending'
    and public.is_scout() and public.is_discoverable_player(player_id)
  );

drop policy if exists "Scouts read own requests" on public.contact_requests;
create policy "Scouts read own requests" on public.contact_requests
  for select to authenticated using (scout_id = auth.uid());

-- Phone/email only after the player accepted this scout's request.
drop policy if exists "Scouts read contacts after acceptance" on public.player_contacts;
create policy "Scouts read contacts after acceptance" on public.player_contacts
  for select to authenticated
  using (
    exists (
      select 1 from public.contact_requests cr
      where cr.player_id = player_contacts.player_id
        and cr.scout_id = auth.uid()
        and cr.status = 'accepted'
    )
  );

-- Players see the name of scouts who contacted them.
drop policy if exists "Players read scouts who contacted them" on public.profiles;
create policy "Players read scouts who contacted them" on public.profiles
  for select to authenticated
  using (
    role = 'scout' and exists (
      select 1 from public.contact_requests cr
      where cr.scout_id = profiles.id and cr.player_id = auth.uid()
    )
  );

drop policy if exists "Scouts record profile views" on public.profile_views;
create policy "Scouts record profile views" on public.profile_views
  for insert to authenticated
  with check (
    scout_id = auth.uid() and public.is_scout() and public.is_discoverable_player(player_id)
  );

drop policy if exists "Scouts read own profile views" on public.profile_views;
create policy "Scouts read own profile views" on public.profile_views
  for select to authenticated using (scout_id = auth.uid());
