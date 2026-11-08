import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import ContributionChart, { type ChartPoint } from "@/components/ContributionChart";
import { formatDate } from "@/lib/ui";

const navigation = [
  {
    title: "My Player Profile",
    description: "Manage your personal football information.",
    href: "/dashboard/profile",
    icon: "01",
  },
  {
    title: "Club History",
    description: "Record your current and previous clubs.",
    href: "/dashboard/clubs",
    icon: "02",
  },
  {
    title: "Match History",
    description: "Log the matches you have played in.",
    href: "/dashboard/matches",
    icon: "03",
  },
  {
    title: "Performance",
    description: "Record statistics and view your heatmaps.",
    href: "/dashboard/performance",
    icon: "04",
  },
  {
    title: "Match Videos",
    description: "Upload footage for analysis and for scouts to review.",
    href: "/dashboard/videos",
    icon: "05",
  },
  {
    title: "Scout Requests",
    description: "Respond to scouts who want to get in touch.",
    href: "/dashboard/requests",
    icon: "06",
  },
];

export default function DashboardPage() {
  return (
    <main className="text-white">
      <div className="mx-auto max-w-7xl px-6 py-12">
        {/* Session-dependent content streams in; reading cookies outside
            Suspense is a build error with cacheComponents enabled. */}
        <Suspense fallback={<p className="text-[#AEB5C0]">Loading your dashboard…</p>}>
          <DashboardContent />
        </Suspense>

        <section className="mt-12">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#F47721]">
            Your football journey
          </p>
          <h2 className="mt-2 text-2xl font-bold">Manage your player career</h2>

          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {navigation.map((item) => (
              <Link
                key={item.title}
                href={item.href}
                className="group rounded-xl border border-[#353941] bg-[#22252B] p-6 transition hover:border-[#F47721] hover:bg-[#282C33]"
              >
                <div className="flex items-start justify-between">
                  <span className="text-sm font-black text-[#F47721]">{item.icon}</span>
                  <span className="text-xl text-[#AEB5C0] transition group-hover:translate-x-1 group-hover:text-[#F47721]">
                    →
                  </span>
                </div>
                <h3 className="mt-6 text-xl font-bold">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#AEB5C0]">{item.description}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-12 border-t border-[#353941] py-8">
          <p className="text-sm font-bold tracking-widest text-[#F47721]">
            BCF — BRINGING CHAMPIONS FORWARD
          </p>
          <p className="mt-2 text-sm text-[#AEB5C0]">Pata Talanta. Look closer. Discover talent.</p>
        </section>
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

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("display_name, role, county, position, discoverable")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role === "scout" || user.user_metadata?.role === "scout") redirect("/scout");
  // New players see the consent screen once before anything else.
  if (!user.user_metadata?.onboarded) redirect("/welcome");

  const [{ count: pendingRequests }, { count: views }] = await Promise.all([
    supabase
      .from("contact_requests")
      .select("id", { count: "exact", head: true })
      .eq("player_id", user.id)
      .eq("status", "pending"),
    supabase
      .from("profile_views")
      .select("id", { count: "exact", head: true })
      .eq("player_id", user.id),
  ]);

  // Season numbers: appearances → matches + stats, plus which have video.
  const { data: apps } = await supabase
    .from("match_players")
    .select("id, match_id, minutes_played")
    .eq("player_id", user.id);
  const appearances = apps || [];
  const matchIds = [...new Set(appearances.map((a) => a.match_id as string))];
  const appIds = appearances.map((a) => a.id as string);

  const [{ data: matchRows }, { data: statRows }, { data: videoRows }] = await Promise.all([
    matchIds.length
      ? supabase.from("matches").select("id, opponent, competition, match_date, team_goals, opponent_goals").in("id", matchIds)
      : Promise.resolve({ data: [] as never[] }),
    appIds.length
      ? supabase.from("performance_stats").select("match_player_id, goals, assists, data_source").in("match_player_id", appIds)
      : Promise.resolve({ data: [] as never[] }),
    supabase.from("match_videos").select("match_id").eq("player_id", user.id),
  ]);

  type M = { id: string; opponent: string | null; competition: string | null; match_date: string | null; team_goals: number | null; opponent_goals: number | null };
  type S = { match_player_id: string; goals: number | null; assists: number | null; data_source: string | null };
  const matchById = new Map(((matchRows || []) as M[]).map((m) => [m.id, m]));
  const statByApp = new Map(((statRows || []) as S[]).map((s) => [s.match_player_id, s]));
  const videoMatchIds = new Set(((videoRows || []) as { match_id: string | null }[]).map((v) => v.match_id).filter(Boolean));

  const rows = appearances
    .map((a) => {
      const m = matchById.get(a.match_id as string) || null;
      const st = statByApp.get(a.id as string) || null;
      return {
        id: a.id as string,
        match: m,
        minutes: (a.minutes_played as number | null) ?? null,
        goals: st?.goals ?? 0,
        assists: st?.assists ?? 0,
        hasStats: !!st,
        fromVideo: String(st?.data_source || "").includes("video") || videoMatchIds.has(a.match_id as string),
      };
    })
    .sort((x, y) => (y.match?.match_date || "").localeCompare(x.match?.match_date || ""));

  const totals = [
    { label: "Matches", value: rows.length },
    { label: "Goals", value: rows.reduce((t, r) => t + r.goals, 0) },
    { label: "Assists", value: rows.reduce((t, r) => t + r.assists, 0) },
    { label: "Minutes", value: rows.reduce((t, r) => t + (r.minutes || 0), 0).toLocaleString() },
  ];

  const chartPoints: ChartPoint[] = rows
    .filter((r) => r.hasStats)
    .slice(0, 8)
    .reverse()
    .map((r) => ({
      id: r.id,
      label: r.match?.opponent || "Unknown",
      date: formatDate(r.match?.match_date),
      goals: r.goals,
      assists: r.assists,
    }));

  const missing = [profile?.display_name, profile?.county, profile?.position].filter(
    (v) => !v
  ).length;

  return (
    <>
      <section className="relative overflow-hidden rounded-2xl border border-[#353941] bg-[#22252B] p-8 md:p-12">
        <div className="absolute -right-10 -top-10 h-64 w-64 rounded-full border-[30px] border-[#F47721]/5" />
        <div className="relative z-10">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#F47721]">
            Player dashboard
          </p>
          <h1 className="mt-4 text-4xl font-black md:text-5xl">
            Welcome back,
            <br />
            <span className="text-[#F47721]">{profile?.display_name || "Player"}.</span>
          </h1>
          <p className="mt-5 max-w-xl leading-7 text-[#AEB5C0]">
            Your talent deserves to be seen. Build your football identity, document your
            journey and put your performance in front of the people looking for the next
            generation of champions.
          </p>

          {profile && !profile.discoverable ? (
            <p className="mt-6 rounded-lg border border-[#F47721]/40 bg-[#F47721]/10 p-4 text-sm">
              <strong className="text-[#F47721]">Scouts can&apos;t see you yet.</strong> Turn on
              visibility in your profile when you&apos;re ready to be discovered.
            </p>
          ) : (
            !!views && (
              <p className="mt-6 text-sm text-[#AEB5C0]">
                Your profile has been viewed <strong className="text-white">{views}</strong> time
                {views === 1 ? "" : "s"} by scouts.
              </p>
            )
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            {(missing > 0 || !profile?.discoverable) && (
              <Link
                href="/dashboard/profile"
                className="inline-flex rounded-lg bg-[#F47721] px-6 py-3 font-bold text-white transition hover:bg-[#DB6418]"
              >
                Complete my profile →
              </Link>
            )}
            {!!pendingRequests && pendingRequests > 0 && (
              <Link
                href="/dashboard/requests"
                className="inline-flex rounded-lg border border-[#F47721] px-6 py-3 font-bold text-[#F47721] transition hover:bg-[#F47721]/10"
              >
                {pendingRequests} new scout request{pendingRequests === 1 ? "" : "s"} →
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="mt-10" aria-label="Season totals">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#F47721]">Season so far</p>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {totals.map((t) => (
            <div key={t.label} className="rounded-xl border border-[#353941] bg-[#22252B] p-5">
              <p className="text-sm text-[#AEB5C0]">{t.label}</p>
              <p className="mt-2 text-3xl font-black">{t.value}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-xl border border-[#353941] bg-[#22252B] p-6">
          <h2 className="text-lg font-bold">Goals + assists per match</h2>
          <p className="mt-1 text-xs text-[#AEB5C0]">Your last {chartPoints.length || 8} matches with stats</p>
          <div className="mt-5">
            {chartPoints.length ? (
              <ContributionChart points={chartPoints} />
            ) : (
              <div className="rounded-lg border border-dashed border-[#454A54] p-8 text-center text-sm text-[#AEB5C0]">
                Your chart appears once you{" "}
                <Link href="/dashboard/matches" className="font-semibold text-[#F47721] hover:underline">
                  log a match with stats
                </Link>
                .
              </div>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-[#353941] bg-[#22252B] p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Recent matches</h2>
            <Link href="/dashboard/matches" className="text-sm font-semibold text-[#F47721] hover:underline">
              All →
            </Link>
          </div>
          {rows.length === 0 ? (
            <p className="mt-4 text-sm text-[#AEB5C0]">No matches logged yet.</p>
          ) : (
            <ul className="mt-4 divide-y divide-[#353941]">
              {rows.slice(0, 5).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">vs {r.match?.opponent || "Unknown"}</p>
                    <p className="text-xs text-[#AEB5C0]">
                      {formatDate(r.match?.match_date)}
                      {r.match?.team_goals != null && r.match?.opponent_goals != null
                        ? ` · ${r.match.team_goals}–${r.match.opponent_goals}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-sm">
                    {r.fromVideo && (
                      <span className="rounded-full bg-[#F47721]/15 px-2 py-0.5 text-[10px] font-bold uppercase text-[#F47721]">
                        Video
                      </span>
                    )}
                    <span className="text-[#D8DCE2]">
                      {r.goals}G {r.assists}A
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-10">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#F47721]">
              Your information
            </p>
            <h2 className="mt-2 text-2xl font-bold">Player overview</h2>
          </div>
          <Link
            href="/dashboard/profile"
            className="text-sm font-semibold text-[#F47721] hover:underline"
          >
            Edit profile →
          </Link>
        </div>

        {profileError || !profile ? (
          <div className="rounded-xl border border-red-500/30 bg-[#22252B] p-6">
            We couldn&apos;t retrieve your profile. Please try again.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { label: "Full name", value: profile.display_name },
              { label: "County", value: profile.county },
              { label: "Playing position", value: profile.position },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-[#353941] bg-[#22252B] p-6">
                <p className="text-sm text-[#AEB5C0]">{item.label}</p>
                <h3 className="mt-3 text-xl font-bold">{item.value || "Not provided"}</h3>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
