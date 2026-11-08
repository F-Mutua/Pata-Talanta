// Client for the video analysis service. The contract is in docs/video-api.md.
// With NEXT_PUBLIC_VIDEO_API_URL unset (or for a "demo-…" job) it falls back
// to built-in sample results so the demo never waits on Colab.

import type { VideoResult } from "./types";

export type JobStatus =
  | "queued"
  | "detecting"
  | "awaiting_selection"
  | "analysing"
  | "done"
  | "failed";

export type Candidate = { track_id: number; box: [number, number, number, number] };

export type JobFrame = {
  /** null in demo mode: the UI shows the uploaded video paused instead. */
  image_url: string | null;
  width: number;
  height: number;
  candidates: Candidate[];
};

export type Job = {
  status: JobStatus;
  progress?: number | null;
  message?: string | null;
  frame?: JobFrame | null;
  result?: VideoResult | null;
};

const API_URL = (process.env.NEXT_PUBLIC_VIDEO_API_URL || "").replace(/\/+$/, "");

export const hasLiveApi = API_URL.length > 0;
export const isDemoJob = (jobId: string | null | undefined) => !!jobId?.startsWith("demo-");

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        // Otherwise ngrok's free tier returns an HTML warning page.
        "ngrok-skip-browser-warning": "true",
        ...init?.headers,
      },
    });
  } catch {
    throw new Error("The video service is not reachable. Is the Colab notebook running?");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`The video service returned an error (${res.status}). ${text.slice(0, 200)}`);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

// ---------------------------------------------------------------------------
// Live service
// ---------------------------------------------------------------------------
export async function startJob(videoUrl: string, videoId: string): Promise<string> {
  const { job_id } = await call<{ job_id: string }>("/jobs", {
    method: "POST",
    body: JSON.stringify({ video_url: videoUrl, video_id: videoId }),
  });
  if (!job_id) throw new Error("The video service did not return a job id.");
  return job_id;
}

export function getJob(jobId: string): Promise<Job> {
  return call<Job>(`/jobs/${encodeURIComponent(jobId)}`);
}

export async function selectTrack(jobId: string, trackId: number): Promise<void> {
  await call(`/jobs/${encodeURIComponent(jobId)}/select`, {
    method: "POST",
    body: JSON.stringify({ track_id: trackId }),
  });
}

// ---------------------------------------------------------------------------
// Demo mode: sample detections and results, labelled as such in the UI.
// ---------------------------------------------------------------------------
const DEMO_DETECT_MS = 5000;
const DEMO_ANALYSE_MS = 4000;

export function startDemoJob(): string {
  return `demo-${Date.now()}`;
}

const demoCandidates: Candidate[] = [
  { track_id: 3, box: [250, 470, 330, 690] },
  { track_id: 7, box: [600, 410, 670, 600] },
  { track_id: 9, box: [880, 520, 965, 750] },
  { track_id: 12, box: [1180, 430, 1250, 620] },
  { track_id: 15, box: [1450, 500, 1530, 720] },
  { track_id: 21, box: [1660, 380, 1720, 560] },
];

/**
 * Demo job state is derived from time: detection runs for a few seconds after
 * the job id was created, analysis for a few seconds after the selection.
 */
export function getDemoJob(
  jobId: string,
  trackId: number | null,
  selectedAt: number | null
): Job {
  const created = Number(jobId.slice(5)) || Date.now();
  const sinceStart = Date.now() - created;

  if (trackId === null) {
    if (sinceStart < DEMO_DETECT_MS) {
      return {
        status: "detecting",
        progress: sinceStart / DEMO_DETECT_MS,
        message: "Demo mode · finding players in the footage…",
      };
    }
    return {
      status: "awaiting_selection",
      frame: { image_url: null, width: 1920, height: 1080, candidates: demoCandidates },
    };
  }

  const sinceSelect = selectedAt ? Date.now() - selectedAt : DEMO_ANALYSE_MS;
  if (sinceSelect < DEMO_ANALYSE_MS) {
    return {
      status: "analysing",
      progress: sinceSelect / DEMO_ANALYSE_MS,
      message: "Demo mode · measuring movement and building your heatmap…",
    };
  }
  return { status: "done", result: demoResult(trackId) };
}

/** Deterministic sample numbers that differ a little per selected player. */
function demoResult(trackId: number): VideoResult {
  const k = (trackId % 7) / 7;
  const peakCol = 3 + Math.round(k * 6);
  const peakRow = 2 + (trackId % 4);
  const heatmap = Array.from({ length: 8 }, (_, r) =>
    Array.from({ length: 12 }, (_, c) => {
      const d = Math.hypot((r - peakRow) * 1.4, c - peakCol);
      return Math.max(0, Math.round((9 - d * 1.6) * 10) / 10);
    })
  );
  return {
    distance_m: Math.round(1500 + k * 700),
    top_speed_kmh: Math.round((23 + k * 6) * 10) / 10,
    sprints: 6 + Math.round(k * 7),
    touches: 18 + Math.round(k * 20),
    heatmap,
    annotated_video_url: null,
    duration_s: 300,
    demo: true,
  };
}
