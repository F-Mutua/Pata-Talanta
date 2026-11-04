"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export type NavItem = { href: string; label: string };

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

  return (
    <header className="border-b border-[#353941] bg-[#1D2025]">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
        <Link href={nav[0]?.href ?? "/"} className="text-xl font-black tracking-wider">
          PATA <span className="text-[#F47721]">TALANTA</span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                isActive(item.href)
                  ? "bg-[#F47721]/15 text-[#F47721]"
                  : "text-[#AEB5C0] hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <span className="hidden max-w-[12rem] truncate text-sm text-[#AEB5C0] sm:block">
            {name}
          </span>
          <span className="rounded-full border border-[#F47721]/40 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[#F47721]">
            {roleLabel}
          </span>
          <button
            onClick={signOut}
            className="hidden text-sm text-[#AEB5C0] hover:text-[#F47721] sm:block"
          >
            Sign out
          </button>
          <button
            onClick={() => setOpen((v) => !v)}
            className="rounded-lg border border-[#454A54] px-3 py-2 text-sm lg:hidden"
            aria-expanded={open}
            aria-label="Toggle menu"
          >
            Menu
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-[#353941] px-6 py-3 lg:hidden" aria-label="Mobile">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`block rounded-lg px-3 py-2 text-sm ${
                isActive(item.href) ? "text-[#F47721]" : "text-[#D8DCE2]"
              }`}
            >
              {item.label}
            </Link>
          ))}
          <button
            onClick={signOut}
            className="block w-full rounded-lg px-3 py-2 text-left text-sm text-[#AEB5C0]"
          >
            Sign out
          </button>
        </nav>
      )}
    </header>
  );
}
