"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { useScout } from "@/lib/useScout";
import { ui, errorMessage } from "@/lib/ui";
import { ageFrom, type PlayerProfile } from "@/lib/types";
import { talentScore, TALENT_SCORE_EXPLAINER } from "@/lib/stats";

type PlayerCard = PlayerProfile & {
  age: number | null;
  matches: number;
  minutes: number;
  goals: number;
  assists: number;
  defensive: number;
  videoMatches: number;
  videos: number;
  score: number;
};

type SortKey = "score" | "contributions" | "matches" | "minutes" | "name";

export default function ScoutDashboard() {
  const scoutId = useScout();
  const [players, setPlayers] = useState<PlayerCard[]>([]);
  const [pending, setPending] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [recent, setRecent] = useState<string[]>([]);

  const [query, setQuery] = useState("");
  const [ageBand, setAgeBand] = useState("");
  const [county, setCounty] = useState("");
  const [position, setPosition] = useState("");
  const [minMatches, setMinMatches] = useState(0);
  const [videoOnly, setVideoOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("score");

  useEffect(() => {
    if (!scoutId) return;
    const supabase = createClient();
    (async () => {
      try {
        // RLS already limits scouts to consenting players; the filter keeps
        // the intent explicit.
        const { data: profiles, error: pErr } = await supabase
          .from("profiles")
          .select("id, display_name, county, position, role, date_of_birth, discoverable, guardian_consent, consent_at")
          .eq("role", "player")
          .eq("discoverable", true)
          .limit(500);
        if (pErr) throw pErr;
        const ids = (profiles || []).map((p) => p.id);

        const [apps, vids, reqs, views] = await Promise.all([
          ids.length
            ? supabase.from("match_players").select("id, player_id, minutes_played").in("player_id", ids)
            : Promise.resolve({ data: [], error: null }),
          ids.length
            ? supabase.from("match_videos").select("player_id").in("player_id", ids)
            : Promise.resolve({ data: [], error: null }),
          supabase
            .from("contact_requests")
            .select("id", { count: "exact", head: true })
            .eq("scout_id", scoutId)
            .eq("status", "pending"),
          supabase
            .from("profile_views")
            .select("player_id, viewed_at")
            .eq("scout_id", scoutId)
            .order("viewed_at", { ascending: false })
            .limit(50),
        ]);
        if (apps.error) throw apps.error;

        const appearances = (apps.data || []) as {
          id: string;
          player_id: string;
          minutes_played: number | null;
        }[];
        const appIds = appearances.map((a) => a.id);
        const { data: stats, error: sErr } = appIds.length
          ? await supabase
              .from("performance_stats")
              .select("match_player_id, goals, assists, tackles, interceptions, data_source")
              .in("match_player_id", appIds)
          : { data: [], error: null };
        if (sErr) throw sErr;

        const appOwner = new Map(appearances.map((a) => [a.id, a.player_id]));
        const agg = new Map<string, Omit<PlayerCard, keyof PlayerProfile | "age" | "score">>();
        const get = (id: string) => {
          if (!agg.has(id))
            agg.set(id, { matches: 0, minutes: 0, goals: 0, assists: 0, defensive: 0, videoMatches: 0, videos: 0 });
          return agg.get(id)!;
        };
        for (const a of appearances) {
          const g = get(a.player_id);
          g.matches += 1;
          g.minutes += a.minutes_played || 0;
        }
        for (const s of stats || []) {
          const owner = appOwner.get(s.match_player_id);
          if (!owner) continue;
          const g = get(owner);
          g.goals += s.goals || 0;
          g.assists += s.assists || 0;
          g.defensive += (s.tackles || 0) + (s.interceptions || 0);
          if (String(s.data_source || "").includes("video")) g.videoMatches += 1;
        }
        // match_videos may not exist yet; treat that as "no videos".
        for (const v of vids.error ? [] : vids.data || []) get(v.player_id).videos += 1;

        setPlayers(
          (profiles || []).map((p) => {
            const a = get(p.id);
            return { ...p, ...a, age: ageFrom(p.date_of_birth), score: talentScore(a) };
          })
        );
        setPending(reqs.count || 0);
        // Most recent view per player, newest first.
        const seen = new Set<string>();
        setRecent(
          (views.data || [])
            .map((v) => v.player_id as string)
            .filter((id) => !seen.has(id) && seen.add(id))
            .slice(0, 6)
        );
      } catch (err) {
        setError(errorMessage(err, "Could not load players."));
      } finally {
        setLoading(false);
      }
    })();
  }, [scoutId]);

  const counties = useMemo(
    () => [...new Set(players.map((p) => p.county?.trim()).filter(Boolean))].sort() as string[],
    [players]
  );
  const positions = useMemo(
    () => [...new Set(players.map((p) => p.position?.trim()).filter(Boolean))].sort() as string[],
    [players]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return players
      .filter((p) => !q || (p.display_name || "").toLowerCase().includes(q))
      .filter((p) => !county || p.county?.trim() === county)
      .filter((p) => !position || p.position?.trim() === position)
      .filter((p) => {
        if (!ageBand) return true;
        if (p.age === null) return false;
        const [lo, hi] = ageBand.split("-").map(Number);
        return p.age >= lo && p.age <= hi;
      })
      .filter((p) => p.matches >= minMatches)
      .filter((p) => !videoOnly || p.videos > 0)
      .sort((a, b) => {
        if (sort === "name") return (a.display_name || "").localeCompare(b.display_name || "");
        if (sort === "matches") return b.matches - a.matches;
        if (sort === "minutes") return b.minutes - a.minutes;
        if (sort === "contributions") return b.goals + b.assists - (a.goals + a.assists);
        return b.score - a.score;
      });
  }, [players, query, county, position, ageBand, minMatches, videoOnly, sort]);

  // Re-ranks whenever the filters change.
  const topPicks = useMemo(
    () => [...filtered].filter((p) => p.matches > 0).sort((a, b) => b.score - a.score).slice(0, 3),
    [filtered]
  );

  const totals = useMemo(
    () => [
      { label: "Players visible", value: players.length },
      { label: "Matches logged", value: players.reduce((t, p) => t + p.matches, 0) },
      { label: "Matches analysed from video", value: players.reduce((t, p) => t + p.videoMatches, 0) },
      { label: "Counties", value: new Set(players.map((p) => p.county?.trim()).filter(Boolean)).size },
    ],
    [players]
  );

  const recentPlayers = recent
    .map((id) => players.find((p) => p.id === id))
    .filter((p): p is PlayerCard => !!p);

  const resetFilters = () => {
    setQuery("");
    setAgeBand("");
    setCounty("");
    setPosition("");
    setMinMatches(0);
    setVideoOnly(false);
  };

  if (!scoutId) {
    return <p className="px-6 py-12 text-[#AEB5C0]">Checking your account…</p>;
  }

  return (
    <main className="text-white">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className={ui.eyebrow}>Scout dashboard</p>
            <h1 className={ui.h1}>Discover players</h1>
            <p className={ui.lead}>
              Search grassroots players by location and position, then open a profile to
              review statistics, heatmaps and match footage.
            </p>
          </div>
          <Link href="/scout/requests" className={ui.buttonGhost}>
            {pending > 0 ? `${pending} request${pending === 1 ? "" : "s"} awaiting reply` : "My contact requests"} →
          </Link>
        </div>

        <section className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Totals">
          {totals.map((t) => (
            <div key={t.label} className="rounded-xl border border-[#353941] bg-[#22252B] p-4 sm:p-5">
              <p className="text-xs text-[#AEB5C0] sm:text-sm">{t.label}</p>
              <p className="mt-1 text-2xl font-black">{loading ? "–" : t.value}</p>
            </div>
          ))}
        </section>

        {recentPlayers.length > 0 && (
          <section className="mt-10">
            <h2 className="text-sm font-bold uppercase tracking-wide text-[#AEB5C0]">Recently viewed</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {recentPlayers.map((p) => (
                <Link
                  key={p.id}
                  href={`/scout/players/${p.id}`}
                  className="rounded-full border border-[#454A54] px-4 py-2 text-sm hover:border-[#F47721] hover:text-[#F47721]"
                >
                  {p.display_name || "Unnamed player"}
                  {p.position ? ` · ${p.position}` : ""}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Filters: one row above the results */}
        <section className="mt-8 grid gap-3 rounded-xl border border-[#353941] bg-[#1D2025] p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr]">
          <input
            aria-label="Search by name"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by player name"
            className={ui.input}
          />
          <select aria-label="County" value={county} onChange={(e) => setCounty(e.target.value)} className={ui.input}>
            <option value="">All counties</option>
            {counties.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select aria-label="Position" value={position} onChange={(e) => setPosition(e.target.value)} className={ui.input}>
            <option value="">All positions</option>
            {positions.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <select aria-label="Age" value={ageBand} onChange={(e) => setAgeBand(e.target.value)} className={ui.input}>
            <option value="">Any age</option>
            <option value="0-14">Under 15</option>
            <option value="15-17">15–17</option>
            <option value="18-20">18–20</option>
            <option value="21-99">21+</option>
          </select>
          <select
            aria-label="Minimum matches"
            value={minMatches}
            onChange={(e) => setMinMatches(Number(e.target.value))}
            className={ui.input}
          >
            <option value={0}>Any matches</option>
            <option value={1}>1+ matches</option>
            <option value={5}>5+ matches</option>
            <option value={10}>10+ matches</option>
          </select>
          <select aria-label="Sort by" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className={ui.input}>
            <option value="score">Sort: talent score</option>
            <option value="contributions">Sort: goal contributions</option>
            <option value="matches">Sort: matches played</option>
            <option value="minutes">Sort: minutes played</option>
            <option value="name">Sort: name</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-[#AEB5C0] sm:col-span-2 lg:col-span-6">
            <input
              type="checkbox"
              checked={videoOnly}
              onChange={(e) => setVideoOnly(e.target.checked)}
              className="accent-[#F47721]"
            />
            Only players with match footage
          </label>
        </section>

        {error && <p className={`${ui.error} mt-6`}>{error}</p>}

        {!loading && topPicks.length > 0 && (
          <section className="mt-8 rounded-xl border border-[#F47721]/40 bg-[#F47721]/5 p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-bold">Top players to watch</h2>
              <p className="text-xs text-[#AEB5C0]">Ranked within your current filters</p>
            </div>
            <ol className="mt-4 grid gap-3 md:grid-cols-3">
              {topPicks.map((p, i) => (
                <li key={p.id}>
                  <Link
                    href={`/scout/players/${p.id}`}
                    className="flex items-center gap-4 rounded-lg border border-[#353941] bg-[#22252B] p-4 transition hover:border-[#F47721]"
                  >
                    <span className="text-2xl font-black text-[#F47721]">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold">{p.display_name || "Unnamed player"}</span>
                      <span className="block truncate text-xs text-[#AEB5C0]">
                        {[p.position, p.county].filter(Boolean).join(" · ") || "Details not provided"}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block text-xl font-black">{p.score}</span>
                      <span className="block text-[10px] uppercase tracking-wide text-[#AEB5C0]">score</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
            <details className="mt-3 text-xs text-[#AEB5C0]">
              <summary className="cursor-pointer hover:text-white">How the score works</summary>
              <p className="mt-2 leading-5">{TALENT_SCORE_EXPLAINER}</p>
            </details>
          </section>
        )}

        <p className="mt-6 text-sm text-[#AEB5C0]" aria-live="polite">
          {loading ? "Loading players…" : `${filtered.length} of ${players.length} players`}
        </p>

        {!loading && filtered.length === 0 ? (
          <div className={`${ui.empty} mt-4`}>
            <p className="font-semibold text-white">No players match these filters</p>
            <button onClick={resetFilters} className="mt-3 text-sm font-semibold text-[#F47721] hover:underline">
              Clear filters
            </button>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => (
              <Link
                key={p.id}
                href={`/scout/players/${p.id}`}
                className="group rounded-xl border border-[#353941] bg-[#22252B] p-6 transition hover:border-[#F47721]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F47721]/15 font-black text-[#F47721]">
                      {(p.display_name || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate font-bold">{p.display_name || "Unnamed player"}</h3>
                      <p className="truncate text-sm text-[#AEB5C0]">
                        {[p.age !== null ? `Age ${p.age}` : null, p.position, p.county]
                          .filter(Boolean)
                          .join(" · ") || "Details not provided"}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-right" title={TALENT_SCORE_EXPLAINER}>
                      <span className="block text-lg font-black leading-none">{p.score}</span>
                      <span className="text-[10px] uppercase tracking-wide text-[#AEB5C0]">score</span>
                    </span>
                    {p.videos > 0 && (
                      <span className="rounded-full bg-[#F47721]/15 px-2 py-0.5 text-[10px] font-bold uppercase text-[#F47721]">
                        Video
                      </span>
                    )}
                  </div>
                </div>

                <dl className="mt-5 grid grid-cols-4 gap-2 border-t border-[#353941] pt-4 text-center">
                  {[
                    ["Apps", p.matches],
                    ["Mins", p.minutes],
                    ["Goals", p.goals],
                    ["Assists", p.assists],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-[11px] uppercase tracking-wide text-[#AEB5C0]">{label}</dt>
                      <dd className="mt-1 font-bold">{value}</dd>
                    </div>
                  ))}
                </dl>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
