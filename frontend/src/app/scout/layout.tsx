import { Suspense } from "react";
import AppHeader from "@/components/AppHeader";
import ScoutGate from "@/components/ScoutGate";

const nav = [
  { href: "/scout", label: "Discover players" },
  { href: "/scout/requests", label: "My contact requests" },
];

export default function ScoutLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#17191D] lg:flex">
      <Suspense fallback={<div className="h-[61px] border-b border-[#353941] bg-[#1D2025] lg:h-screen lg:w-64 lg:border-b-0 lg:border-r" />}>
        <AppHeader nav={nav} roleLabel="Scout" />
      </Suspense>
      {/* Pages read request-time data (session, current date), so they stream in. */}
      <div className="min-w-0 flex-1">
        <Suspense fallback={<p className="px-6 py-12 text-[#AEB5C0]">Loading…</p>}>
          <ScoutGate>{children}</ScoutGate>
        </Suspense>
      </div>
    </div>
  );
}
