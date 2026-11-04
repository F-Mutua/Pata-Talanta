"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { ScoutContext } from "@/lib/useScout";
import { ui, formatDate, errorMessage } from "@/lib/ui";
import type { ScoutApplication } from "@/lib/types";

/**
 * Only scouts with an approved scout_applications row (reviewed by a BCF
 * reviewer) get past this gate. RLS enforces the same rule on the data; this
 * just shows the right screen.
 */
type State =
  | { kind: "loading" }
  | { kind: "approved"; userId: string }
  | { kind: "none"; userId: string }
  | { kind: "waiting"; userId: string; app: ScoutApplication };

export default function ScoutGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return router.replace("/login");

      const { data: apps } = await supabase
        .from("scout_applications")
        .select("id, applicant_id, status, verification_authority, notes, created_at")
        .eq("applicant_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);
      const app = (apps?.[0] as ScoutApplication | undefined) ?? null;

      if (app?.status === "approved") return setState({ kind: "approved", userId: user.id });
      if (app) return setState({ kind: "waiting", userId: user.id, app });

      // No application: only people who signed up as scouts should see the form.
      // The signup trigger may store everyone as "player", so also check the
      // role chosen on the signup form (user metadata).
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (profile?.role !== "scout" && user.user_metadata?.role !== "scout") {
        return router.replace("/dashboard");
      }
      setState({ kind: "none", userId: user.id });
    })();
  }, [router]);

  if (state.kind === "loading") {
    return <p className="px-6 py-12 text-[#AEB5C0]">Checking your scout verification…</p>;
  }
  if (state.kind === "approved") {
    return <ScoutContext value={state.userId}>{children}</ScoutContext>;
  }
  return (
    <main className="mx-auto max-w-2xl px-6 py-12 text-white">
      <p className={ui.eyebrow}>Scout verification</p>
      {state.kind === "waiting" ? (
        <Waiting app={state.app} />
      ) : (
        <ApplyForm
          userId={state.userId}
          onSubmitted={(app) => setState({ kind: "waiting", userId: state.userId, app })}
        />
      )}
    </main>
  );
}

function Waiting({ app }: { app: ScoutApplication }) {
  const rejected = app.status === "rejected" || app.status === "declined";
  return (
    <>
      <h1 className={ui.h1}>{rejected ? "Application not approved" : "Your application is being reviewed"}</h1>
      <p className={ui.lead}>
        {rejected
          ? "A BCF reviewer was unable to verify your scouting credentials. Contact BCF if you believe this is a mistake."
          : "To protect young players, a BCF reviewer verifies every scout before they can view player profiles. You'll get access as soon as you're approved."}
      </p>
      <div className={`${ui.card} mt-8 text-sm`}>
        <p>
          <span className="text-[#AEB5C0]">Submitted:</span> {formatDate(app.created_at)}
        </p>
        <p className="mt-2">
          <span className="text-[#AEB5C0]">Status:</span>{" "}
          <span className="font-semibold capitalize text-[#F47721]">{app.status}</span>
        </p>
        {app.verification_authority && (
          <p className="mt-2">
            <span className="text-[#AEB5C0]">Organisation:</span> {app.verification_authority}
          </p>
        )}
      </div>
    </>
  );
}

function ApplyForm({
  userId,
  onSubmitted,
}: {
  userId: string;
  onSubmitted: (app: ScoutApplication) => void;
}) {
  const [authority, setAuthority] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const { data, error: insErr } = await createClient()
        .from("scout_applications")
        .insert({
          applicant_id: userId,
          verification_authority: authority.trim(),
          notes: notes.trim() || null,
        })
        .select("id, applicant_id, status, verification_authority, notes, created_at")
        .single();
      if (insErr) throw insErr;
      onSubmitted(data as ScoutApplication);
    } catch (err) {
      setError(errorMessage(err, "Could not submit your application."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <h1 className={ui.h1}>Get verified as a scout</h1>
      <p className={ui.lead}>
        Many players on Pata Talanta are under 18. Before you can view profiles, a BCF
        reviewer confirms who you scout for.
      </p>
      <form onSubmit={submit} className={`${ui.card} mt-8 space-y-5`}>
        <div>
          <label htmlFor="authority" className={ui.label}>
            Club, academy or federation you scout for *
          </label>
          <input
            id="authority"
            required
            value={authority}
            onChange={(e) => setAuthority(e.target.value)}
            placeholder="e.g. FKF licensed scout, Gor Mahia Youth Academy"
            className={ui.input}
          />
        </div>
        <div>
          <label htmlFor="notes" className={ui.label}>
            Anything that helps us verify you
          </label>
          <textarea
            id="notes"
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Licence number, a reference contact, your role…"
            className={ui.input}
          />
        </div>
        {error && <p className={ui.error}>{error}</p>}
        <button type="submit" disabled={saving} className={`${ui.button} w-full`}>
          {saving ? "Submitting…" : "Submit for verification"}
        </button>
      </form>
    </>
  );
}
