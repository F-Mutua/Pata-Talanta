"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

type Notification = {
  id: string;
  title: string | null;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

const REFRESH_MS = 30_000;

function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

/**
 * In-app notifications. Rows are created by database triggers (a request
 * arrives, a player answers). Opening the panel marks them as read.
 */
export default function NotificationBell() {
  const pathname = usePathname();
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from("notifications")
      .select("id, title, body, link, read_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(15);
    if (!error) setItems((data || []) as Notification[]);
  }, []);

  useEffect(() => {
    // load() awaits before any setState.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load, pathname]);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (panel.current && !panel.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const unread = items.filter((n) => !n.read_at);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread.length) {
      const ids = unread.map((n) => n.id);
      const now = new Date().toISOString();
      const { error } = await createClient().from("notifications").update({ read_at: now }).in("id", ids);
      if (!error) setItems((list) => list.map((n) => (ids.includes(n.id) ? { ...n, read_at: now } : n)));
    }
  }

  return (
    <div className="relative" ref={panel}>
      <button
        onClick={toggle}
        aria-expanded={open}
        aria-label={unread.length ? `Notifications, ${unread.length} unread` : "Notifications"}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-[#454A54] text-[#D8DCE2] transition hover:border-[#F47721] hover:text-[#F47721]"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" strokeLinecap="round" />
        </svg>
        {unread.length > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#F47721] px-1 text-[11px] font-bold text-white">
            {unread.length > 9 ? "9+" : unread.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-[#353941] bg-[#1D2025] shadow-2xl">
          <p className="border-b border-[#353941] px-4 py-3 text-sm font-bold">Notifications</p>
          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-[#AEB5C0]">Nothing yet.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-[#353941] overflow-y-auto">
              {items.map((n) => {
                const content = (
                  <>
                    <p className="flex items-start gap-2 text-sm font-semibold">
                      {!n.read_at && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#F47721]" aria-label="Unread" />}
                      <span>{n.title || "Update"}</span>
                    </p>
                    {n.body && <p className="mt-1 text-sm text-[#AEB5C0]">{n.body}</p>}
                    <p className="mt-1 text-xs text-[#AEB5C0]">{timeAgo(n.created_at)}</p>
                  </>
                );
                return (
                  <li key={n.id}>
                    {n.link ? (
                      <Link href={n.link} onClick={() => setOpen(false)} className="block px-4 py-3 hover:bg-[#22252B]">
                        {content}
                      </Link>
                    ) : (
                      <div className="px-4 py-3">{content}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
