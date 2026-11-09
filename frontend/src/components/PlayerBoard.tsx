"use client";

import { useMemo, useState } from "react";
import Heatmap from "@/components/Heatmap";
import ScoreGauge from "@/components/ScoreGauge";
import ContributionChart, { type ChartPoint } from "@/components/ContributionChart";
import { formatDate } from "@/lib/ui";
import { combineHeatmaps, talentScore, totalStats, TALENT_SCORE_EXPLAINER } from "@/lib/stats";
import {
  ageFrom,
  type Club,
  type Heatmap as HeatmapRow,
  type Match,
  type MatchPlayer,
  type PerformanceStat,
  type PlayerProfile,
} from "@/lib/types";

export type BoardAppearance = MatchPlayer & {
  match: Match | null;
  stat: PerformanceStat | null;
};

/**
 * The statistics board for one player: identity and key facts, chart, club
 * history, talent score, season detail, form, matches and heatmap. Used both
 * on the player's own dashboard and on the scout's view of a player.
 */
export default function PlayerBoard({
  profile,
  clubs,
  appearances,
  heatmaps,
  breadcrumb,
  action,
  aside,
}: {
  profile: PlayerProfile;
  clubs: Club[];
  appearances: BoardAppearance[];
  heatmaps: HeatmapRow[];
  breadcrumb?: React.ReactNode;
  /** Buttons in the header, e.g. "Request full profile" or "Log a match". */
  action?: React.ReactNode;
  /** Extra content under the header, e.g. alerts for the player. */
  aside?: React.ReactNode;
}) {
  const [heatmapSel, setHeatmapSel] = useState("all");

  const sorted = useMemo(
    () =>
      [...appearances].sort((a, b) =>
        (b.match?.match_date || "").localeCompare(a.match?.match_date || "")
      ),
    [appearances]
  );
  const stats = sorted.map((a) => a.stat).filter((s): s is PerformanceStat => !!s);
  const totals = totalStats(sorted, stats);
  const defensive = totals.tackles + totals.interceptions;
  const score = talentScore({ ...totals, defensive });

  const sum = (k: keyof PerformanceStat) =>
    stats.reduce((t, s) => t + (typeof s[k] === "number" ? (s[k] as number) : 0), 0);
  const shots = sum("shots");
  const onTarget = sum("shots_on_target");
  const sprints = sum("sprint_count");
  const touches = sum("touches");
  const videoStats = stats.filter((s) => String(s.data_source || "").includes("video")).length;
  const per90 = (v: number) => (totals.minutes > 0 ? ((v / totals.minutes) * 90).toFixed(2) : "—");

  const age = ageFrom(profile.date_of_birth);
  const nameParts = (profile.display_name || "Unnamed player").trim().split(/\s+/);
  const lastName = nameParts.length > 1 ? nameParts.pop()! : nameParts[0];
  const firstNames = nameParts.join(" ");

  const results = sorted.map((a) => {
    const tg = a.match?.team_goals;
    const og = a.match?.opponent_goals;
    return tg == null || og == null ? null : tg > og ? "W" : tg < og ? "L" : "D";
  });
  const form = results.filter(Boolean).slice(0, 5) as ("W" | "D" | "L")[];
  const record = {
    W: results.filter((r) => r === "W").length,
    D: results.filter((r) => r === "D").length,
    L: results.filter((r) => r === "L").length,
  };

  const chartPoints: ChartPoint[] = sorted
    .filter((a) => a.stat)
    .slice(0, 8)
    .reverse()
    .map((a) => ({
      id: a.id,
      label: a.match?.opponent || "Unknown",
      date: formatDate(a.match?.match_date),
      goals: a.stat?.goals || 0,
      assists: a.stat?.assists || 0,
    }));

  const heatmapGrid =
    heatmaps.length === 0
      ? null
      : heatmapSel === "all"
        ? combineHeatmaps(heatmaps.map((h) => h.intensities))
        : (heatmaps.find((h) => h.match_player_id === heatmapSel)?.intensities ?? null);

  const appearanceLabel = (id: string) => {
    const a = sorted.find((x) => x.id === id);
    return a ? `vs ${a.match?.opponent || "Unknown"} · ${formatDate(a.match?.match_date)}` : "Match";
  };

  const infoBoxes = [
    { label: "Date of birth", value: profile.date_of_birth ? `${formatDate(profile.date_of_birth)} (${age})` : "Not provided" },
    { label: "Position", value: profile.position || "Not provided" },
    { label: "County", value: profile.county || "Not provided" },
    { label: "Matches", value: String(totals.matches) },
    { label: "Goals", value: String(totals.goals) },
    { label: "Assists", value: String(totals.assists) },
  ];

  const detail: { label: string; value: string; sub?: string; est?: boolean }[] = [
    { label: "Minutes played", value: totals.minutes.toLocaleString(), sub: totals.matches ? `${Math.round(totals.minutes / totals.matches)} per match` : undefined },
    { label: "Goals per 90", value: per90(totals.goals) },
    { label: "Assists per 90", value: per90(totals.assists) },
    { label: "Shots", value: String(shots), sub: shots ? `${Math.round((onTarget / shots) * 100)}% on target` : undefined },
    { label: "Passing accuracy", value: totals.passingAccuracy === null ? "—" : `${totals.passingAccuracy}%`, sub: `${sum("passes_completed")} / ${sum("passes_attempted")} passes` },
    { label: "Tackles", value: String(totals.tackles), sub: `${per90(totals.tackles)} per 90` },
    { label: "Interceptions", value: String(totals.interceptions), sub: `${per90(totals.interceptions)} per 90` },
    { label: "Distance covered", value: `${totals.distanceKm.toFixed(1)} km`, est: true, sub: videoStats ? `${videoStats} analysed match${videoStats === 1 ? "" : "es"}` : "No video yet" },
    { label: "Top speed", value: totals.topSpeed === null ? "—" : `${totals.topSpeed} km/h`, est: true },
    { label: "Sprints · touches", value: `${sprints} · ${touches}`, est: true },
  ];

  const card = "rounded-xl border border-[#353941] bg-[#1D2025] p-5";
  const cardTitle = "text-sm font-bold uppercase tracking-wide text-[#D8DCE2]";
  const resultPill = (r: "W" | "D" | "L") =>
    r === "W" ? "bg-green-500/20 text-green-300" : r === "L" ? "bg-red-500/20 text-red-300" : "bg-[#454A54] text-[#D8DCE2]";

  return (
    <div className="text-white">
      {breadcrumb && <nav className="text-xs text-[#AEB5C0]" aria-label="Breadcrumb">{breadcrumb}</nav>}

      {/* Header: identity + key facts */}
      <section className="mt-4 overflow-hidden rounded-2xl border border-[#353941] bg-gradient-to-r from-[#22252B] to-[#1D2025]">
        <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[auto_1fr_auto] lg:items-center">
          <div className="flex items-center gap-5">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-[#F47721]/15 text-4xl font-black text-[#F47721] ring-4 ring-[#F47721]/30">
              {(profile.display_name || "?").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              {firstNames && <p className="text-sm text-[#AEB5C0]">{firstNames}</p>}
              <h1 className="truncate text-3xl font-black sm:text-4xl">{lastName}</h1>
              <p className="mt-1 text-sm text-[#AEB5C0]">
                {[profile.position, profile.county].filter(Boolean).join(" · ") || "Grassroots player"}
              </p>
              {profile.is_demo && (
                <span className="mt-1 inline-block rounded border border-[#454A54] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#AEB5C0]">
                  Example data · fictional player
                </span>
              )}
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {infoBoxes.map((b) => (
              <div key={b.label}>
                <dt className="text-[10px] font-bold uppercase tracking-wider text-[#AEB5C0]">{b.label}</dt>
                <dd className="mt-1 truncate rounded-md border border-[#353941] bg-[#17191D] px-3 py-2 text-sm font-semibold">
                  {b.value}
                </dd>
              </div>
            ))}
          </dl>

          {action && <div className="flex flex-col gap-2 lg:self-center">{action}</div>}
        </div>
      </section>

      {aside}

      {/* Row: chart · club history · score */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className={card}>
          <h2 className={cardTitle}>Goals + assists per match</h2>
          <div className="mt-4">
            {chartPoints.length ? (
              <ContributionChart points={chartPoints} />
            ) : (
              <p className="py-10 text-center text-sm text-[#AEB5C0]">No match statistics yet.</p>
            )}
          </div>
        </section>

        <section className={card}>
          <h2 className={cardTitle}>Club history</h2>
          {clubs.length === 0 ? (
            <p className="py-10 text-center text-sm text-[#AEB5C0]">No clubs listed.</p>
          ) : (
            <table className="mt-3 w-full text-left text-sm">
              <thead className="text-[10px] uppercase tracking-wider text-[#AEB5C0]">
                <tr>
                  <th className="pb-2 font-semibold">Years</th>
                  <th className="pb-2 font-semibold">Club</th>
                </tr>
              </thead>
              <tbody>
                {clubs.slice(0, 6).map((c) => (
                  <tr key={c.id} className="border-t border-[#353941]">
                    <td className="whitespace-nowrap py-2.5 pr-3 text-xs text-[#AEB5C0]">
                      {c.start_date?.slice(0, 4) || "?"}–{c.is_current ? "now" : c.end_date?.slice(0, 4) || "?"}
                    </td>
                    <td className="py-2.5">
                      <p className="font-semibold">
                        {c.club_name}
                        {c.is_current && <span className="ml-2 text-[10px] font-bold text-[#F47721]">CURRENT</span>}
                      </p>
                      <p className="text-xs text-[#AEB5C0]">{c.league_or_division || "League not specified"}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className={card}>
          <h2 className={cardTitle}>Talent score</h2>
          <div className="mt-4">
            <ScoreGauge value={score} caption={TALENT_SCORE_EXPLAINER} />
          </div>
        </section>
      </div>

      {/* Season detail */}
      <section className={`${card} mt-6`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className={cardTitle}>Season detail</h2>
          <span className="rounded-full border border-[#F47721]/40 px-2.5 py-0.5 text-[10px] font-semibold text-[#F47721]">
            est. = estimate from video
          </span>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {detail.map((m) => (
            <div key={m.label} className="rounded-lg border border-[#353941] bg-[#17191D] p-4">
              <dt className="text-xs text-[#AEB5C0]">
                {m.label}
                {m.est && <span className="ml-1 font-semibold text-[#F47721]">est.</span>}
              </dt>
              <dd className="mt-1 text-xl font-black">{m.value}</dd>
              {m.sub && <dd className="mt-0.5 text-[11px] text-[#AEB5C0]">{m.sub}</dd>}
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-[#AEB5C0]">
          Match stats are entered by the player; distance, speed, sprints and touches are
          estimated from phone footage.
        </p>
      </section>

      {/* Row: matches · heatmap */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section className={card}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className={cardTitle}>Matches</h2>
            {form.length > 0 && (
              <div className="flex items-center gap-3 text-xs text-[#AEB5C0]">
                <span>
                  {record.W}W · {record.D}D · {record.L}L
                </span>
                <span className="flex gap-1" aria-label={`Last ${form.length} results: ${form.join(", ")}`}>
                  {form.map((r, i) => (
                    <span key={i} className={`inline-block w-5 rounded text-center text-[10px] font-bold ${resultPill(r)}`}>
                      {r}
                    </span>
                  ))}
                </span>
              </div>
            )}
          </div>
          {sorted.length === 0 ? (
            <p className="py-10 text-center text-sm text-[#AEB5C0]">No matches logged.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="text-[10px] uppercase tracking-wider text-[#AEB5C0]">
                  <tr>
                    <th className="pb-2 font-semibold">Date</th>
                    <th className="pb-2 font-semibold">Opponent</th>
                    <th className="pb-2 font-semibold">Result</th>
                    <th className="pb-2 text-right font-semibold">Min</th>
                    <th className="pb-2 text-right font-semibold">G</th>
                    <th className="pb-2 text-right font-semibold">A</th>
                    <th className="pb-2 text-right font-semibold">Sh</th>
                    <th className="pb-2 text-right font-semibold">Tk</th>
                    <th className="pb-2 text-right font-semibold">
                      Km <span className="text-[#F47721]">est.</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.slice(0, 12).map((a, i) => {
                    const r = results[i];
                    return (
                      <tr key={a.id} className="border-t border-[#353941]">
                        <td className="whitespace-nowrap py-2.5 pr-3 text-xs text-[#AEB5C0]">{formatDate(a.match?.match_date)}</td>
                        <td className="py-2.5 pr-3">
                          <span className="font-medium">{a.match?.opponent || "Unknown"}</span>
                          {String(a.stat?.data_source || "").includes("video") && (
                            <span className="ml-2 rounded-full bg-[#F47721]/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#F47721]">
                              Video
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap py-2.5 pr-3">
                          {r && (
                            <span className={`mr-2 inline-block w-5 rounded text-center text-[10px] font-bold ${resultPill(r)}`}>
                              {r}
                            </span>
                          )}
                          {a.match?.team_goals ?? "–"}–{a.match?.opponent_goals ?? "–"}
                        </td>
                        <td className="py-2.5 text-right">{a.minutes_played ?? "–"}</td>
                        <td className="py-2.5 text-right font-semibold">{a.stat?.goals ?? "–"}</td>
                        <td className="py-2.5 text-right font-semibold">{a.stat?.assists ?? "–"}</td>
                        <td className="py-2.5 text-right">{a.stat?.shots ?? "–"}</td>
                        <td className="py-2.5 text-right">{a.stat?.tackles ?? "–"}</td>
                        <td className="py-2.5 text-right text-[#D8DCE2]">{a.stat?.distance_km ?? "–"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className={card}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className={cardTitle}>Activity heatmap</h2>
            {heatmaps.length > 0 && (
              <select
                aria-label="Heatmap match"
                value={heatmapSel}
                onChange={(e) => setHeatmapSel(e.target.value)}
                className="rounded-lg border border-[#454A54] bg-[#17191D] px-3 py-1.5 text-xs"
              >
                <option value="all">All analysed ({heatmaps.length})</option>
                {heatmaps.map((h) => (
                  <option key={h.id} value={h.match_player_id}>
                    {appearanceLabel(h.match_player_id)}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="mt-4">
            {heatmapGrid ? (
              <Heatmap intensities={heatmapGrid} caption="Estimated from match video." />
            ) : (
              <p className="py-10 text-center text-sm text-[#AEB5C0]">No analysed footage yet.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
