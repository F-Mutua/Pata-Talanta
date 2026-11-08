"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import Heatmap from "@/components/Heatmap";
import { combineHeatmaps } from "@/lib/stats";
import type { Heatmap as HeatmapRow } from "@/lib/types";

type Match = {
  id: string;
  club_name: string | null;
  opponent: string | null;
  competition: string | null;
  match_date: string | null;
  venue: string | null;
  match_type: string | null;
  team_goals: number | null;
  opponent_goals: number | null;
};

type MatchPlayer = {
  id: string;
  match_id: string;
  player_id: string;
  minutes_played: number | null;
  started: boolean | null;
  position_played: string | null;
};

type PerformanceStat = {
  id: string;
  match_player_id: string;
  goals: number | null;
  assists: number | null;
  shots: number | null;
  shots_on_target: number | null;
  tackles: number | null;
  interceptions: number | null;
  passes_completed: number | null;
  passes_attempted: number | null;
  distance_km: number | null;
  top_speed_kmh: number | null;
  sprint_count: number | null;
  touches: number | null;
  data_source: string | null;
  notes: string | null;
  created_at: string;
};

type Appearance = MatchPlayer & {
  match: Match | null;
  performance: PerformanceStat | null;
};

type FormData = {
  match_player_id: string;
  goals: string;
  assists: string;
  shots: string;
  shots_on_target: string;
  tackles: string;
  interceptions: string;
  passes_completed: string;
  passes_attempted: string;
  distance_km: string;
  top_speed_kmh: string;
  sprint_count: string;
  touches: string;
  notes: string;
};

const emptyForm: FormData = {
  match_player_id: "",
  goals: "",
  assists: "",
  shots: "",
  shots_on_target: "",
  tackles: "",
  interceptions: "",
  passes_completed: "",
  passes_attempted: "",
  distance_km: "",
  top_speed_kmh: "",
  sprint_count: "",
  touches: "",
  notes: "",
};

