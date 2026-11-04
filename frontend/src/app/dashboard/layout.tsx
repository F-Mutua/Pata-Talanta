import { Suspense } from "react";
import AppHeader from "@/components/AppHeader";

const nav = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/profile", label: "Profile" },
  { href: "/dashboard/clubs", label: "Clubs" },
  { href: "/dashboard/matches", label: "Matches" },
  { href: "/dashboard/performance", label: "Performance" },
  { href: "/dashboard/videos", label: "Videos" },
  { href: "/dashboard/requests", label: "Scout requests" },
];

export default function PlayerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#17191D]">
      <Suspense fallback={<div className="h-[69px] border-b border-[#353941] bg-[#1D2025]" />}>
        <AppHeader nav={nav} roleLabel="Player" />
      </Suspense>
      {/* Pages read request-time data (session, current date), so they stream in. */}
      <Suspense fallback={<p className="px-6 py-12 text-[#AEB5C0]">Loading…</p>}>{children}</Suspense>
    </div>
  );
}
