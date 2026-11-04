"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { ui, formatDate, formatMeeting, errorMessage } from "@/lib/ui";
import type { ContactRequest, ContactStatus, PlayerContact } from "@/lib/types";

type Row = ContactRequest & { scout_name: string; scout_county: string | null };

const badge: Record<ContactStatus, string> = {
  pending: "bg-[#F47721]/15 text-[#F47721]",
  accepted: "bg-green-500/15 text-green-300",
  declined: "bg-[#454A54] text-[#D1D5DB]",
};

export default function PlayerRequestsPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [contact, setContact] = useState<PlayerContact | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = "/login";
        return;
      }
      const [{ data, error: rErr }, { data: c }] = await Promise.all([
        supabase
          .from("contact_requests")
          .select("*")
          .eq("player_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("player_contacts")
          .select("player_id, phone, contact_email, updated_at")
          .eq("player_id", user.id)
          .maybeSingle(),
      ]);
      if (rErr) throw rErr;
      setContact((c as PlayerContact) ?? null);

      const requests = (data || []) as ContactRequest[];
      const scoutIds = [...new Set(requests.map((r) => r.scout_id))];
      const { data: scouts } = scoutIds.length
        ? await supabase.from("profiles").select("id, display_name, county").in("id", scoutIds)
        : { data: [] };
      const byId = new Map((scouts || []).map((s) => [s.id, s]));

      setRows(
        requests.map((r) => ({
          ...r,
          scout_name: byId.get(r.scout_id)?.display_name || "A verified scout",
          scout_county: byId.get(r.scout_id)?.county ?? null,
        }))
      );
    } catch (err) {
      setError(errorMessage(err, "Could not load your requests."));
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

  async function respond(id: string, status: "accepted" | "declined") {
    setSaving(true);
    setError("");
    const { error: uErr } = await supabase
      .from("contact_requests")
      .update({ status, responded_at: new Date().toISOString() })
      .eq("id", id);
    setSaving(false);
    if (uErr) return setError(uErr.message);
    setConfirming(null);
    await load();
  }

  const hasContact = !!(contact?.phone || contact?.contact_email);
  const pending = rows.filter((r) => r.status === "pending");
  const past = rows.filter((r) => r.status !== "pending");

  return (
    <main className="text-white">
      <div className="mx-auto max-w-4xl px-6 py-12">
        <p className={ui.eyebrow}>Opportunities</p>
        <h1 className={ui.h1}>Scout Requests</h1>
        <p className={ui.lead}>
          Only scouts verified by BCF can contact you. If you accept a request, that scout
          can see the phone number and email in your contact details. Nobody else can.
        </p>

        <div className={`${ui.card} mt-6 flex flex-wrap items-center justify-between gap-3 text-sm`}>
          <div>
            <p className="font-semibold">Contact details shared on accept</p>
            <p className="mt-1 text-[#AEB5C0]">
              {hasContact
                ? [contact?.phone, contact?.contact_email].filter(Boolean).join(" · ")
                : "You haven't added any yet. Add them before accepting a request."}
            </p>
          </div>
          <Link href="/dashboard/profile#contact" className={ui.buttonGhost}>
            {hasContact ? "Edit" : "Add contact details"}
          </Link>
        </div>

        {error && <p className={`${ui.error} mt-6`}>{error}</p>}

        {loading ? (
          <p className="mt-10 text-[#AEB5C0]">Loading requests…</p>
        ) : rows.length === 0 ? (
          <div className={`${ui.empty} mt-10`}>
            <p className="font-semibold text-white">No requests yet</p>
            <p className="mt-2 text-sm">
              Make sure your profile is visible to scouts, and keep your matches up to date.
            </p>
          </div>
        ) : (
          <>
            <h2 className="mt-10 text-xl font-bold">Awaiting your response ({pending.length})</h2>
            <div className="mt-4 space-y-4">
              {pending.length === 0 && (
                <p className="text-sm text-[#AEB5C0]">You&apos;re all caught up.</p>
              )}
              {pending.map((r) => (
                <article key={r.id} className={ui.card}>
                  <RequestHeader r={r} />
                  <p className="mt-4 whitespace-pre-line leading-7">{r.message}</p>
                  <Meeting r={r} />

                  {confirming === r.id ? (
                    <div className="mt-5 rounded-lg border border-[#F47721]/40 bg-[#F47721]/10 p-4 text-sm">
                      <p>
                        <strong>{r.scout_name}</strong> will be able to see{" "}
                        {[contact?.phone, contact?.contact_email].filter(Boolean).join(" and ")}.
                        If you are under 18, talk to your parent or guardian first.
                      </p>
                      <div className="mt-4 flex flex-wrap gap-3">
                        <button disabled={saving} onClick={() => respond(r.id, "accepted")} className={ui.button}>
                          {saving ? "Saving…" : "Yes, accept"}
                        </button>
                        <button disabled={saving} onClick={() => setConfirming(null)} className={ui.buttonGhost}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-5 flex flex-wrap items-center gap-3">
                      <button
                        disabled={!hasContact}
                        onClick={() => setConfirming(r.id)}
                        className={ui.button}
                        title={hasContact ? undefined : "Add contact details first"}
                      >
                        Accept
                      </button>
                      <button disabled={saving} onClick={() => respond(r.id, "declined")} className={ui.buttonGhost}>
                        Decline
                      </button>
                      {!hasContact && (
                        <span className="text-xs text-[#AEB5C0]">Add contact details to accept.</span>
                      )}
                    </div>
                  )}
                </article>
              ))}
            </div>

            {past.length > 0 && (
              <>
                <h2 className="mt-12 text-xl font-bold">Previous requests</h2>
                <div className="mt-4 space-y-4">
                  {past.map((r) => (
                    <article key={r.id} className={`${ui.card} opacity-90`}>
                      <RequestHeader r={r} />
                      <p className="mt-4 whitespace-pre-line text-sm leading-6 text-[#AEB5C0]">{r.message}</p>
                      <Meeting r={r} />
                    </article>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function Meeting({ r }: { r: ContactRequest }) {
  const m = formatMeeting(r);
  if (!m) return null;
  return (
    <p className="mt-3 text-sm">
      <span className="font-semibold text-[#F47721]">Proposed meeting: </span>
      {m}
    </p>
  );
}

function RequestHeader({ r }: { r: Row }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="text-lg font-bold">{r.scout_name}</h3>
        <p className="mt-1 text-xs text-[#AEB5C0]">
          Verified scout{r.scout_county ? ` · ${r.scout_county}` : ""} · {formatDate(r.created_at)}
        </p>
      </div>
      <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${badge[r.status]}`}>
        {r.status}
      </span>
    </div>
  );
}
