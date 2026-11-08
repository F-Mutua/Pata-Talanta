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

/**
 * Prototype "talent score", 0–100. Deliberately simple so a scout can see why
 * a player ranks where they do:
 *   contributions = 4 × goals + 3 × assists + 1 × (tackles + interceptions)
 *   per 90 minutes, with 270 extra minutes added so one good match can't top
 *   the list (shrinks small samples towards zero)
 *   score = 20 × per-90 contributions + 2 per match played (up to 10 matches)
 * It is a starting point for scouting, not a judgement of ability.
 */
export function talentScore(p: {
  matches: number;
  minutes: number;
  goals: number;
  assists: number;
  defensive: number;
}): number {
  const contributions = 4 * p.goals + 3 * p.assists + p.defensive;
  const per90 = contributions / ((p.minutes + 270) / 90);
  return Math.min(100, Math.round(per90 * 20 + Math.min(p.matches, 10) * 2));
}

export const TALENT_SCORE_EXPLAINER =
  "Goals ×4, assists ×3, tackles and interceptions ×1, per 90 minutes (small samples are scaled down), plus 2 points per match up to 10. A starting point, not a verdict.";