function numberValue(value: string): number | null {
  if (value.trim() === "") return null;

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function displayNumber(value: number | null | undefined, suffix = "") {
  if (value === null || value === undefined) return "—";
  return `${value}${suffix}`;
}

function formatDate(value: string | null) {
  if (!value) return "Date unavailable";

  return new Date(`${value}T00:00:00`).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function calculateAccuracy(
  completed: number | null | undefined,
  attempted: number | null | undefined
) {
  if (
    completed === null ||
    completed === undefined ||
    attempted === null ||
    attempted === undefined ||
    attempted <= 0
  ) {
    return null;
  }

  return Math.round((completed / attempted) * 100);
}

export default function PerformancePage() {
  const supabase = createClient();

  const [appearances, setAppearances] = useState<Appearance[]>([]);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [heatmaps, setHeatmaps] = useState<HeatmapRow[]>([]);
  const [heatmapSel, setHeatmapSel] = useState("all");

  async function loadPerformance() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        window.location.href = "/login";
        return;
      }

      // 1. Retrieve this player's match appearances.
      const { data: playerMatches, error: playerMatchesError } =
        await supabase
          .from("match_players")
          .select(
            "id, match_id, player_id, minutes_played, started, position_played"
          )
          .eq("player_id", user.id);

      if (playerMatchesError) throw playerMatchesError;

      const appearancesData = (playerMatches || []) as MatchPlayer[];

      if (appearancesData.length === 0) {
        setAppearances([]);
        setLoading(false);
        return;
      }

      const matchIds = [
        ...new Set(appearancesData.map((item) => item.match_id)),
      ];

      const appearanceIds = appearancesData.map((item) => item.id);

      // 2. Retrieve the corresponding matches.
      const { data: matchesData, error: matchesError } = await supabase
        .from("matches")
        .select(
          "id, club_name, opponent, competition, match_date, venue, match_type, team_goals, opponent_goals"
        )
        .in("id", matchIds);

      if (matchesError) throw matchesError;

      // 3. Retrieve performance records linked to those appearances.
      const { data: statsData, error: statsError } = await supabase
        .from("performance_stats")
        .select("*")
        .in("match_player_id", appearanceIds);

      if (statsError) throw statsError;

      // Heatmaps come from the video pipeline; a missing table or no rows
      // simply means nothing has been analysed yet.
      const { data: heatData } = await supabase
        .from("player_heatmaps")
        .select("*")
        .in("match_player_id", appearanceIds);
      setHeatmaps((heatData || []) as HeatmapRow[]);

      const matches = (matchesData || []) as Match[];
      const stats = (statsData || []) as PerformanceStat[];

      const matchMap = new Map(matches.map((match) => [match.id, match]));

      const statsMap = new Map(
        stats.map((stat) => [stat.match_player_id, stat])
      );

      const combined: Appearance[] = appearancesData
        .map((appearance) => ({
          ...appearance,
          match: matchMap.get(appearance.match_id) || null,
          performance: statsMap.get(appearance.id) || null,
        }))
        .sort((a, b) => {
          const dateA = a.match?.match_date || "";
          const dateB = b.match?.match_date || "";
          return dateB.localeCompare(dateA);
        });

      setAppearances(combined);

      // Keep a valid selected appearance when refreshing.
      setForm((previous) => {
        const selectedStillExists = combined.some(
          (item) => item.id === previous.match_player_id
        );

        return {
          ...previous,
          match_player_id: selectedStillExists
            ? previous.match_player_id
            : combined[0]?.id || "",
        };
      });
    } catch (err) {
      console.error("Performance loading error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Could not load performance records."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // loadPerformance() awaits before its state updates that matter here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPerformance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recordedAppearances = useMemo(
    () => appearances.filter((item) => item.performance !== null),
    [appearances]
  );

  const totals = useMemo(() => {
    const sum = (key: keyof PerformanceStat) =>
      recordedAppearances.reduce((total, item) => {
        const value = item.performance?.[key];

        return total + (typeof value === "number" ? value : 0);
      }, 0);

    const minutes = appearances.reduce(
      (total, item) => total + (item.minutes_played || 0),
      0
    );

    const completed = sum("passes_completed");
    const attempted = sum("passes_attempted");

    const distances = recordedAppearances
      .map((item) => item.performance?.distance_km)
      .filter((value): value is number => typeof value === "number");

    const speeds = recordedAppearances
      .map((item) => item.performance?.top_speed_kmh)
      .filter((value): value is number => typeof value === "number");

    return {
      matches: appearances.length,
      recorded: recordedAppearances.length,
      goals: sum("goals"),
      assists: sum("assists"),
      shots: sum("shots"),
      shotsOnTarget: sum("shots_on_target"),
      tackles: sum("tackles"),
      interceptions: sum("interceptions"),
      completed,
      attempted,
      accuracy: calculateAccuracy(completed, attempted),
      minutes,
      distance: distances.reduce((a, b) => a + b, 0),
      averageDistance:
        distances.length > 0
          ? distances.reduce((a, b) => a + b, 0) / distances.length
          : null,
      topSpeed: speeds.length > 0 ? Math.max(...speeds) : null,
      sprints: sum("sprint_count"),
      touches: sum("touches"),
    };
  }, [appearances, recordedAppearances]);

  const contributions = totals.goals + totals.assists;

  const trendRecords = [...recordedAppearances]
    .filter((item) => item.match?.match_date)
    .sort((a, b) =>
      (a.match?.match_date || "").localeCompare(b.match?.match_date || "")
    )
    .slice(-6);

  const maxContribution = Math.max(
    1,
    ...trendRecords.map(
      (item) =>
        (item.performance?.goals || 0) + (item.performance?.assists || 0)
    )
  );

  function updateForm(field: keyof FormData, value: string) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  async function savePerformance(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!form.match_player_id) {
      setError("Please select a match appearance first.");
      return;
    }

    const selectedAppearance = appearances.find(
      (item) => item.id === form.match_player_id
    );

    if (!selectedAppearance) {
      setError("The selected match appearance could not be found.");
      return;
    }

    if (selectedAppearance.performance) {
      setError(
        "A performance record already exists for this appearance. You can only add one record per appearance using this form."
      );
      return;
    }

    const shots = numberValue(form.shots);
    const shotsOnTarget = numberValue(form.shots_on_target);
    const completed = numberValue(form.passes_completed);
    const attempted = numberValue(form.passes_attempted);

    if (
      shots !== null &&
      shotsOnTarget !== null &&
      shotsOnTarget > shots
    ) {
      setError("Shots on target cannot exceed total shots.");
      return;
    }

    if (
      completed !== null &&
      attempted !== null &&
      completed > attempted
    ) {
      setError("Completed passes cannot exceed attempted passes.");
      return;
    }

    setSaving(true);

    try {
      const { data: inserted, error: insertError } = await supabase
        .from("performance_stats")
        .insert({
          match_player_id: form.match_player_id,
          goals: numberValue(form.goals),
          assists: numberValue(form.assists),
          shots,
          shots_on_target: shotsOnTarget,
          tackles: numberValue(form.tackles),
          interceptions: numberValue(form.interceptions),
          passes_completed: completed,
          passes_attempted: attempted,
          distance_km: numberValue(form.distance_km),
          top_speed_kmh: numberValue(form.top_speed_kmh),
          sprint_count: numberValue(form.sprint_count),
          touches: numberValue(form.touches),
          notes: form.notes.trim() || null,
          data_source: "player_entry",
        })
        .select("id")
        .single();

      if (insertError) throw insertError;

      setSuccess("Performance record saved successfully.");
      setForm({
        ...emptyForm,
        match_player_id: form.match_player_id,
      });

      await loadPerformance();
    } catch (err) {
      console.error("Performance save error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Could not save the performance record."
      );
    } finally {
      setSaving(false);
    }
  }

  const selectedAppearance = appearances.find(
    (item) => item.id === form.match_player_id
  );

  const inputClass =
    "w-full rounded-lg border border-[#454A54] bg-[#1D2025] px-3 py-3 text-white outline-none transition focus:border-[#F47721]";

  const labelClass = "mb-2 block text-sm font-medium text-[#D8DCE2]";


  if (loading) {
    return (
      <main className="px-5 py-12 text-white">
        <div className="mx-auto max-w-6xl">
          <p className="text-[#AEB5C0]">Loading your performance...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="px-5 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        {/* Page heading */}
        <div className="mb-10 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-[#F47721]">
              Pata Talanta / Player dashboard
            </p>

            <h1 className="text-3xl font-bold sm:text-4xl">
              Performance <span className="text-[#F47721]">centre.</span>
            </h1>

            <p className="mt-3 max-w-xl text-sm leading-6 text-[#AEB5C0]">
              Track your match contributions, technical ability and physical
              performance as your football journey develops.
            </p>
          </div>

          <a
            href="/dashboard"
            className="rounded-lg border border-[#454A54] px-4 py-2 text-sm text-[#D8DCE2] transition hover:border-[#F47721] hover:text-white"
          >
            Back to dashboard
          </a>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-lg border border-green-500/40 bg-green-500/10 p-4 text-sm text-green-300">
            {success}
          </div>
        )}

        {/* Summary */}
        <section className="mb-10">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold">Your season overview</h2>
              <p className="mt-1 text-sm text-[#AEB5C0]">
                Statistics calculated from your recorded match appearances.
              </p>
            </div>
            <span className="text-xs text-[#AEB5C0]">
              {totals.recorded} performance records
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <MetricCard label="Matches played" value={totals.matches} />
            <MetricCard label="Goals" value={totals.goals} />
            <MetricCard label="Assists" value={totals.assists} />
            <MetricCard
              label="Goal contributions"
              value={contributions}
              detail="Goals + assists"
            />
            <MetricCard label="Tackles" value={totals.tackles} />
            <MetricCard label="Interceptions" value={totals.interceptions} />
            <MetricCard
              label="Passing accuracy"
              value={
                totals.accuracy === null ? "—" : `${totals.accuracy}%`
              }
              detail={`${totals.completed} completed / ${totals.attempted} attempted`}
            />
            <MetricCard
              label="Minutes played"
              value={totals.minutes.toLocaleString()}
            />
          </div>
        </section>

        {/* Technical and physical metrics */}
        <section className="mb-10">
          <h2 className="mb-4 text-xl font-bold">
            Technical and physical metrics
          </h2>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <MetricCard label="Total shots" value={totals.shots} />
            <MetricCard
              label="Shots on target"
              value={totals.shotsOnTarget}
            />
            <MetricCard
              label="Total distance"
              value={`${totals.distance.toFixed(1)} km`}
              detail={
                totals.averageDistance === null
                  ? "No distance records yet"
                  : `${totals.averageDistance.toFixed(1)} km average per recorded match`
              }
            />
            <MetricCard
              label="Top speed"
              value={displayNumber(totals.topSpeed, " km/h")}
            />
            <MetricCard label="Sprints" value={totals.sprints} />
            <MetricCard label="Touches" value={totals.touches} />
          </div>
        </section>

        {/* Performance trends */}
        <section className="mb-10 rounded-xl border border-[#353941] bg-[#22252B] p-5 sm:p-6">
          <h2 className="text-xl font-bold">Recent performance trend</h2>
          <p className="mt-1 text-sm text-[#AEB5C0]">
            Goals and assists across your latest recorded appearances.
          </p>

          {trendRecords.length === 0 ? (
            <p className="py-10 text-center text-sm text-[#AEB5C0]">
              Your performance trend will appear after you record match
              statistics.
            </p>
          ) : (
            <div className="mt-7 space-y-5">
              {trendRecords.map((item) => {
                const goals = item.performance?.goals || 0;
                const assists = item.performance?.assists || 0;
                const total = goals + assists;
                const width = (total / maxContribution) * 100;

                return (
                  <div key={item.id}>
                    <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                      <div>
                        <span className="font-medium text-white">
                          vs {item.match?.opponent || "Unknown opponent"}
                        </span>
                        <span className="ml-2 text-xs text-[#AEB5C0]">
                          {formatDate(item.match?.match_date || null)}
                        </span>
                      </div>

                      <span className="whitespace-nowrap text-[#D8DCE2]">
                        {goals}G / {assists}A
                      </span>
                    </div>

                    <div className="h-3 overflow-hidden rounded-full bg-[#353941]">
                      <div
                        className="h-full rounded-full bg-[#F47721] transition-all"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Heatmap */}
        <section className="mb-10 rounded-xl border border-[#353941] bg-[#22252B] p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">Activity heatmap</h2>
              <p className="mt-1 text-sm text-[#AEB5C0]">
                Where you spend your time on the pitch, generated from analysed match video.
              </p>
            </div>
            {heatmaps.length > 0 && (
              <select
                aria-label="Heatmap match"
                value={heatmapSel}
                onChange={(e) => setHeatmapSel(e.target.value)}
                className="rounded-lg border border-[#454A54] bg-[#1D2025] px-3 py-2 text-sm"
              >
                <option value="all">All analysed matches ({heatmaps.length})</option>
                {heatmaps.map((h) => {
                  const a = appearances.find((x) => x.id === h.match_player_id);
                  return (
                    <option key={h.id} value={h.match_player_id}>
                      vs {a?.match?.opponent || "Unknown"} — {formatDate(a?.match?.match_date || null)}
                    </option>
                  );
                })}
              </select>
            )}
          </div>

          <div className="mt-6">
            {(() => {
              const grid =
                heatmapSel === "all"
                  ? combineHeatmaps(heatmaps.map((h) => h.intensities))
                  : heatmaps.find((h) => h.match_player_id === heatmapSel)?.intensities;
              return grid ? (
                <Heatmap intensities={grid} />
              ) : (
                <div className="rounded-lg border border-dashed border-[#454A54] p-8 text-center text-sm text-[#AEB5C0]">
                  No heatmap yet.{" "}
                  <Link href="/dashboard/videos" className="font-semibold text-[#F47721] hover:text-[#DB6418]">
                    Upload match footage
                  </Link>{" "}
                  linked to a match to generate one.
                </div>
              );
            })()}
          </div>
        </section>

        {/* Add performance record */}
        <section className="mb-10 rounded-xl border border-[#353941] bg-[#22252B] p-5 sm:p-7">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#F47721]">
              Match data
            </p>
            <h2 className="mt-2 text-xl font-bold">Record performance</h2>
            <p className="mt-2 text-sm text-[#AEB5C0]">
              Select one of your match appearances and enter your statistics.
            </p>
          </div>

          {appearances.length === 0 ? (
            <div className="rounded-lg border border-[#353941] bg-[#1D2025] p-5">
              <p className="font-medium text-white">
                No match appearances found.
              </p>
              <p className="mt-2 text-sm text-[#AEB5C0]">
                Add a match and make sure your player appearance is registered
                before recording performance statistics.
              </p>
              <a
                href="/dashboard/matches"
                className="mt-4 inline-block text-sm font-semibold text-[#F47721] hover:text-[#DB6418]"
              >
                Go to match history →
              </a>
            </div>
          ) : (
            <form onSubmit={savePerformance} className="space-y-6">
              <div>
                <label className={labelClass}>Select match appearance</label>

                <select
                  value={form.match_player_id}
                  onChange={(event) =>
                    updateForm("match_player_id", event.target.value)
                  }
                  className={inputClass}
                  required
                >
                  {appearances.map((item) => {
                    const match = item.match;

                    return (
                      <option key={item.id} value={item.id}>
                        {match?.opponent || "Unknown opponent"} —{" "}
                        {formatDate(match?.match_date || null)}
                        {item.performance ? " (Already recorded)" : ""}
                      </option>
                    );
                  })}
                </select>

                {selectedAppearance && (
                  <div className="mt-3 rounded-lg bg-[#1D2025] p-3 text-sm text-[#AEB5C0]">
                    <p>
                      <span className="text-white">Club:</span>{" "}
                      {selectedAppearance.match?.club_name || "Not specified"}
                    </p>
                    <p className="mt-1">
                      <span className="text-white">Minutes played:</span>{" "}
                      {displayNumber(selectedAppearance.minutes_played)}
                    </p>
                    <p className="mt-1">
                      <span className="text-white">Position:</span>{" "}
                      {selectedAppearance.position_played || "Not specified"}
                    </p>
                  </div>
                )}

                {selectedAppearance?.performance && (
                  <p className="mt-3 text-sm text-[#F47721]">
                    This appearance already has a performance record.
                  </p>
                )}
              </div>

              <div>
                <h3 className="mb-3 font-semibold text-white">
                  Attacking contribution
                </h3>

                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  {(
                    [
                      ["goals", "Goals"],
                      ["assists", "Assists"],
                      ["shots", "Shots"],
                      ["shots_on_target", "Shots on target"],
                    ] as const
                  ).map(([field, label]) => (
                    <div key={field}>
                      <label className={labelClass}>{label}</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={form[field]}
                        onChange={(event) =>
                          updateForm(field, event.target.value)
                        }
                        className={inputClass}
                        placeholder="0"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="mb-3 font-semibold text-white">
                  Defensive contribution
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  {(
                    [
                      ["tackles", "Tackles"],
                      ["interceptions", "Interceptions"],
                    ] as const
                  ).map(([field, label]) => (
                    <div key={field}>
                      <label className={labelClass}>{label}</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={form[field]}
                        onChange={(event) =>
                          updateForm(field, event.target.value)
                        }
                        className={inputClass}
                        placeholder="0"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="mb-3 font-semibold text-white">
                  Passing and possession
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  {(
                    [
                      ["passes_completed", "Passes completed"],
                      ["passes_attempted", "Passes attempted"],
                      ["touches", "Touches"],
                    ] as const
                  ).map(([field, label]) => (
                    <div key={field}>
                      <label className={labelClass}>{label}</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={form[field]}
                        onChange={(event) =>
                          updateForm(field, event.target.value)
                        }
                        className={inputClass}
                        placeholder="0"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="mb-3 font-semibold text-white">
                  Physical performance
                </h3>

                <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                  {(
                    [
                      ["distance_km", "Distance covered (km)", "0.1"],
                      ["top_speed_kmh", "Top speed (km/h)", "0.1"],
                      ["sprint_count", "Sprint count", "1"],
                    ] as const
                  ).map(([field, label, step]) => (
                    <div key={field}>
                      <label className={labelClass}>{label}</label>
                      <input
                        type="number"
                        min="0"
                        step={step}
                        value={form[field]}
                        onChange={(event) =>
                          updateForm(field, event.target.value)
                        }
                        className={inputClass}
                        placeholder="0"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className={labelClass}>Performance notes</label>
                <textarea
                  value={form.notes}
                  onChange={(event) =>
                    updateForm("notes", event.target.value)
                  }
                  rows={4}
                  className={inputClass}
                  placeholder="Describe your performance, key moments or areas to improve..."
                />
              </div>

              <button
                type="submit"
                disabled={
                  saving ||
                  !form.match_player_id ||
                  Boolean(selectedAppearance?.performance)
                }
                className="w-full rounded-lg bg-[#F47721] px-5 py-3 font-bold text-white transition hover:bg-[#DB6418] disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
              >
                {saving ? "Saving performance..." : "Save performance"}
              </button>
            </form>
          )}
        </section>

        {/* Match-by-match records */}
        <section>
          <div className="mb-4">
            <h2 className="text-xl font-bold">Match-by-match performance</h2>
            <p className="mt-1 text-sm text-[#AEB5C0]">
              Your match appearances and recorded statistics.
            </p>
          </div>

          {appearances.length === 0 ? (
            <div className="rounded-xl border border-[#353941] bg-[#22252B] p-6 text-center text-sm text-[#AEB5C0]">
              No match appearances to display yet.
            </div>
          ) : (
            <div className="space-y-3">
              {appearances.map((item) => {
                const stat = item.performance;
                const accuracy = calculateAccuracy(
                  stat?.passes_completed,
                  stat?.passes_attempted
                );

                return (
                  <div
                    key={item.id}
                    className="rounded-xl border border-[#353941] bg-[#22252B] p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-white">
                          {item.match?.club_name || "Your team"}{" "}
                          <span className="font-normal text-[#AEB5C0]">
                            vs
                          </span>{" "}
                          {item.match?.opponent || "Unknown opponent"}
                        </h3>

                        <p className="mt-1 text-xs text-[#AEB5C0]">
                          {formatDate(item.match?.match_date || null)}
                          {item.match?.competition
                            ? ` · ${item.match.competition}`
                            : ""}
                        </p>

                        <p className="mt-1 text-xs text-[#AEB5C0]">
                          {item.minutes_played ?? "—"} minutes
                          {item.position_played
                            ? ` · ${item.position_played}`
                            : ""}
                          {item.started ? " · Started" : ""}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-sm font-semibold text-white">
                          {item.match?.team_goals ?? "—"} -{" "}
                          {item.match?.opponent_goals ?? "—"}
                        </p>

                        <p
                          className={`mt-1 text-xs ${
                            stat ? "text-[#F47721]" : "text-[#AEB5C0]"
                          }`}
                        >
                          {stat
                            ? String(stat.data_source || "").includes("video")
                              ? "Stats from video"
                              : "Performance recorded"
                            : "Awaiting statistics"}
                        </p>
                      </div>
                    </div>

                    {stat && (
                      <div className="mt-5 grid grid-cols-2 gap-3 border-t border-[#353941] pt-4 sm:grid-cols-4">
                        <div>
                          <p className="text-xs text-[#AEB5C0]">Goals</p>
                          <p className="mt-1 font-semibold">
                            {stat.goals ?? "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-[#AEB5C0]">Assists</p>
                          <p className="mt-1 font-semibold">
                            {stat.assists ?? "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-[#AEB5C0]">Tackles</p>
                          <p className="mt-1 font-semibold">
                            {stat.tackles ?? "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-[#AEB5C0]">
                            Interceptions
                          </p>
                          <p className="mt-1 font-semibold">
                            {stat.interceptions ?? "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-[#AEB5C0]">
                            Passing accuracy
                          </p>
                          <p className="mt-1 font-semibold">
                            {accuracy === null ? "—" : `${accuracy}%`}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-[#AEB5C0]">
                            Distance
                          </p>
                          <p className="mt-1 font-semibold">
                            {displayNumber(stat.distance_km, " km")}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-[#AEB5C0]">Top speed</p>
                          <p className="mt-1 font-semibold">
                            {displayNumber(stat.top_speed_kmh, " km/h")}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-[#AEB5C0]">Sprints</p>
                          <p className="mt-1 font-semibold">
                            {stat.sprint_count ?? "—"}
                          </p>
                        </div>
                      </div>
                    )}

                    {stat?.notes && (
                      <p className="mt-4 border-t border-[#353941] pt-3 text-sm leading-6 text-[#AEB5C0]">
                        {stat.notes}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail?: string;
}) {
  return (
    <div className="rounded-xl border border-[#353941] bg-[#1D2025] p-5">
      <p className="text-sm text-[#AEB5C0]">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-white">
        {value}
      </p>
      {detail && (
        <p className="mt-1 text-xs text-[#AEB5C0]">{detail}</p>
      )}
    </div>
  );
}
