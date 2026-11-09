"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { uploadWithProgress } from "@/lib/upload";
import { ui, formatDate, errorMessage } from "@/lib/ui";
import {
  MAX_VIDEO_BYTES,
  VIDEO_BUCKET,
  type Match,
  type MatchVideo,
  type VideoStatus,
} from "@/lib/types";

const ACCEPTED = ["video/mp4", "video/quicktime", "video/webm"];

const statusStyle: Record<VideoStatus, { label: string; className: string }> = {
  uploaded: { label: "Uploaded · awaiting analysis", className: "bg-[#454A54] text-[#D1D5DB]" },
  processing: { label: "Processing", className: "bg-amber-500/15 text-amber-300" },
  processed: { label: "Analysed", className: "bg-green-500/15 text-green-300" },
  failed: { label: "Analysis failed", className: "bg-red-500/15 text-red-300" },
};

function formatSize(bytes: number | null) {
  if (!bytes) return "";
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function VideosPage() {
  const supabase = createClient();
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);

  const [videos, setVideos] = useState<MatchVideo[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [previewUrl, setPreviewUrl] = useState<{ id: string; url: string } | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [matchId, setMatchId] = useState("");
  const [description, setDescription] = useState("");

  const load = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = "/login";
        return;
      }

      const [{ data: vids, error: vErr }, { data: apps, error: aErr }] = await Promise.all([
        supabase
          .from("match_videos")
          .select("*")
          .eq("player_id", user.id)
          .order("created_at", { ascending: false }),
        supabase.from("match_players").select("match_id").eq("player_id", user.id),
      ]);
      if (vErr) throw vErr;
      if (aErr) throw aErr;
      setVideos((vids || []) as MatchVideo[]);

      const ids = [...new Set((apps || []).map((a) => a.match_id as string))];
      if (ids.length) {
        const { data: m, error: mErr } = await supabase
          .from("matches")
          .select("id, club_name, opponent, competition, match_date, team_goals, opponent_goals")
          .in("id", ids)
          .order("match_date", { ascending: false });
        if (mErr) throw mErr;
        setMatches((m || []) as Match[]);
      }
    } catch (err) {
      setError(errorMessage(err, "Could not load your videos."));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // load() awaits before any setState, so this does not render synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  function pickFile(f: File | null) {
    setError("");
    if (!f) return setFile(null);
    if (!ACCEPTED.includes(f.type)) {
      setError("Please choose an MP4, MOV or WebM video.");
      return setFile(null);
    }
    if (f.size > MAX_VIDEO_BYTES) {
      setError(
        `This file is ${formatSize(f.size)}. The current limit is ${formatSize(MAX_VIDEO_BYTES)} — trim the clip or lower its resolution.`
      );
      return setFile(null);
    }
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
  }

  async function upload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!file) return setError("Please choose a video file.");
    if (!title.trim()) return setError("Please give the video a title.");

    setUploading(true);
    setProgress(0);
    let storagePath = "";
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Your session has expired. Please sign in again.");

      // Files live under the player's own folder; storage policies rely on this.
      const ext = file.name.split(".").pop()?.toLowerCase() || "mp4";
      storagePath = `${user.id}/${crypto.randomUUID()}.${ext}`;

      await uploadWithProgress(VIDEO_BUCKET, storagePath, file, setProgress);

      const { data: created, error: insErr } = await supabase.from("match_videos").insert({
        player_id: user.id,
        match_id: matchId || null,
        title: title.trim(),
        description: description.trim() || null,
        storage_path: storagePath,
        file_size_bytes: file.size,
      }).select("id").single();
      if (insErr || !created) {
        // Don't leave an orphaned file behind if the record fails.
        await supabase.storage.from(VIDEO_BUCKET).remove([storagePath]);
        throw insErr ?? new Error("The video record could not be created.");
      }

      // Straight on to "tap yourself" and analysis.
      router.push(`/dashboard/videos/${created.id}`);
      return;
    } catch (err) {
      setError(errorMessage(err, "The upload failed. Please try again."));
    } finally {
      setUploading(false);
    }
  }

  async function preview(video: MatchVideo) {
    if (previewUrl?.id === video.id) return setPreviewUrl(null);
    const { data, error: urlErr } = await supabase.storage
      .from(VIDEO_BUCKET)
      .createSignedUrl(video.storage_path, 60 * 60);
    if (urlErr || !data) return setError(urlErr?.message || "Could not open the video.");
    setPreviewUrl({ id: video.id, url: data.signedUrl });
  }

  async function remove(video: MatchVideo) {
    if (!confirm(`Delete "${video.title}"? This cannot be undone.`)) return;
    setError("");
    const { error: delErr } = await supabase.from("match_videos").delete().eq("id", video.id);
    if (delErr) return setError(delErr.message);
    await supabase.storage.from(VIDEO_BUCKET).remove([video.storage_path]);
    setVideos((v) => v.filter((x) => x.id !== video.id));
  }

  const matchLabel = (id: string | null) => {
    const m = matches.find((x) => x.id === id);
    return m ? `vs ${m.opponent || "Unknown"} · ${formatDate(m.match_date)}` : null;
  };

  return (
    <main className="text-white">
      <div className={ui.container}>
        <p className={ui.eyebrow}>Match footage</p>
        <h1 className={ui.h1}>My Match Videos</h1>
        <p className={ui.lead}>
          Upload footage of your matches. Videos are analysed to generate movement data and
          heatmaps, and scouts can watch them on your profile.
        </p>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_1.2fr]">
          <section className={`${ui.card} h-fit`}>
            <h2 className="text-xl font-bold">Upload a video</h2>

            <form onSubmit={upload} className="mt-6 space-y-5">
              <label
                className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition ${
                  file ? "border-[#F47721] bg-[#F47721]/5" : "border-[#454A54] hover:border-[#F47721]"
                }`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  pickFile(e.dataTransfer.files?.[0] ?? null);
                }}
              >
                <input
                  ref={fileInput}
                  type="file"
                  accept={ACCEPTED.join(",")}
                  className="sr-only"
                  onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                />
                {file ? (
                  <>
                    <span className="font-semibold">{file.name}</span>
                    <span className="mt-1 text-sm text-[#AEB5C0]">
                      {formatSize(file.size)} · click to change
                    </span>
                  </>
                ) : (
                  <>
                    <span className="font-semibold">Drop a video here or click to browse</span>
                    <span className="mt-1 text-sm text-[#AEB5C0]">
                      MP4, MOV or WebM · up to {formatSize(MAX_VIDEO_BYTES)}
                    </span>
                  </>
                )}
              </label>

              <div>
                <label htmlFor="title" className={ui.label}>Title *</label>
                <input
                  id="title"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Second half vs Rangers FC"
                  className={ui.input}
                />
              </div>

              <div>
                <label htmlFor="match" className={ui.label}>Linked match</label>
                <select
                  id="match"
                  value={matchId}
                  onChange={(e) => setMatchId(e.target.value)}
                  className={ui.input}
                >
                  <option value="">Not linked to a logged match</option>
                  {matches.map((m) => (
                    <option key={m.id} value={m.id}>
                      vs {m.opponent || "Unknown"} — {formatDate(m.match_date)}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-[#AEB5C0]">
                  Link the video to a match so its analysis feeds that match&apos;s heatmap.
                </p>
              </div>

              <div>
                <label htmlFor="desc" className={ui.label}>Description</label>
                <textarea
                  id="desc"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Your shirt number and colour help the analysis find you."
                  className={ui.input}
                />
              </div>

              {error && <p className={ui.error}>{error}</p>}
              {success && <p className={ui.success}>{success}</p>}

              <button type="submit" disabled={uploading || !file} className={`${ui.button} w-full`}>
                {uploading
                  ? `Uploading… ${Math.round(progress * 100)}%`
                  : "Upload and analyse"}
              </button>
              {uploading && (
                <div
                  className="h-2 overflow-hidden rounded-full bg-[#353941]"
                  role="progressbar"
                  aria-valuenow={Math.round(progress * 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Upload progress"
                >
                  <div
                    className="h-full rounded-full bg-[#F47721] transition-[width]"
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>
              )}
            </form>
          </section>

          <section>
            <h2 className="text-xl font-bold">Uploaded videos</h2>

            {loading ? (
              <p className="mt-6 text-[#AEB5C0]">Loading videos…</p>
            ) : videos.length === 0 ? (
              <div className={`${ui.empty} mt-6`}>
                <p className="font-semibold text-white">No videos yet</p>
                <p className="mt-2 text-sm">Upload your first match clip to get started.</p>
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {videos.map((v) => {
                  const s = statusStyle[v.processing_status] ?? statusStyle.uploaded;
                  return (
                    <article key={v.id} className={ui.card}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate text-lg font-bold">{v.title}</h3>
                          <p className="mt-1 text-sm text-[#AEB5C0]">
                            {matchLabel(v.match_id) || "Not linked to a match"}
                          </p>
                          <p className="mt-1 text-xs text-[#AEB5C0]">
                            Uploaded {formatDate(v.created_at)}
                            {v.file_size_bytes ? ` · ${formatSize(v.file_size_bytes)}` : ""}
                          </p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${s.className}`}>
                          {s.label}
                        </span>
                      </div>

                      {v.description && (
                        <p className="mt-3 text-sm leading-6 text-[#AEB5C0]">{v.description}</p>
                      )}

                      {previewUrl?.id === v.id && (
                        <video
                          src={previewUrl.url}
                          controls
                          className="mt-4 w-full rounded-lg bg-black"
                        />
                      )}

                      <div className="mt-4 flex flex-wrap gap-3">
                        <Link href={`/dashboard/videos/${v.id}`} className={ui.button + " !px-4 !py-2 text-sm"}>
                          {v.processing_status === "processed" ? "View results" : "Analyse"}
                        </Link>
                        <button onClick={() => preview(v)} className={ui.buttonGhost}>
                          {previewUrl?.id === v.id ? "Hide" : "Watch"}
                        </button>
                        <button
                          onClick={() => remove(v)}
                          className="rounded-lg px-4 py-2 text-sm text-red-300 hover:bg-red-500/10"
                        >
                          Delete
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
