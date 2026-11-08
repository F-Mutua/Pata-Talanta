"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { useScout } from "@/lib/useScout";
import { ui, formatDate, formatMeeting, errorMessage } from "@/lib/ui";
import { totalStats, combineHeatmaps, talentScore, TALENT_SCORE_EXPLAINER } from "@/lib/stats";
import Heatmap from "@/components/Heatmap";
import ScoreGauge from "@/components/ScoreGauge";
import ContributionChart, { type ChartPoint } from "@/components/ContributionChart";
import {
  ageFrom,
  VIDEO_BUCKET,
  type PlayerContact,
  type Club,
  type ContactRequest,
  type Heatmap as HeatmapRow,
  type Match,
  type MatchPlayer,
  type MatchVideo,
  type PerformanceStat,
  type PlayerProfile,
} from "@/lib/types";

type Data = {
  profile: PlayerProfile;
  clubs: Club[];
  appearances: (MatchPlayer & { match: Match | null; stat: PerformanceStat | null })[];
  heatmaps: HeatmapRow[];
  videos: (MatchVideo & { url: string | null })[];
  requests: ContactRequest[];
};

export default function PlayerView({ playerId }: { playerId: string }) {
  const scoutId = useScout();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [heatmapSel, setHeatmapSel] = useState<string>("all");

  useEffect(() => {
    if (!scoutId) return;
    const supabase = createClient();
    (async () => {
      try {
        const { data: profile, error: pErr } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", playerId)
          .eq("role", "player")
          .maybeSingle();
        if (pErr) throw pErr;
        if (!profile) {
          throw new Error("This player could not be found, or has not made their profile visible to scouts.");
        }

        // Feeds the scout's "recently viewed" list and the player's view count.
        // Failure here must not block the page.
        void supabase.from("profile_views").insert({ scout_id: scoutId, player_id: playerId });

        const [clubs, apps, vids, reqs] = await Promise.all([
          supabase
            .from("player_club_history")
            .select("id, club_name, league_or_division, start_date, end_date, is_current, achievement")
            .eq("player_id", playerId)
            .order("start_date", { ascending: false }),
          supabase
            .from("match_players")
            .select("id, match_id, player_id, minutes_played")
            .eq("player_id", playerId),
          supabase
            .from("match_videos")
            .select("*")
            .eq("player_id", playerId)
            .order("created_at", { ascending: false }),
          supabase
            .from("contact_requests")
            .select("*")
            .eq("player_id", playerId)
            .eq("scout_id", scoutId)
            .order("created_at", { ascending: false }),
        ]);
        if (apps.error) throw apps.error;

        const appearances = (apps.data || []) as MatchPlayer[];
        const matchIds = [...new Set(appearances.map((a) => a.match_id))];
        const appIds = appearances.map((a) => a.id);

        const [matches, stats, heat] = await Promise.all([
          matchIds.length
            ? supabase
                .from("matches")
                .select("id, club_name, opponent, competition, match_date, team_goals, opponent_goals")
                .in("id", matchIds)
            : Promise.resolve({ data: [], error: null }),
          appIds.length
            ? supabase.from("performance_stats").select("*").in("match_player_id", appIds)
            : Promise.resolve({ data: [], error: null }),
          appIds.length
            ? supabase.from("player_heatmaps").select("*").in("match_player_id", appIds)
            : Promise.resolve({ data: [], error: null }),
        ]);

        const matchMap = new Map(((matches.data || []) as Match[]).map((m) => [m.id, m]));
        const statMap = new Map(
          ((stats.data || []) as PerformanceStat[]).map((s) => [s.match_player_id, s])
        );

        // Signed URLs so scouts can stream private footage for an hour.
        const videoRows = (vids.error ? [] : vids.data || []) as MatchVideo[];
        const signed = videoRows.length
          ? await supabase.storage
              .from(VIDEO_BUCKET)
              .createSignedUrls(videoRows.map((v) => v.storage_path), 60 * 60)
          : { data: [] };
        const urlByPath = new Map(
          (signed.data || []).map((s) => [s.path, s.error ? null : s.signedUrl])
        );

        setData({
          profile: profile as PlayerProfile,
          clubs: (clubs.data || []) as Club[],
          appearances: appearances
            .map((a) => ({
              ...a,
              match: matchMap.get(a.match_id) || null,
              stat: statMap.get(a.id) || null,
            }))
            .sort((a, b) =>
              (b.match?.match_date || "").localeCompare(a.match?.match_date || "")
            ),
          heatmaps: (heat.error ? [] : heat.data || []) as HeatmapRow[],
          videos: videoRows.map((v) => ({ ...v, url: urlByPath.get(v.storage_path) ?? null })),
          requests: (reqs.error ? [] : reqs.data || []) as ContactRequest[],
        });
      } catch (err) {
        setError(errorMessage(err, "Could not load this player."));
      }
    })();
  }, [scoutId, playerId]);

  const totals = useMemo(
    () =>
      data
        ? totalStats(
            data.appearances,
            data.appearances.map((a) => a.stat).filter((s): s is PerformanceStat => !!s)
          )
        : null,
    [data]
  );

  const heatmapGrid = useMemo(() => {
    if (!data?.heatmaps.length) return null;
    if (heatmapSel === "all") return combineHeatmaps(data.heatmaps.map((h) => h.intensities));
    return data.heatmaps.find((h) => h.match_player_id === heatmapSel)?.intensities ?? null;
  }, [data, heatmapSel]);

  if (error) {
    return (
      <main className={ui.container}>
        <p className={ui.error}>{error}</p>
        <Link href="/scout" className="mt-6 inline-block text-sm text-[#F47721]">
          ← Back to discovery
        </Link>
      </main>
    );
  }
  if (!data || !totals) {
    return <p className="px-6 py-12 text-[#AEB5C0]">Loading player…</p>;
  }

  const { profile } = data;
  const age = ageFrom(profile.date_of_birth);
  const nameParts = (profile.display_name || "Unnamed player").trim().split(/\s+/);
  const lastName = nameParts.length > 1 ? nameParts.pop()! : nameParts[0];
  const firstNames = nameParts.length ? nameParts.join(" ") : "";

  const appearanceLabel = (id: string) => {
    const a = data.appearances.find((x) => x.id === id);
    return a ? `vs ${a.match?.opponent || "Unknown"} · ${formatDate(a.match?.match_date)}` : "Match";
  };

  const withStats = data.appearances.filter((a) => a.stat);
  const defensive = totals.tackles + totals.interceptions;
  const score = talentScore({ ...totals, defensive });
  const isVideo = (st: PerformanceStat | null) =>
    String((st as (PerformanceStat & { data_source?: string | null }) | null)?.data_source || "").includes("video");

  const chartPoints: ChartPoint[] = withStats
    .slice(0, 8)
    .reverse()
    .map((a) => ({
      id: a.id,
      label: a.match?.opponent || "Unknown",
      date: formatDate(a.match?.match_date),
      goals: a.stat?.goals || 0,
      assists: a.stat?.assists || 0,
    }));

  const infoBoxes: { label: string; value: string }[] = [
    {
      label: "Date of birth",
      value: profile.date_of_birth ? `${formatDate(profile.date_of_birth)} (${age})` : "Not provided",
    },
    { label: "Position", value: profile.position || "Not provided" },
    { label: "County", value: profile.county || "Not provided" },
    { label: "Matches", value: String(totals.matches) },
    { label: "Goals", value: String(totals.goals) },
    { label: "Assists", value: String(totals.assists) },
  ];

  const physical = [
    { label: "Minutes played", value: totals.minutes.toLocaleString(), est: false },
    {
      label: "Passing accuracy",
      value: totals.passingAccuracy === null ? "—" : `${totals.passingAccuracy}%`,
      est: false,
    },
    { label: "Tackles + interceptions", value: String(defensive), est: false },
    { label: "Distance covered", value: `${totals.distanceKm.toFixed(1)} km`, est: true },
    { label: "Top speed", value: totals.topSpeed === null ? "—" : `${totals.topSpeed} km/h`, est: true },
  ];

  const card = "rounded-xl border border-[#353941] bg-[#1D2025] p-5";
  const cardTitle = "text-sm font-bold uppercase tracking-wide text-[#D8DCE2]";

  return (
    <main className="text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <nav className="text-xs text-[#AEB5C0]" aria-label="Breadcrumb">
          <Link href="/scout" className="hover:text-[#F47721]">
            Discover players
          </Link>{" "}
          / <span className="font-semibold text-white">{profile.display_name || "Player"}</span>
        </nav>

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
                {profile.is_demo && (
                  <span className="mt-1 inline-block rounded border border-[#454A54] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#AEB5C0]">
                    Example data · fictional player
                  </span>
                )}
                <p className="mt-1 text-sm text-[#AEB5C0]">
                  {[profile.position, profile.county].filter(Boolean).join(" · ") || "Grassroots player"}
                </p>
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

            <a href="#contact" className={`${ui.button} text-center lg:self-center`}>
              Request full profile
            </a>
          </div>
        </section>

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
            {data.clubs.length === 0 ? (
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
                  {data.clubs.slice(0, 6).map((c) => (
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

        {/* Technical and physical */}
        <section className={`${card} mt-6`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className={cardTitle}>Season detail</h2>
            <span className="rounded-full border border-[#F47721]/40 px-2.5 py-0.5 text-[10px] font-semibold text-[#F47721]">
              est. = estimate from video
            </span>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {physical.map((m) => (
              <div key={m.label} className="rounded-lg border border-[#353941] bg-[#17191D] p-4">
                <dt className="text-xs text-[#AEB5C0]">
                  {m.label}
                  {m.est && <span className="ml-1 font-semibold text-[#F47721]">est.</span>}
                </dt>
                <dd className="mt-1 text-xl font-black">{m.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-[#AEB5C0]">
            Match stats are entered by the player; distance and speed are estimated from phone
            footage. Use them alongside the videos and your own assessment.
          </p>
        </section>

        {/* Row: matches · heatmap */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <section className={card}>
            <h2 className={cardTitle}>Matches</h2>
            {data.appearances.length === 0 ? (
              <p className="py-10 text-center text-sm text-[#AEB5C0]">No matches logged.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="text-[10px] uppercase tracking-wider text-[#AEB5C0]">
                    <tr>
                      <th className="pb-2 font-semibold">Date</th>
                      <th className="pb-2 font-semibold">Opponent</th>
                      <th className="pb-2 font-semibold">Result</th>
                      <th className="pb-2 text-right font-semibold">Min</th>
                      <th className="pb-2 text-right font-semibold">G</th>
                      <th className="pb-2 text-right font-semibold">A</th>
                      <th className="pb-2 text-right font-semibold">Km <span className="text-[#F47721]">est.</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.appearances.slice(0, 12).map((a) => {
                      const tg = a.match?.team_goals;
                      const og = a.match?.opponent_goals;
                      const res = tg == null || og == null ? null : tg > og ? "W" : tg < og ? "L" : "D";
                      return (
                        <tr key={a.id} className="border-t border-[#353941]">
                          <td className="whitespace-nowrap py-2.5 pr-3 text-xs text-[#AEB5C0]">
                            {formatDate(a.match?.match_date)}
                          </td>
                          <td className="py-2.5 pr-3">
                            <span className="font-medium">{a.match?.opponent || "Unknown"}</span>
                            {isVideo(a.stat) && (
                              <span className="ml-2 rounded-full bg-[#F47721]/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#F47721]">
                                Video
                              </span>
                            )}
                          </td>
                          <td className="whitespace-nowrap py-2.5 pr-3">
                            {res && (
                              <span
                                className={`mr-2 inline-block w-5 rounded text-center text-[10px] font-bold ${
                                  res === "W"
                                    ? "bg-green-500/20 text-green-300"
                                    : res === "L"
                                      ? "bg-red-500/20 text-red-300"
                                      : "bg-[#454A54] text-[#D8DCE2]"
                                }`}
                                aria-label={res === "W" ? "Win" : res === "L" ? "Loss" : "Draw"}
                              >
                                {res}
                              </span>
                            )}
                            {tg ?? "–"}–{og ?? "–"}
                          </td>
                          <td className="py-2.5 text-right">{a.minutes_played ?? "–"}</td>
                          <td className="py-2.5 text-right font-semibold">{a.stat?.goals ?? "–"}</td>
                          <td className="py-2.5 text-right font-semibold">{a.stat?.assists ?? "–"}</td>
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
              {data.heatmaps.length > 0 && (
                <select
                  aria-label="Heatmap match"
                  value={heatmapSel}
                  onChange={(e) => setHeatmapSel(e.target.value)}
                  className="rounded-lg border border-[#454A54] bg-[#17191D] px-3 py-1.5 text-xs"
                >
                  <option value="all">All analysed ({data.heatmaps.length})</option>
                  {data.heatmaps.map((h) => (
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

        {/* Footage */}
        <section className="mt-6">
          <h2 className={`${cardTitle} mb-3`}>Match footage</h2>
          {data.videos.length === 0 ? (
            <div className={ui.empty}>No videos uploaded.</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {data.videos.map((v) => (
                <article key={v.id} className={card}>
                  {v.url ? (
                    <video src={v.url} controls preload="metadata" playsInline className="w-full rounded-lg bg-black" />
                  ) : (
                    <div className={ui.empty}>Video unavailable</div>
                  )}
                  <h3 className="mt-3 font-bold">{v.title}</h3>
                  <p className="mt-1 text-xs text-[#AEB5C0]">Uploaded {formatDate(v.created_at)}</p>
                  {v.description && <p className="mt-2 text-sm text-[#AEB5C0]">{v.description}</p>}
                </article>
              ))}
            </div>
          )}
        </section>

        <div id="contact" className="mt-6 scroll-mt-20 lg:max-w-2xl">
          <ContactPanel
            playerId={playerId}
            scoutId={scoutId!}
            playerName={profile.display_name || "this player"}
            isMinor={(age ?? 99) < 18}
            requests={data.requests}
            onSent={(r) => setData((d) => (d ? { ...d, requests: [r, ...d.requests] } : d))}
          />
        </div>
      </div>
    </main>
  );
}

function ContactPanel({
  playerId,
  scoutId,
  playerName,
  isMinor,
  requests,
  onSent,
}: {
  playerId: string;
  scoutId: string;
  playerName: string;
  isMinor: boolean;
  requests: ContactRequest[];
  onSent: (r: ContactRequest) => void;
}) {
  const [message, setMessage] = useState("");
  const [meetingAt, setMeetingAt] = useState("");
  const [meetingPlace, setMeetingPlace] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [contact, setContact] = useState<PlayerContact | null>(null);

  // One request per scout and player, ever, so the latest is the only one.
  const request = requests[0] ?? null;

  useEffect(() => {
    if (request?.status !== "accepted") return;
    // RLS only returns this row once the player has accepted this scout.
    createClient()
      .from("player_contacts")
      .select("player_id, phone, contact_email, updated_at")
      .eq("player_id", playerId)
      .maybeSingle()
      .then(({ data }) => setContact((data as PlayerContact) ?? null));
  }, [request?.status, playerId]);

  async function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (message.trim().length < 20) {
      setError("Please write at least a couple of sentences about who you are and why you're reaching out.");
      return;
    }
    if (meetingAt && new Date(meetingAt) < new Date()) {
      setError("The proposed meeting time is in the past.");
      return;
    }
    setSending(true);
    const { data, error: insErr } = await createClient()
      .from("contact_requests")
      .insert({
        scout_id: scoutId,
        player_id: playerId,
        message: message.trim(),
        proposed_meeting_at: meetingAt ? new Date(meetingAt).toISOString() : null,
        meeting_place: meetingPlace.trim() || null,
      })
      .select("*")
      .single();
    setSending(false);
    if (insErr) return setError(insErr.message);
    onSent(data as ContactRequest);
  }

  return (
    <section className={`${ui.card} h-fit`}>
      <h2 className="text-xl font-bold">Request full profile</h2>

      {request ? (
        <div className="mt-4 space-y-4 text-sm">
          <RequestStatus request={request} />

          {request.status === "accepted" && (
            <div className="rounded-lg border border-green-500/40 bg-green-500/10 p-4">
              <p className="font-semibold text-green-300">Contact details</p>
              {contact && (contact.phone || contact.contact_email) ? (
                <dl className="mt-2 space-y-1">
                  {contact.phone && (
                    <div>
                      <dt className="inline text-[#AEB5C0]">Phone: </dt>
                      <dd className="inline">
                        <a href={`tel:${contact.phone}`} className="hover:text-[#F47721]">{contact.phone}</a>
                      </dd>
                    </div>
                  )}
                  {contact.contact_email && (
                    <div>
                      <dt className="inline text-[#AEB5C0]">Email: </dt>
                      <dd className="inline">
                        <a href={`mailto:${contact.contact_email}`} className="hover:text-[#F47721]">
                          {contact.contact_email}
                        </a>
                      </dd>
                    </div>
                  )}
                </dl>
              ) : (
                <p className="mt-2 text-[#AEB5C0]">
                  The player accepted but hasn&apos;t added contact details yet.
                </p>
              )}
              {isMinor && (
                <p className="mt-3 text-xs text-[#AEB5C0]">
                  This player is under 18. Involve their parent or guardian in any meeting.
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={send} className="mt-4 space-y-4">
          <p className="text-sm text-[#AEB5C0]">
            Contact details stay hidden until {playerName} accepts. Introduce yourself and
            your organisation, and propose a meeting if you like. One request per player.
          </p>
          {isMinor && (
            <p className="rounded-lg border border-[#F47721]/40 bg-[#F47721]/10 p-3 text-xs text-[#F47721]">
              This player is under 18. Propose a public place and expect a guardian to attend.
            </p>
          )}
          <div>
            <label htmlFor="msg" className={ui.label}>Message *</label>
            <textarea
              id="msg"
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. I scout for … and would like to invite you to a trial."
              className={ui.input}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="when" className={ui.label}>Proposed meeting (optional)</label>
              <input
                id="when"
                type="datetime-local"
                value={meetingAt}
                onChange={(e) => setMeetingAt(e.target.value)}
                className={ui.input}
              />
            </div>
            <div>
              <label htmlFor="where" className={ui.label}>Meeting place (optional)</label>
              <input
                id="where"
                value={meetingPlace}
                onChange={(e) => setMeetingPlace(e.target.value)}
                placeholder="e.g. Nyayo Stadium, Gate 3"
                className={ui.input}
              />
            </div>
          </div>
          {error && <p className={ui.error}>{error}</p>}
          <button type="submit" disabled={sending} className={`${ui.button} w-full`}>
            {sending ? "Sending…" : "Request full profile"}
          </button>
        </form>
      )}
    </section>
  );
}

function RequestStatus({ request }: { request: ContactRequest }) {
  const meeting = formatMeeting(request);
  const tone =
    request.status === "accepted"
      ? "border-green-500/40 bg-green-500/10 text-green-300"
      : request.status === "declined"
        ? "border-[#454A54] bg-[#17191D] text-[#D1D5DB]"
        : "border-[#F47721]/40 bg-[#F47721]/10 text-[#F47721]";
  return (
    <div className={`rounded-lg border p-4 ${tone}`}>
      <p className="font-semibold">
        {request.status === "pending" && `Request sent ${formatDate(request.created_at)} · awaiting reply`}
        {request.status === "accepted" && `Accepted ${formatDate(request.responded_at)}`}
        {request.status === "declined" && `Declined ${formatDate(request.responded_at)}`}
      </p>
      {meeting && <p className="mt-1 text-[#AEB5C0]">Proposed meeting: {meeting}</p>}
    </div>
  );
}
