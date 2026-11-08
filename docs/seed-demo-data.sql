-- Pata Talanta — demo data for the scout dashboard, rankings and charts.
--
-- Creates 30 EXAMPLE players (fictional people, marked profiles.is_demo =
-- true) across Kenyan counties and positions, each with 4–8 matches, stats,
-- club history and placeholder contact details. About half have heatmaps
-- and video-estimated stats. Also creates one demo scout.
--
-- Run in the Supabase SQL Editor AFTER:
--   1. pata-talanta-scout-access.sql
--   2. docs/scout-role-access.sql
--   3. docs/frontend-schema.sql   (for heatmaps; skipped if not run yet)
--
-- Safe to run again: it deletes and recreates the demo players' matches.
-- To remove all demo data, see the CLEAN UP block at the bottom.
--
-- Demo logins (password for all: PataDemo2026!)
--   demo.player01@example.com … demo.player30@example.com
--   demo.scout@example.com

alter table public.profiles add column if not exists is_demo boolean not null default false;

do $$
declare
  pw constant text := 'PataDemo2026!';
  p record;
  uid uuid;
  email text;
  dob date;
  n_matches int;
  i int;
  m_id uuid;
  mp_id uuid;
  started boolean;
  mins int;
  g int; a int; sh int; sot int; tk int; ic int; pa int; pc int;
  tg int; og int;
  video boolean;
  peak_r numeric; peak_c numeric;
  has_heatmaps boolean := to_regclass('public.player_heatmaps') is not null;
  -- per-match rates by position: goals, assists, tackles, interceptions, shots, passes
  rg numeric; ra numeric; rt numeric; ri numeric; rs numeric; rp numeric;
  opponents text[] := array['Eastlands Rangers','Riverside FC','Highland Juniors','Lakeview United',
                            'Savannah Stars','Valley Academy','Hillside Boys','Harbour City FC',
                            'Greenfield Youth','Sunrise United','Plains Athletic','Junction Stars'];
  comps text[] := array['County League','County League','Inter-County Cup','Schools Tournament','Friendly'];
  venues text[] := array['home','away','neutral'];
