import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import PlayerBoard, { type BoardAppearance } from "@/components/PlayerBoard";
import type {
  Club,
  Heatmap as HeatmapRow,
  Match,
  MatchPlayer,
  PerformanceStat,
  PlayerProfile,
} from "@/lib/types";

export default function DashboardPage() {
  return (
    <main className="text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {/* Session-dependent content streams in; reading cookies outside
            Suspense is a build error with cacheComponents enabled. */}
        <Suspense fallback={<p className="text-[#AEB5C0]">Loading your dashboard…</p>}>
          <DashboardContent />
        </Suspense>

        <p className="mt-10 border-t border-[#353941] pt-6 text-xs font-bold tracking-widest text-[#AEB5C0]">
          <span className="text-[#F47721]">BCF</span> — BRINGING CHAMPIONS FORWARD · Pata Talanta.
          Look closer. Discover talent.
        </p>
      </div>
    </main>
  );
}

async function DashboardContent() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");

  const { data: profileRow } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  const profile = (profileRow ?? {
    id: user.id,
    display_name: user.user_metadata?.display_name ?? null,
    county: null,
    position: null,
    role: "player",
    date_of_birth: null,
    discoverable: false,
    guardian_consent: false,
    consent_at: null,
  }) as PlayerProfile;

  if (profile.role === "scout" || user.user_metadata?.role === "scout") redirect("/scout");
  // New players see the consent screen once before anything else.
  if (!user.user_metadata?.onboarded) redirect("/welcome");

  // Board data: appearances → matches, stats and heatmaps; plus clubs.
  const [{ data: apps }, { data: clubs }, { count: pendingRequests }, { count: views }] = await Promise.all([
    supabase
      .from("match_players")
      .select("id, match_id, player_id, minutes_played")
      .eq("player_id", user.id),
    supabase
      .from("player_club_history")
      .select("id, club_name, league_or_division, start_date, end_date, is_current, achievement")
      .eq("player_id", user.id)
      .order("start_date", { ascending: false }),
    supabase
      .from("contact_requests")
      .select("id", { count: "exact", head: true })
      .eq("player_id", user.id)
      .eq("status", "pending"),
    supabase.from("profile_views").select("id", { count: "exact", head: true }).eq("player_id", user.id),
  ]);

  const appearances = (apps || []) as MatchPlayer[];
  const matchIds = [...new Set(appearances.map((a) => a.match_id))];
  const appIds = appearances.map((a) => a.id);

  const [{ data: matchRows }, { data: statRows }, { data: heatRows }] = await Promise.all([
    matchIds.length
      ? supabase
          .from("matches")
          .select("id, club_name, opponent, competition, match_date, team_goals, opponent_goals")
          .in("id", matchIds)
      : Promise.resolve({ data: [] }),
    appIds.length
      ? supabase.from("performance_stats").select("*").in("match_player_id", appIds)
      : Promise.resolve({ data: [] }),
    appIds.length
      ? supabase.from("player_heatmaps").select("*").in("match_player_id", appIds)
      : Promise.resolve({ data: [] }),
  ]);

  const matchById = new Map(((matchRows || []) as Match[]).map((m) => [m.id, m]));
  const statByApp = new Map(((statRows || []) as PerformanceStat[]).map((s) => [s.match_player_id, s]));
  const board: BoardAppearance[] = appearances.map((a) => ({
    ...a,
    match: matchById.get(a.match_id) ?? null,
    stat: statByApp.get(a.id) ?? null,
  }));

  const firstName = (profile.display_name || "Player").split(" ")[0];
  const pending = pendingRequests ?? 0;

  const alerts = (
    <section className="mt-4 grid gap-3 sm:grid-cols-3" aria-label="Scout interest">
      <Link
        href="/dashboard/profile"
        className={`rounded-xl border p-4 transition hover:border-[#F47721] ${
          profile.discoverable ? "border-[#353941] bg-[#1D2025]" : "border-[#F47721]/50 bg-[#F47721]/10"
        }`}
      >
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#AEB5C0]">Visibility</p>
        <p className={`mt-1 font-bold ${profile.discoverable ? "text-green-300" : "text-[#F47721]"}`}>
          {profile.discoverable ? "Visible to scouts" : "Hidden from scouts"}
        </p>
        <p className="mt-0.5 text-xs text-[#AEB5C0]">
          {profile.discoverable ? "Change in your profile" : "Turn on visibility to be discovered →"}
        </p>
      </Link>
      <div className="rounded-xl border border-[#353941] bg-[#1D2025] p-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#AEB5C0]">Scout views</p>
        <p className="mt-1 text-2xl font-black">{views ?? 0}</p>
        <p className="text-xs text-[#AEB5C0]">times scouts opened your profile</p>
      </div>
      <Link
        href="/dashboard/requests"
        className={`rounded-xl border p-4 transition hover:border-[#F47721] ${
          pending > 0 ? "border-[#F47721]/50 bg-[#F47721]/10" : "border-[#353941] bg-[#1D2025]"
        }`}
      >
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#AEB5C0]">Scout requests</p>
        <p className="mt-1 text-2xl font-black">{pending}</p>
        <p className="text-xs text-[#AEB5C0]">{pending > 0 ? "waiting for your reply →" : "no new requests"}</p>
      </Link>
    </section>
  );

  return (
    <PlayerBoard
      profile={profile}
      clubs={(clubs || []) as Club[]}
      appearances={board}
      heatmaps={(heatRows || []) as HeatmapRow[]}
      breadcrumb={
        <>
          Player dashboard / <span className="font-semibold text-white">Welcome back, {firstName}</span>
        </>
      }
      action={
        <>
          <Link
            href="/dashboard/matches"
            className="rounded-lg bg-[#F47721] px-5 py-2.5 text-center text-sm font-bold text-white transition hover:bg-[#DB6418]"
          >
            + Log a match
          </Link>
          <Link
            href="/dashboard/videos"
            className="rounded-lg border border-[#454A54] px-5 py-2.5 text-center text-sm font-semibold transition hover:border-[#F47721] hover:text-[#F47721]"
          >
            Upload video
          </Link>
          <Link
            href="/dashboard/profile"
            className="text-center text-xs text-[#AEB5C0] transition hover:text-[#F47721]"
          >
            Edit profile
          </Link>
        </>
      }
      aside={alerts}
    />
  );
}
