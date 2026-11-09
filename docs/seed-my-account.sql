-- Pata Talanta — fill ONE existing player account with a season of example
-- statistics, so its dashboard looks like a real data-rich profile.
--
-- 1. Change the email on the next line to your player account's email.
-- 2. Run in the Supabase SQL Editor (after frontend-schema.sql for heatmaps).
--
-- Adds 12 example matches with full stats (4 of them "analysed from video"
-- with heatmaps and distance/speed estimates) and two clubs. Fills county,
-- position and date of birth only if they are empty. Matches you entered
-- yourself are never touched. Running it again replaces only the example
-- matches. CLEAN UP block at the bottom.

do $$
declare
  v_email constant text := 'CHANGE-ME@example.com';   -- <-- your player account email

  uid uuid;
  prof record;
  v_pos text;
  v_county text;
  talent constant numeric := 1.25;
  i int;
  m_id uuid;
  mp_id uuid;
  started boolean;
  mins int;
  g int; a int; sh int; sot int; tk int; ic int; pa int; pc int; tg int; og int;
  video boolean;
  rg numeric; ra numeric; rt numeric; ri numeric; rs numeric; rp numeric;
  peak_r numeric; peak_c numeric;
  has_heatmaps boolean := to_regclass('public.player_heatmaps') is not null;
  opponents text[] := array['Eastlands Rangers','Riverside FC','Highland Juniors','Lakeview United',
                            'Savannah Stars','Valley Academy','Hillside Boys','Harbour City FC',
                            'Greenfield Youth','Sunrise United','Plains Athletic','Junction Stars'];
  comps text[] := array['County League','County League','Inter-County Cup','Schools Tournament','Friendly'];
  venues text[] := array['home','away','neutral'];
