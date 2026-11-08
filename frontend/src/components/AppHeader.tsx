"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import NotificationBell from "./NotificationBell";

export type NavItem = { href: string; label: string };

/**
 * App navigation: a fixed left sidebar on large screens, a compact top bar
 * with a dropdown menu on phones.
 */
export default function AppHeader({
  nav,
  roleLabel,
}: {
  nav: NavItem[];
  roleLabel: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [name, setName] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle();
      setName(data?.display_name || user.email || "");
    });
  }, []);

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  // Root links ("/dashboard", "/scout") are only active on an exact match.
  const isActive = (href: string) =>
    href.split("/").length <= 2 ? pathname === href : pathname.startsWith(href);

  const logo = (
    <Link href={nav[0]?.href ?? "/"} className="text-lg font-black tracking-wider">
      PATA <span className="text-[#F47721]">TALANTA</span>
    </Link>
  );

  const initial = (name || "?").charAt(0).toUpperCase();

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-[#353941] bg-[#1D2025] lg:flex">
        <div className="px-6 py-6">{logo}</div>

        <div className="mx-4 flex items-center gap-3 rounded-xl border border-[#353941] bg-[#22252B] p-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F47721]/15 font-black text-[#F47721] ring-2 ring-[#F47721]/40">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{name || "…"}</p>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#F47721]">{roleLabel}</p>
          </div>
          <NotificationBell align="left" />
        </div>

        <nav className="mt-6 flex-1 space-y-1 overflow-y-auto px-4" aria-label="Main">
          {nav.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-[#F47721] font-bold text-white"
                    : "text-[#AEB5C0] hover:bg-[#22252B] hover:text-white"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${active ? "bg-white" : "bg-[#454A54]"}`}
                  aria-hidden="true"
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-[#353941] p-4">
          <button
            onClick={signOut}
            className="w-full rounded-lg px-4 py-2.5 text-left text-sm text-[#AEB5C0] transition hover:bg-[#22252B] hover:text-[#F47721]"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Phone / tablet top bar */}
      <header className="sticky top-0 z-20 border-b border-[#353941] bg-[#1D2025] lg:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          {logo}
          <div className="flex items-center gap-2">
            <NotificationBell />
            <button
              onClick={() => setOpen((v) => !v)}
              className="rounded-lg border border-[#454A54] px-3 py-2 text-sm"
              aria-expanded={open}
              aria-label="Toggle menu"
            >
              {open ? "Close" : "Menu"}
            </button>
          </div>
        </div>

        {open && (
          <nav className="border-t border-[#353941] px-4 py-3" aria-label="Mobile">
            <p className="px-3 pb-2 text-xs text-[#AEB5C0]">
              {name} · <span className="font-semibold uppercase text-[#F47721]">{roleLabel}</span>
            </p>
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`block rounded-lg px-3 py-2.5 text-sm ${
                  isActive(item.href) ? "bg-[#F47721] font-bold text-white" : "text-[#D8DCE2]"
                }`}
              >
                {item.label}
              </Link>
            ))}
            <button
              onClick={signOut}
              className="mt-1 block w-full rounded-lg px-3 py-2.5 text-left text-sm text-[#AEB5C0]"
            >
              Sign out
            </button>
          </nav>
        )}
      </header>
    </>
  );
}
