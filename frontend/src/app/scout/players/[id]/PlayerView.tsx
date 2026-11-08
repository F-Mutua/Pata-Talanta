"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { useScout } from "@/lib/useScout";
import { ui, formatDate, formatMeeting, errorMessage } from "@/lib/ui";
import PlayerBoard from "@/components/PlayerBoard";
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
  if (!data) {
    return <p className="px-6 py-12 text-[#AEB5C0]">Loading player…</p>;
  }

  const { profile } = data;
  const age = ageFrom(profile.date_of_birth);
  const card = "rounded-xl border border-[#353941] bg-[#1D2025] p-5";
  const cardTitle = "text-sm font-bold uppercase tracking-wide text-[#D8DCE2]";

  return (
    <main className="text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <PlayerBoard
          profile={profile}
          clubs={data.clubs}
          appearances={data.appearances}
          heatmaps={data.heatmaps}
          breadcrumb={
            <>
              <Link href="/scout" className="hover:text-[#F47721]">
                Discover players
              </Link>{" "}
              / <span className="font-semibold text-white">{profile.display_name || "Player"}</span>
            </>
          }
          action={
            <a href="#contact" className={`${ui.button} text-center`}>
              Request full profile
            </a>
          }
        />

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
