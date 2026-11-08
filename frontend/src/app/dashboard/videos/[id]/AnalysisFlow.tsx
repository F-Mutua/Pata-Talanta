"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import Heatmap from "@/components/Heatmap";
import { ui, formatDate, errorMessage } from "@/lib/ui";
import { VIDEO_BUCKET, type Match, type MatchVideo, type VideoResult } from "@/lib/types";
import {
  getDemoJob,
  getJob,
  hasLiveApi,
  isDemoJob,
  selectTrack,
  startDemoJob,
  startJob,
  type Job,
} from "@/lib/videoApi";

const POLL_MS = 3000;
const DEMO_POLL_MS = 700;

export default function AnalysisFlow({ videoId }: { videoId: string }) {
  const [video, setVideo] = useState<MatchVideo | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [selectedAt, setSelectedAt] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Load the video row, a playback URL and the player's matches.
  useEffect(() => {
    const supabase = createClient();
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          window.location.href = "/login";
          return;
        }
        setUserId(user.id);

        const { data, error: vErr } = await supabase
          .from("match_videos")
          .select("*")
          .eq("id", videoId)
          .eq("player_id", user.id)
          .maybeSingle();
        if (vErr) throw vErr;
        if (!data) throw new Error("This video could not be found.");
        setVideo(data as MatchVideo);

        const [{ data: signed }, { data: apps }] = await Promise.all([
          supabase.storage.from(VIDEO_BUCKET).createSignedUrl(data.storage_path, 60 * 60 * 2),
          supabase.from("match_players").select("match_id").eq("player_id", user.id),
        ]);
        setVideoUrl(signed?.signedUrl ?? null);

        const ids = [...new Set((apps || []).map((a) => a.match_id as string))];
        if (ids.length) {
          const { data: m } = await supabase
            .from("matches")
            .select("id, club_name, opponent, competition, match_date, team_goals, opponent_goals")
            .in("id", ids)
            .order("match_date", { ascending: false });
          setMatches((m || []) as Match[]);
        }
      } catch (err) {
        setError(errorMessage(err, "Could not load this video."));
      }
    })();
  }, [videoId]);

  async function patchVideo(changes: Partial<MatchVideo>) {
    if (!video) return;
    const { error: uErr } = await createClient()
      .from("match_videos")
      .update(changes)
      .eq("id", video.id);
    if (uErr) throw uErr;
    setVideo((v) => (v ? { ...v, ...changes } : v));
  }

  // Poll the job until it needs a selection, finishes or fails.
  const jobId = video?.job_id ?? null;
  const trackId = video?.track_id ?? null;
  const finished = video?.processing_status === "processed" && !!video.result;
  const savingResult = useRef(false);

  useEffect(() => {
    if (!jobId || finished) return;
    let stopped = false;
    const demo = isDemoJob(jobId);

    const tick = async () => {
      try {
        const next = demo ? getDemoJob(jobId, trackId, selectedAt) : await getJob(jobId);
        if (stopped) return;
        setJob(next);
        setError("");

        if (next.status === "done" && next.result && !savingResult.current) {
          savingResult.current = true;
          await patchVideo({
            result: next.result,
            annotated_url: next.result.annotated_video_url ?? null,
            processing_status: "processed",
          });
        } else if (next.status === "failed") {
          stopped = true;
          clearInterval(timer);
          await patchVideo({ processing_status: "failed" });
        }
      } catch (err) {
        if (!stopped) setError(errorMessage(err, "Could not reach the video service."));
      }
    };

    const timer = setInterval(tick, demo ? DEMO_POLL_MS : POLL_MS);
    tick();
    return () => {
      stopped = true;
      clearInterval(timer);
    };
    // patchVideo only depends on video.id, which is stable here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, trackId, selectedAt, finished]);

  async function start(demo: boolean) {
    if (!video) return;
    setBusy(true);
    setError("");
    try {
      let newJobId: string;
      if (demo) {
        newJobId = startDemoJob();
      } else {
        const { data: signed, error: sErr } = await createClient()
          .storage.from(VIDEO_BUCKET)
          .createSignedUrl(video.storage_path, 60 * 60 * 2);
        if (sErr || !signed) throw sErr ?? new Error("Could not prepare the video for analysis.");
        newJobId = await startJob(signed.signedUrl, video.id);
      }
      savingResult.current = false;
      setJob(null);
      setSelectedAt(null);
      await patchVideo({
        job_id: newJobId,
        track_id: null,
        result: null,
        annotated_url: null,
        processing_status: "processing",
      });
    } catch (err) {
      setError(errorMessage(err, "Could not start the analysis."));
    } finally {
      setBusy(false);
    }
  }

  async function choose(id: number) {
    if (!video?.job_id) return;
    setBusy(true);
    setError("");
    try {
      if (!isDemoJob(video.job_id)) await selectTrack(video.job_id, id);
      setSelectedAt(Date.now());
      await patchVideo({ track_id: id });
    } catch (err) {
      setError(errorMessage(err, "Could not send your selection."));
    } finally {
      setBusy(false);
    }
  }

  if (!video) {
    return (
      <main className={ui.container + " text-white"}>
        {error ? <p className={ui.error}>{error}</p> : <p className="text-[#AEB5C0]">Loading video…</p>}
      </main>
    );
  }

  const match = matches.find((m) => m.id === video.match_id) ?? null;
  const demo = isDemoJob(video.job_id) || video.result?.demo;
  const stage: "start" | "working" | "pick" | "failed" | "results" = finished
    ? "results"
    : !video.job_id
      ? "start"
      : job?.status === "failed" || (video.processing_status === "failed" && !job)
        ? "failed"
        : job?.status === "awaiting_selection" && trackId === null
          ? "pick"
          : "working";

  return (
    <main className="text-white">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Link href="/dashboard/videos" className="text-sm text-[#AEB5C0] hover:text-[#F47721]">
          ← My videos
        </Link>
        <p className={`${ui.eyebrow} mt-6`}>Video analysis</p>
        <h1 className="mt-2 text-3xl font-black sm:text-4xl">{video.title}</h1>
        <p className="mt-2 text-sm text-[#AEB5C0]">
          {match ? `vs ${match.opponent || "Unknown"} · ${formatDate(match.match_date)}` : "Not linked to a match"}
          {demo && " · Demo mode (sample results)"}
        </p>

        <Steps stage={stage} />

        {error && <p className={`${ui.error} mt-6`}>{error}</p>}

        {stage === "start" && (
          <section className={`${ui.card} mt-6`}>
            <h2 className="text-xl font-bold">Ready to analyse</h2>
            <p className="mt-2 text-sm leading-6 text-[#AEB5C0]">
              We&apos;ll find every player in your footage. Then you tap the one that&apos;s
              you, and we estimate your distance covered, top speed, sprints, ball touches and
              heatmap.
            </p>
            {videoUrl && (
              <video src={videoUrl} controls playsInline className="mt-5 w-full rounded-lg bg-black" />
            )}
            <div className="mt-5 flex flex-wrap gap-3">
              {hasLiveApi && (
                <button disabled={busy} onClick={() => start(false)} className={ui.button}>
                  {busy ? "Starting…" : "Start analysis"}
                </button>
              )}
              <button
                disabled={busy}
                onClick={() => start(true)}
                className={hasLiveApi ? ui.buttonGhost : ui.button}
              >
                {hasLiveApi ? "Use demo results instead" : busy ? "Starting…" : "Start analysis (demo mode)"}
              </button>
            </div>
            {!hasLiveApi && (
              <p className="mt-3 text-xs text-[#AEB5C0]">
                The video service isn&apos;t connected, so this runs with sample results.
                Set NEXT_PUBLIC_VIDEO_API_URL to use the real pipeline.
              </p>
            )}
          </section>
        )}

        {stage === "working" && <Working job={job} picked={trackId !== null} />}

        {stage === "pick" && job?.frame && (
          <PickYourself frame={job.frame} videoUrl={videoUrl} busy={busy} onChoose={choose} />
        )}

        {stage === "failed" && (
          <section className={`${ui.card} mt-6`}>
            <h2 className="text-xl font-bold text-red-300">The analysis didn&apos;t finish</h2>
            <p className="mt-2 text-sm text-[#AEB5C0]">
              {job?.message ||
                "The video service couldn't process this clip. Wide footage from a raised spot, with the whole half visible, works best."}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              {hasLiveApi && (
                <button disabled={busy} onClick={() => start(false)} className={ui.button}>
                  Try again
                </button>
              )}
              <button disabled={busy} onClick={() => start(true)} className={ui.buttonGhost}>
                Use demo results
              </button>
            </div>
          </section>
        )}

        {stage === "results" && video.result && userId && (
          <Results
            video={video}
            result={video.result}
            videoUrl={videoUrl}
            matches={matches}
            userId={userId}
            onLinkMatch={(id) => patchVideo({ match_id: id })}
            onRestart={() => start(!hasLiveApi)}
          />
        )}
      </div>
    </main>
  );
}

function Steps({ stage }: { stage: string }) {
  const order = ["start", "working", "pick", "results"];
  const current = stage === "failed" ? 1 : order.indexOf(stage);
  const labels = ["Upload", "Find players", "Tap yourself", "Your stats"];
  return (
    <ol className="mt-6 grid grid-cols-4 gap-2 text-center text-[11px] sm:text-xs" aria-label="Progress">
      {labels.map((label, i) => {
        // "Upload" is always done once we're on this page.
        const done = i === 0 || i < current || (stage === "results" && i <= 3);
        const active = !done && i === Math.max(current, 1);
        return (
          <li key={label} aria-current={active ? "step" : undefined}>
            <div
              className={`h-1.5 rounded-full ${
                done ? "bg-[#F47721]" : active ? "bg-[#F47721]/50" : "bg-[#353941]"
              }`}
            />
            <p className={`mt-2 ${done || active ? "text-white" : "text-[#AEB5C0]"}`}>{label}</p>
          </li>
        );
      })}
    </ol>
  );
}

function Working({ job, picked }: { job: Job | null; picked: boolean }) {
  const pct = job?.progress != null ? Math.round(Math.min(1, Math.max(0, job.progress)) * 100) : null;
  return (
    <section className={`${ui.card} mt-6`} aria-live="polite">
      <div className="flex items-center gap-3">
        <span className="h-3 w-3 animate-pulse rounded-full bg-[#F47721]" aria-hidden="true" />
        <h2 className="text-xl font-bold">
          {picked ? "Measuring your performance…" : "Finding players in your footage…"}
        </h2>
      </div>
      <p className="mt-2 text-sm text-[#AEB5C0]">
        {job?.message ||
          (picked
            ? "Following you through the clip to estimate distance, speed, sprints and touches."
            : "This can take a few minutes for a full clip. You can leave this page and come back.")}
      </p>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#353941]">
        <div
          className={`h-full rounded-full bg-[#F47721] ${pct === null ? "w-1/3 animate-pulse" : "transition-[width]"}`}
          style={pct === null ? undefined : { width: `${pct}%` }}
        />
      </div>
      {pct !== null && <p className="mt-2 text-xs text-[#AEB5C0]">{pct}%</p>}
    </section>
  );
}

function PickYourself({
  frame,
  videoUrl,
  busy,
  onChoose,
}: {
  frame: NonNullable<Job["frame"]>;
  videoUrl: string | null;
  busy: boolean;
  onChoose: (trackId: number) => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const pickedIndex = frame.candidates.findIndex((c) => c.track_id === picked);

  return (
    <section className={`${ui.card} mt-6`}>
      <h2 className="text-xl font-bold">Which one is you?</h2>
      <p className="mt-2 text-sm text-[#AEB5C0]">
        Tap the box around yourself. Your shirt number or bib colour helps.
        {!frame.image_url && " (Demo mode: sample boxes over your video.)"}
      </p>

      <div
        className="relative mt-5 w-full overflow-hidden rounded-lg bg-black"
        style={{ aspectRatio: `${frame.width} / ${frame.height}` }}
      >
        {frame.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote frame from the video service
          <img src={frame.image_url} alt="A frame from your match" className="absolute inset-0 h-full w-full" />
        ) : videoUrl ? (
          <video
            src={`${videoUrl}#t=2`}
            muted
            playsInline
            preload="metadata"
            className="absolute inset-0 h-full w-full object-cover"
            aria-label="A frame from your match"
          />
        ) : null}

        {frame.candidates.map((c, i) => {
          const [x1, y1, x2, y2] = c.box;
          const isPicked = picked === c.track_id;
          return (
            <button
              key={c.track_id}
              type="button"
              onClick={() => setPicked(c.track_id)}
              aria-pressed={isPicked}
              aria-label={`Player ${i + 1}`}
              className={`absolute rounded-md border-2 transition ${
                isPicked
                  ? "border-[#F47721] bg-[#F47721]/25"
                  : "border-white/80 bg-white/5 hover:border-[#F47721]"
              }`}
              style={{
                left: `${(x1 / frame.width) * 100}%`,
                top: `${(y1 / frame.height) * 100}%`,
                width: `${((x2 - x1) / frame.width) * 100}%`,
                height: `${((y2 - y1) / frame.height) * 100}%`,
                // Keep small boxes easy to tap on a phone.
                minWidth: 28,
                minHeight: 28,
              }}
            >
              <span
                className={`absolute -top-6 left-1/2 -translate-x-1/2 rounded px-1.5 text-xs font-bold ${
                  isPicked ? "bg-[#F47721] text-white" : "bg-black/75 text-white"
                }`}
              >
                {i + 1}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          disabled={picked === null || busy}
          onClick={() => picked !== null && onChoose(picked)}
          className={ui.button}
        >
          {busy ? "Sending…" : picked === null ? "Tap a player first" : `Yes, I'm number ${pickedIndex + 1}`}
        </button>
        {picked !== null && (
          <button onClick={() => setPicked(null)} className="text-sm text-[#AEB5C0] hover:text-white">
            Clear
          </button>
        )}
      </div>
    </section>
  );
}

function Results({
  video,
  result,
  videoUrl,
  matches,
  userId,
  onLinkMatch,
  onRestart,
}: {
  video: MatchVideo;
  result: VideoResult;
  videoUrl: string | null;
  matches: Match[];
  userId: string;
  onLinkMatch: (matchId: string) => Promise<void>;
  onRestart: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [linkTo, setLinkTo] = useState("");

  const annotated = result.annotated_video_url || video.annotated_url;
  const tiles = [
    { label: "Distance covered", value: `${(result.distance_m / 1000).toFixed(2)} km` },
    { label: "Top speed", value: `${result.top_speed_kmh.toFixed(1)} km/h` },
    { label: "Sprints", value: result.sprints },
    { label: "Ball touches", value: result.touches },
  ];

  async function addToMatch() {
    if (!video.match_id) return;
    setSaving(true);
    setError("");
    try {
      const supabase = createClient();

      // Find or create this player's appearance in the match.
      let { data: appearance } = await supabase
        .from("match_players")
        .select("id")
        .eq("match_id", video.match_id)
        .eq("player_id", userId)
        .maybeSingle();
      if (!appearance) {
        const { data: created, error: aErr } = await supabase
          .from("match_players")
          .insert({ match_id: video.match_id, player_id: userId })
          .select("id")
          .single();
        if (aErr) throw aErr;
        appearance = created;
      }

      const videoFields = {
        distance_km: Math.round(result.distance_m / 10) / 100,
        top_speed_kmh: result.top_speed_kmh,
        sprint_count: result.sprints,
        touches: result.touches,
      };
      const { data: existing } = await supabase
        .from("performance_stats")
        .select("id, data_source")
        .eq("match_player_id", appearance!.id)
        .maybeSingle();

      const { error: sErr } = existing
        ? await supabase
            .from("performance_stats")
            .update({
              ...videoFields,
              data_source:
                existing.data_source && existing.data_source !== "video"
                  ? `${existing.data_source}+video`
                  : "video",
            })
            .eq("id", existing.id)
        : await supabase
            .from("performance_stats")
            .insert({ match_player_id: appearance!.id, ...videoFields, data_source: "video" });
      if (sErr) throw sErr;

      const grid = result.heatmap;
      const { error: hErr } = await supabase.from("player_heatmaps").upsert(
        {
          match_player_id: appearance!.id,
          grid_rows: grid.length,
          grid_cols: grid[0]?.length ?? 0,
          intensities: grid,
          data_source: result.demo ? "demo" : "video_pipeline",
        },
        { onConflict: "match_player_id" }
      );
      if (hErr) throw hErr;

      setSaved(true);
    } catch (err) {
      setError(errorMessage(err, "Could not add these stats to the match."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <section className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold">Your stats from this clip</h2>
          <span className="rounded-full border border-[#F47721]/40 px-3 py-1 text-xs font-semibold text-[#F47721]">
            {result.demo ? "Demo sample · not your real data" : "Estimates from video"}
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-xl border border-[#353941] bg-[#22252B] p-5">
              <p className="text-sm text-[#AEB5C0]">{t.label}</p>
              <p className="mt-2 text-2xl font-black">{t.value}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs leading-5 text-[#AEB5C0]">
          Measured from phone footage, so treat these as estimates. Accuracy depends on camera
          height, angle and how long you stay in shot
          {result.duration_s ? ` (${Math.round(result.duration_s / 60)} min clip)` : ""}.
        </p>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className={ui.card}>
          <h2 className="text-lg font-bold">Heatmap</h2>
          <div className="mt-4">
            <Heatmap intensities={result.heatmap} />
          </div>
        </section>
        <section className={ui.card}>
          <h2 className="text-lg font-bold">{annotated ? "Annotated video" : "Your video"}</h2>
          {annotated || videoUrl ? (
            <video
              src={annotated || videoUrl!}
              controls
              playsInline
              className="mt-4 w-full rounded-lg bg-black"
            />
          ) : (
            <p className="mt-4 text-sm text-[#AEB5C0]">Video unavailable.</p>
          )}
          {!annotated && (
            <p className="mt-2 text-xs text-[#AEB5C0]">
              The annotated version appears here when the video service provides one.
            </p>
          )}
        </section>
      </div>

      <section className={`${ui.card} mt-8`}>
        <h2 className="text-lg font-bold">Add to your match stats</h2>
        {saved ? (
          <p className={`${ui.success} mt-3`}>
            Added. These numbers and the heatmap now show on your{" "}
            <Link href="/dashboard/performance" className="font-semibold underline">
              performance page
            </Link>{" "}
            and to scouts.
          </p>
        ) : video.match_id ? (
          <>
            <p className="mt-2 text-sm text-[#AEB5C0]">
              Saves distance, top speed, sprints, touches and the heatmap to the linked match.
              Goals and assists you entered stay as they are.
              {result.demo && " These are demo numbers — only add them to a test account."}
            </p>
            {error && <p className={`${ui.error} mt-3`}>{error}</p>}
            <button disabled={saving} onClick={addToMatch} className={`${ui.button} mt-4`}>
              {saving ? "Saving…" : "Add to match stats"}
            </button>
          </>
        ) : matches.length ? (
          <div className="mt-3 flex flex-wrap gap-3">
            <select
              aria-label="Match"
              value={linkTo}
              onChange={(e) => setLinkTo(e.target.value)}
              className="rounded-lg border border-[#454A54] bg-[#17191D] px-3 py-2 text-sm"
            >
              <option value="">Choose the match this clip is from</option>
              {matches.map((m) => (
                <option key={m.id} value={m.id}>
                  vs {m.opponent || "Unknown"} — {formatDate(m.match_date)}
                </option>
              ))}
            </select>
            <button
              disabled={!linkTo}
              onClick={() => onLinkMatch(linkTo).catch((e) => setError(errorMessage(e, "Could not link the match.")))}
              className={ui.buttonGhost}
            >
              Link match
            </button>
            {error && <p className={`${ui.error} w-full`}>{error}</p>}
          </div>
        ) : (
          <p className="mt-2 text-sm text-[#AEB5C0]">
            <Link href="/dashboard/matches" className="font-semibold text-[#F47721] hover:underline">
              Log the match
            </Link>{" "}
            first, then link this clip to it.
          </p>
        )}
      </section>

      <button onClick={onRestart} className="mt-6 text-sm text-[#AEB5C0] hover:text-[#F47721]">
        Picked the wrong player? Analyse again
      </button>
    </>
  );
}
