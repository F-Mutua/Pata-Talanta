export type Role = "player" | "scout";

export type PlayerProfile = {
  id: string;
  display_name: string | null;
  county: string | null;
  position: string | null;
  role: string | null;
  date_of_birth: string | null;
  discoverable: boolean | null;
  guardian_consent: boolean | null;
  consent_at: string | null;
  /** Example data from docs/seed-demo-data.sql (column may not exist). */
  is_demo?: boolean | null;
};

export type PlayerContact = {
  player_id: string;
  phone: string | null;
  contact_email: string | null;
  updated_at: string | null;
};

export type ScoutApplicationStatus = "pending" | "approved" | "rejected" | string;

/** A scout's request to be verified by a BCF reviewer (used by ScoutGate). */
export type ScoutApplication = {
  id: string;
  applicant_id: string;
  status: ScoutApplicationStatus;
  verification_authority: string | null;
  notes: string | null;
  created_at: string;
};

export function ageFrom(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const d = new Date(`${dob.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

export type Club = {
  id: string;
  club_name: string;
  league_or_division: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  achievement: string | null;
};

export type Match = {
  id: string;
  club_name: string | null;
  opponent: string | null;
  competition: string | null;
  match_date: string | null;
  team_goals: number | null;
  opponent_goals: number | null;
};

export type MatchPlayer = {
  id: string;
  match_id: string;
  player_id: string;
  minutes_played: number | null;
};

export type PerformanceStat = {
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
  data_source?: string | null;
};

export type Heatmap = {
  id: string;
  match_player_id: string;
  grid_rows: number;
  grid_cols: number;
  /** grid_rows arrays of grid_cols non-negative numbers. */
  intensities: number[][];
  data_source: string | null;
};

export type VideoStatus = "uploaded" | "processing" | "processed" | "failed";

export type MatchVideo = {
  id: string;
  player_id: string;
  match_id: string | null;
  title: string;
  description: string | null;
  storage_path: string;
  file_size_bytes: number | null;
  processing_status: VideoStatus;
  created_at: string;
  /** Video service job; "demo-…" when run against sample results. */
  job_id: string | null;
  /** The tracked person the player tapped as themselves. */
  track_id: number | null;
  result: VideoResult | null;
  annotated_url: string | null;
};

/** Per-player estimates from the video service (see docs/video-api.md). */
export type VideoResult = {
  distance_m: number;
  top_speed_kmh: number;
  sprints: number;
  touches: number;
  /** rows × cols, columns run goal to goal (col 0 = own goal). */
  heatmap: number[][];
  annotated_video_url?: string | null;
  duration_s?: number | null;
  demo?: boolean;
};

export type ContactStatus = "pending" | "accepted" | "declined";

export type ContactRequest = {
  id: string;
  scout_id: string;
  player_id: string;
  message: string;
  proposed_meeting_at: string | null;
  meeting_place: string | null;
  status: ContactStatus;
  created_at: string;
  responded_at: string | null;
};

export const VIDEO_BUCKET = "match-videos";
/** Supabase's default per-file limit for standard uploads. */
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
