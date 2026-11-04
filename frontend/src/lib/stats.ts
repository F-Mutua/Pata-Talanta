import type { MatchPlayer, PerformanceStat } from "./types";

export type StatTotals = {
  matches: number;
  minutes: number;
  goals: number;
  assists: number;
  tackles: number;
  interceptions: number;
  passingAccuracy: number | null;
  distanceKm: number;
  topSpeed: number | null;
};

export function totalStats(
  appearances: MatchPlayer[],
  stats: PerformanceStat[]
): StatTotals {
  const sum = (key: keyof PerformanceStat) =>
    stats.reduce((t, s) => t + (typeof s[key] === "number" ? (s[key] as number) : 0), 0);

  const completed = sum("passes_completed");
  const attempted = sum("passes_attempted");
  const speeds = stats
    .map((s) => s.top_speed_kmh)
    .filter((v): v is number => typeof v === "number");

  return {
    matches: appearances.length,
    minutes: appearances.reduce((t, a) => t + (a.minutes_played || 0), 0),
    goals: sum("goals"),
    assists: sum("assists"),
    tackles: sum("tackles"),
    interceptions: sum("interceptions"),
    passingAccuracy: attempted > 0 ? Math.round((completed / attempted) * 100) : null,
    distanceKm: sum("distance_km"),
    topSpeed: speeds.length ? Math.max(...speeds) : null,
  };
}

/** Sum several heatmaps of the same shape into one (for a season view). */
export function combineHeatmaps(grids: number[][][]): number[][] | null {
  const valid = grids.filter((g) => g.length && g[0].length);
  if (!valid.length) return null;
  const rows = valid[0].length;
  const cols = valid[0][0].length;
  const out = Array.from({ length: rows }, () => Array(cols).fill(0));
  for (const g of valid) {
    if (g.length !== rows || g[0].length !== cols) continue;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) out[r][c] += Number(g[r][c]) || 0;
  }
  return out;
}