begin
  select id into uid from auth.users where lower(email) = lower(v_email);
  if uid is null then
    raise exception 'No account with email %. Change v_email at the top of the script.', v_email;
  end if;
  select * into prof from public.profiles where id = uid;
  if prof.role = 'scout' then
    raise exception '% is a scout account. Use a player account.', v_email;
  end if;

  v_pos := coalesce(nullif(prof.position, ''), 'Central Midfielder');
  v_county := coalesce(nullif(prof.county, ''), 'Nairobi');

  update public.profiles set
    position = v_pos,
    county = v_county,
    date_of_birth = coalesce(date_of_birth, (current_date - interval '18 years 3 months')::date)
  where id = uid;

  -- Example clubs (only if the player has none).
  if not exists (select 1 from public.player_club_history where player_id = uid) then
    insert into public.player_club_history (player_id, club_name, league_or_division, start_date, end_date, is_current, achievement, notes)
    values (uid, v_county || ' Youth FC', 'County League', date '2024-01-15', null, true,
            'County league top performer 2025', 'Example data'),
           (uid, v_county || ' Stars Academy', 'Youth Development League', date '2021-02-01', date '2023-12-15', false,
            null, 'Example data');
  end if;

  -- Replace earlier example matches only.
  if has_heatmaps then
    delete from public.player_heatmaps where match_player_id in (
      select mp.id from public.match_players mp join public.matches m on m.id = mp.match_id
      where mp.player_id = uid and m.notes = 'Example data');
  end if;
  delete from public.performance_stats where match_player_id in (
    select mp.id from public.match_players mp join public.matches m on m.id = mp.match_id
    where mp.player_id = uid and m.notes = 'Example data');
  delete from public.match_players where player_id = uid and match_id in (
    select id from public.matches where created_by = uid and notes = 'Example data');
  delete from public.matches where created_by = uid and notes = 'Example data';

  case
    when v_pos ilike '%keeper%'                         then rg := 0;   ra := .02; rt := .05; ri := .1; rs := 0;   rp := 20; peak_c := 0.8; peak_r := 3.5;
    when v_pos ilike '%centre-back%' or v_pos ilike '%center back%' or v_pos ilike '%centre back%'
                                                       then rg := .07; ra := .05; rt := 1.4; ri := 1.2; rs := .3; rp := 40; peak_c := 2.5; peak_r := 3.5;
    when v_pos ilike '%back%' or v_pos ilike '%defender%'  then rg := .05; ra := .25; rt := 1.3; ri := .9;  rs := .3; rp := 35; peak_c := 4;   peak_r := 1;
    when v_pos ilike '%defensive%'                       then rg := .05; ra := .15; rt := 1.6; ri := 1.1; rs := .4; rp := 45; peak_c := 4.5; peak_r := 3.5;
    when v_pos ilike '%wing%'                            then rg := .35; ra := .40; rt := .6;  ri := .3;  rs := 1.6; rp := 28; peak_c := 8;  peak_r := 6;
    when v_pos ilike '%striker%' or v_pos ilike '%forward%' then rg := .60; ra := .25; rt := .4; ri := .2;  rs := 2.5; rp := 18; peak_c := 10; peak_r := 3.5;
    else                                                    rg := .15; ra := .35; rt := 1.2; ri := .8;  rs := 1.0; rp := 50; peak_c := 6;  peak_r := 3.5;
  end case;

  for i in 1..12 loop
    started := i % 5 <> 0;
    mins := case when started then 70 + floor(random() * 21)::int else 20 + floor(random() * 16)::int end;
    g  := (random() < rg * talent * 0.7)::int + (random() < rg * talent * 0.3)::int;
    a  := (random() < ra * talent * 0.8)::int + (random() < ra * talent * 0.2)::int;
    tk := round(rt * talent * (0.4 + random() * 1.2) * mins / 80);
    ic := round(ri * talent * (0.4 + random() * 1.2) * mins / 80);
    sh := greatest(g, round(rs * (0.5 + random()) * mins / 80));
    sot := least(sh, greatest(g, round(sh * (0.3 + random() * 0.4))));
    pa := round(rp * (0.7 + random() * 0.6) * mins / 80);
    pc := round(pa * least(0.92, 0.6 + 0.2 * talent + random() * 0.08));
    tg := g + floor(random() * 3)::int;
    og := floor(random() * 3)::int;
    video := i <= 4;

    insert into public.matches (created_by, club_name, opponent, competition, match_date, venue,
                                match_type, team_goals, opponent_goals, notes)
    values (uid, v_county || ' Youth FC', opponents[1 + ((i * 5) % array_length(opponents, 1))],
            comps[1 + (i % array_length(comps, 1))], current_date - (i * 9 + 2),
            v_county || ' Grounds', venues[1 + (i % 3)], tg, og, 'Example data')
    returning id into m_id;

    insert into public.match_players (match_id, player_id, minutes_played, started, position_played)
    values (m_id, uid, mins, started, v_pos)
    returning id into mp_id;

    insert into public.performance_stats (match_player_id, goals, assists, shots, shots_on_target,
      tackles, interceptions, passes_completed, passes_attempted, distance_km, top_speed_kmh,
      sprint_count, touches, data_source, notes)
    values (mp_id, g, a, sh, sot, tk, ic, pc, pa,
            case when video then round(((8.5 + random() * 2) * mins / 90)::numeric, 2) end,
            case when video then round((25 + random() * 6 * talent)::numeric, 1) end,
            case when video then 8 + floor(random() * 10 * talent)::int end,
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

  raise notice 'Added 12 example matches to % (% as %).', v_email, v_county, v_pos;
end $$;

-- ---------------------------------------------------------------------------
-- CLEAN UP: remove the example matches and clubs from that account.
-- Change the email, uncomment and run.
-- ---------------------------------------------------------------------------
-- do $$
-- declare uid uuid := (select id from auth.users where lower(email) = lower('CHANGE-ME@example.com'));
-- begin
--   if to_regclass('public.player_heatmaps') is not null then
--     delete from public.player_heatmaps where match_player_id in (
--       select mp.id from public.match_players mp join public.matches m on m.id = mp.match_id
--       where mp.player_id = uid and m.notes = 'Example data');
--   end if;
--   delete from public.performance_stats where match_player_id in (
--     select mp.id from public.match_players mp join public.matches m on m.id = mp.match_id
--     where mp.player_id = uid and m.notes = 'Example data');
--   delete from public.match_players where player_id = uid and match_id in (
--     select id from public.matches where created_by = uid and notes = 'Example data');
--   delete from public.matches where created_by = uid and notes = 'Example data';
--   delete from public.player_club_history where player_id = uid and notes = 'Example data';
-- end $$;
