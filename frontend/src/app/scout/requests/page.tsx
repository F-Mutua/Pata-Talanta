"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { useScout } from "@/lib/useScout";
import { ui, formatDate, formatMeeting, errorMessage } from "@/lib/ui";
import type { ContactRequest, ContactStatus } from "@/lib/types";

type Row = ContactRequest & { player_name: string; player_meta: string };

const badge: Record<ContactStatus, string> = {
  pending: "bg-[#F47721]/15 text-[#F47721]",
  accepted: "bg-green-500/15 text-green-300",
  declined: "bg-[#454A54] text-[#D1D5DB]",
};

export default function ScoutRequestsPage() {
  const scoutId = useScout();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<ContactStatus | "all">("all");

  useEffect(() => {
    if (!scoutId) return;
    const supabase = createClient();
    (async () => {
      try {
        const { data, error: rErr } = await supabase
          .from("contact_requests")
          .select("*")
          .eq("scout_id", scoutId)
          .order("created_at", { ascending: false });
        if (rErr) throw rErr;
        const reqs = (data || []) as ContactRequest[];
        const ids = [...new Set(reqs.map((r) => r.player_id))];
        const { data: players } = ids.length
          ? await supabase.from("profiles").select("id, display_name, position, county").in("id", ids)
          : { data: [] };
        const byId = new Map((players || []).map((p) => [p.id, p]));
        setRows(
          reqs.map((r) => {
            const p = byId.get(r.player_id);
            return {
              ...r,
              player_name: p?.display_name || "Player",
              player_meta: [p?.position, p?.county].filter(Boolean).join(" · "),
            };
          })
        );
      } catch (err) {
        setError(errorMessage(err, "Could not load your requests."));
      } finally {
        setLoading(false);
      }
    })();
  }, [scoutId]);

  const shown = filter === "all" ? rows : rows.filter((r) => r.status === filter);

  return (
    <main className="text-white">
      <div className="mx-auto max-w-4xl px-6 py-12">
        <p className={ui.eyebrow}>Scout dashboard</p>
        <h1 className={ui.h1}>My contact requests</h1>
        <p className={ui.lead}>Track the players you have reached out to and read their replies.</p>

        <div className="mt-8 flex flex-wrap gap-2" role="tablist">
          {(["all", "pending", "accepted", "declined"] as const).map((f) => (
            <button
              key={f}
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-4 py-2 text-sm font-semibold capitalize ${
                filter === f ? "bg-[#F47721] text-white" : "bg-[#22252B] text-[#AEB5C0] hover:text-white"
              }`}
            >
              {f} ({f === "all" ? rows.length : rows.filter((r) => r.status === f).length})
            </button>
          ))}
        </div>

        {error && <p className={`${ui.error} mt-6`}>{error}</p>}

        {loading ? (
          <p className="mt-8 text-[#AEB5C0]">Loading…</p>
        ) : shown.length === 0 ? (
          <div className={`${ui.empty} mt-8`}>
            <p className="font-semibold text-white">Nothing here yet</p>
            <Link href="/scout" className="mt-3 inline-block text-sm font-semibold text-[#F47721] hover:underline">
              Discover players →
            </Link>
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            {shown.map((r) => (
              <article key={r.id} className={ui.card}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link href={`/scout/players/${r.player_id}`} className="text-lg font-bold hover:text-[#F47721]">
                      {r.player_name}
                    </Link>
                    <p className="mt-1 text-xs text-[#AEB5C0]">
                      {r.player_meta && `${r.player_meta} · `}Sent {formatDate(r.created_at)}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${badge[r.status]}`}>
                    {r.status}
                  </span>
                </div>
                <p className="mt-4 whitespace-pre-line text-sm leading-6 text-[#AEB5C0]">{r.message}</p>
                {formatMeeting(r) && (
                  <p className="mt-3 text-sm">
                    <span className="font-semibold text-[#F47721]">Proposed meeting: </span>
                    {formatMeeting(r)}
                  </p>
                )}
                {r.status === "accepted" && (
                  <div className="mt-4 rounded-lg border border-green-500/40 bg-green-500/10 p-4 text-sm">
                    <p className="font-semibold text-green-300">
                      Accepted {formatDate(r.responded_at)}
                    </p>
                    <Link href={`/scout/players/${r.player_id}`} className="mt-1 inline-block text-[#F47721] hover:underline">
                      View contact details on their profile →
                    </Link>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