begin
  perform setseed(0.2026);

  -- Demo scout --------------------------------------------------------------
  uid := md5('pata-demo-scout')::uuid;
  email := 'demo.scout@example.com';
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, email_change, email_change_token_new, recovery_token)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', email,
          extensions.crypt(pw, extensions.gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"]}',
          jsonb_build_object('display_name', 'Demo Scout', 'role', 'scout'),
          now(), now(), '', '', '', '')
  on conflict (id) do nothing;
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), uid, uid::text,
          jsonb_build_object('sub', uid::text, 'email', email, 'email_verified', true),
          'email', now(), now(), now())
  on conflict do nothing;
  insert into public.profiles (id, display_name, role, county, is_demo)
  values (uid, 'Demo Scout', 'scout', 'Nairobi', true)
  on conflict (id) do update set display_name = excluded.display_name, role = 'scout', is_demo = true;

  -- Players -----------------------------------------------------------------
  for p in
    select * from (values
      ( 1, 'Brian Otieno',     'Striker',              'Kisumu',       17, 1.35, true),
      ( 2, 'Kevin Wanjala',    'Central Midfielder',   'Nairobi',      19, 1.20, true),
      ( 3, 'Dennis Kamau',     'Centre-Back',          'Kiambu',       20, 1.00, true),
      ( 4, 'Faith Achieng',    'Winger',               'Homa Bay',     16, 1.30, true),
      ( 5, 'Victor Kiprono',   'Full-Back',            'Uasin Gishu',  18, 0.95, false),
      ( 6, 'Collins Mwangi',   'Goalkeeper',           'Nyeri',        21, 1.00, true),
      ( 7, 'Hassan Abdi',      'Striker',              'Mombasa',      19, 1.10, false),
      ( 8, 'Mercy Wafula',     'Central Midfielder',   'Bungoma',      17, 1.15, true),
      ( 9, 'Samuel Odhiambo',  'Defensive Midfielder', 'Kisumu',       22, 0.90, false),
      (10, 'Ian Njoroge',      'Winger',               'Nakuru',       15, 1.25, true),
      (11, 'Joseph Mutua',     'Centre-Back',          'Machakos',     18, 0.85, false),
      (12, 'Purity Chebet',    'Full-Back',            'Kericho',      16, 1.05, false),
      (13, 'Allan Omondi',     'Striker',              'Siaya',        20, 0.80, true),
      (14, 'Elvis Barasa',     'Central Midfielder',   'Kakamega',     18, 1.40, true),
      (15, 'Moses Kilonzo',    'Goalkeeper',           'Makueni',      17, 0.90, false),
      (16, 'Esther Nyambura',  'Winger',               'Murang''a',    19, 0.95, false),
      (17, 'Clinton Simiyu',   'Defensive Midfielder', 'Trans Nzoia',  16, 1.20, true),
      (18, 'Abdul Juma',       'Full-Back',            'Kilifi',       20, 1.10, false),
      (19, 'Kelvin Korir',     'Striker',              'Uasin Gishu',  21, 1.00, false),
      (20, 'Peter Ochieng',    'Centre-Back',          'Homa Bay',     19, 1.25, true),
      (21, 'Daniel Mbugua',    'Central Midfielder',   'Kajiado',      22, 0.75, false),
      (22, 'Amos Wekesa',      'Winger',               'Busia',        18, 1.05, true),
      (23, 'Erick Makori',     'Defensive Midfielder', 'Kisii',        20, 1.00, false),
      (24, 'Felix Rotich',     'Goalkeeper',           'Nandi',        19, 1.15, true),
      (25, 'Sharon Akinyi',    'Striker',              'Migori',       17, 1.00, false),
      (26, 'Mohamed Hussein',  'Centre-Back',          'Garissa',      21, 0.90, false),
      (27, 'Josphat Nyaga',    'Full-Back',            'Embu',         18, 1.30, true),
      (28, 'Lilian Wairimu',   'Central Midfielder',   'Nyandarua',    15, 1.10, false),
      (29, 'Kennedy Owino',    'Winger',               'Kisumu',       20, 0.85, false),
      (30, 'Duncan Chege',     'Defensive Midfielder', 'Nairobi',      17, 1.05, true)
    ) as t(n, full_name, pos, county, age, talent, with_video)
  loop
    uid := md5('pata-demo-player-' || p.n)::uuid;
    email := format('demo.player%s@example.com', lpad(p.n::text, 2, '0'));
    dob := (current_date - make_interval(years => p.age) - (floor(random() * 300)::int || ' days')::interval)::date;

    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                            confirmation_token, email_change, email_change_token_new, recovery_token)
    values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', email,
            extensions.crypt(pw, extensions.gen_salt('bf')), now(),
            '{"provider":"email","providers":["email"]}',
            jsonb_build_object('display_name', p.full_name, 'role', 'player', 'onboarded', true),
            now(), now(), '', '', '', '')
    on conflict (id) do nothing;
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), uid, uid::text,
            jsonb_build_object('sub', uid::text, 'email', email, 'email_verified', true),
            'email', now(), now(), now())
    on conflict do nothing;

    insert into public.profiles (id, display_name, role, county, position, date_of_birth,
                                 discoverable, consent_at, guardian_consent, is_demo)
    values (uid, p.full_name, 'player', p.county, p.pos, dob, true, now(), p.age < 18, true)
    on conflict (id) do update set
      display_name = excluded.display_name, role = 'player', county = excluded.county,
      position = excluded.position, date_of_birth = excluded.date_of_birth,
      discoverable = true, consent_at = coalesce(public.profiles.consent_at, now()),
      guardian_consent = excluded.guardian_consent, is_demo = true;

    -- Obviously fake contact details, revealed only after a request is accepted.
    insert into public.player_contacts (player_id, phone, contact_email, updated_at)
    values (uid, format('+254 700 000 %s', lpad(p.n::text, 3, '0')), email, now())
    on conflict (player_id) do update set phone = excluded.phone, contact_email = excluded.contact_email;

    -- Fresh matches and clubs on every run.
    if has_heatmaps then
      delete from public.player_heatmaps where match_player_id in
        (select id from public.match_players where player_id = uid);
    end if;
    delete from public.performance_stats where match_player_id in
      (select id from public.match_players where player_id = uid);
    delete from public.match_players where player_id = uid;
    delete from public.matches where created_by = uid;
    delete from public.player_club_history where player_id = uid;

    insert into public.player_club_history (player_id, club_name, league_or_division, start_date, end_date, is_current, achievement)
    values (uid, p.county || ' Youth FC', 'County League', date '2024-01-15', null, true,
            case when p.talent >= 1.25 then 'County league top performer 2025' end);
    if p.age >= 18 then
      insert into public.player_club_history (player_id, club_name, league_or_division, start_date, end_date, is_current)
      values (uid, p.county || ' Stars Academy', 'Youth Development League', date '2021-02-01', date '2023-12-15', false);
    end if;

    case p.pos
      when 'Striker'              then rg := .60; ra := .25; rt := .4; ri := .2; rs := 2.5; rp := 18; peak_c := 10; peak_r := 3.5;
      when 'Winger'               then rg := .35; ra := .40; rt := .6; ri := .3; rs := 1.6; rp := 28; peak_c := 8;  peak_r := case when p.n % 2 = 0 then 1 else 6 end;
      when 'Central Midfielder'   then rg := .15; ra := .35; rt := 1.2; ri := .8; rs := 1.0; rp := 50; peak_c := 6;  peak_r := 3.5;
      when 'Defensive Midfielder' then rg := .05; ra := .15; rt := 1.6; ri := 1.1; rs := .4; rp := 45; peak_c := 4.5; peak_r := 3.5;
      when 'Full-Back'            then rg := .05; ra := .25; rt := 1.3; ri := .9; rs := .3; rp := 35; peak_c := 4;  peak_r := case when p.n % 2 = 0 then 1 else 6 end;
      when 'Centre-Back'          then rg := .07; ra := .05; rt := 1.4; ri := 1.2; rs := .3; rp := 40; peak_c := 2.5; peak_r := 3.5;
      else                             rg := 0;   ra := .02; rt := .05; ri := .1; rs := 0;  rp := 20; peak_c := 0.8; peak_r := 3.5;
    end case;

    n_matches := 4 + (p.n % 5);
    for i in 1..n_matches loop
      started := random() < 0.8;
      mins := case when started then 60 + floor(random() * 31)::int else 15 + floor(random() * 21)::int end;
      g  := (random() < rg * p.talent * 0.7)::int + (random() < rg * p.talent * 0.3)::int;
      a  := (random() < ra * p.talent * 0.8)::int + (random() < ra * p.talent * 0.2)::int;
      tk := round(rt * p.talent * (0.4 + random() * 1.2) * mins / 80);
      ic := round(ri * p.talent * (0.4 + random() * 1.2) * mins / 80);
      sh := greatest(g, round(rs * (0.5 + random()) * mins / 80));
      sot := least(sh, greatest(g, round(sh * (0.3 + random() * 0.4))));
      pa := round(rp * (0.7 + random() * 0.6) * mins / 80);
      pc := round(pa * least(0.92, 0.6 + 0.2 * p.talent + random() * 0.08));
      tg := g + floor(random() * 3)::int;
      og := floor(random() * 3)::int;
      -- The two most recent matches of "video" players were analysed from footage.
      video := p.with_video and i <= 2;

      insert into public.matches (created_by, club_name, opponent, competition, match_date, venue,
                                  match_type, team_goals, opponent_goals, notes)
      values (uid, p.county || ' Youth FC',
              opponents[1 + ((p.n * 7 + i * 3) % array_length(opponents, 1))],
              comps[1 + ((p.n + i) % array_length(comps, 1))],
              current_date - (i * 11 + (p.n % 6)),
              p.county || ' Grounds',
              venues[1 + ((p.n + i) % 3)],
              tg, og, 'Example data')
      returning id into m_id;

      insert into public.match_players (match_id, player_id, minutes_played, started, position_played)
      values (m_id, uid, mins, started, p.pos)
      returning id into mp_id;

      insert into public.performance_stats (match_player_id, goals, assists, shots, shots_on_target,
        tackles, interceptions, passes_completed, passes_attempted, distance_km, top_speed_kmh,
        sprint_count, touches, data_source, notes)
      values (mp_id, g, a, sh, sot, tk, ic, pc, pa,
              case when video then round((((case when p.pos = 'Goalkeeper' then 4.5 else 8.5 end)
                                          + random() * 2) * mins / 90)::numeric, 2) end,
              case when video then round((case when p.pos = 'Goalkeeper' then 21 else 25 end
                                          + random() * 6 * p.talent)::numeric, 1) end,
              case when video then (case when p.pos = 'Goalkeeper' then 2 else 8 end)
                                   + floor(random() * 10 * p.talent)::int end,
              case when video then 25 + floor(random() * 45)::int end,
              case when video then 'player_entry+video' else 'player_entry' end,
              'Example data');

      if video and has_heatmaps then
        insert into public.player_heatmaps (match_player_id, grid_rows, grid_cols, intensities, data_source)
        select mp_id, 8, 12, jsonb_agg(row_vals order by r), 'demo'
        from (
          select r, jsonb_agg(
                   round((greatest(0, 9 - sqrt(power((r - peak_r) * 1.4, 2) + power(c - peak_c, 2)) * 1.5)
                          + random() * 0.6)::numeric, 1)
                   order by c) as row_vals
          from generate_series(0, 7) as r, generate_series(0, 11) as c
          group by r
        ) t;
      end if;
    end loop;
  end loop;

  raise notice 'Demo data ready: 30 players, 1 scout. Heatmaps: %',
    case when has_heatmaps then 'created' else 'skipped (run frontend-schema.sql first)' end;
end $$;

-- Check it worked:
-- select display_name, position, county, date_of_birth from public.profiles where is_demo order by display_name;

-- ---------------------------------------------------------------------------
-- CLEAN UP: remove every demo account and its data. Uncomment and run.
-- ---------------------------------------------------------------------------
-- do $$
-- declare ids uuid[] := array(select id from public.profiles where is_demo);
-- begin
--   if to_regclass('public.player_heatmaps') is not null then
--     delete from public.player_heatmaps where match_player_id in (select id from public.match_players where player_id = any(ids));
--   end if;
--   delete from public.performance_stats where match_player_id in (select id from public.match_players where player_id = any(ids));
--   delete from public.match_players where player_id = any(ids);
--   delete from public.matches where created_by = any(ids);
--   delete from public.player_club_history where player_id = any(ids);
--   delete from public.player_contacts where player_id = any(ids);
--   delete from public.contact_requests where player_id = any(ids) or scout_id = any(ids);
--   delete from public.profile_views where player_id = any(ids) or scout_id = any(ids);
--   delete from public.notifications where user_id = any(ids);
--   delete from public.profiles where id = any(ids);
--   delete from auth.identities where user_id = any(ids);
--   delete from auth.users where id = any(ids);
-- end $$;
