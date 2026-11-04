import type { StatTotals } from "@/lib/stats";

export default function StatGrid({ totals }: { totals: StatTotals }) {
  const items: { label: string; value: string | number; detail?: string }[] = [
    { label: "Matches", value: totals.matches },
    { label: "Minutes", value: totals.minutes.toLocaleString() },
    { label: "Goals", value: totals.goals },
    { label: "Assists", value: totals.assists },
    { label: "Tackles", value: totals.tackles },
    { label: "Interceptions", value: totals.interceptions },
    {
      label: "Passing accuracy",
      value: totals.passingAccuracy === null ? "—" : `${totals.passingAccuracy}%`,
    },
    {
      label: "Top speed",
      value: totals.topSpeed === null ? "—" : `${totals.topSpeed} km/h`,
      detail: `${totals.distanceKm.toFixed(1)} km total distance`,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl border border-[#353941] bg-[#22252B] p-5">
          <p className="text-sm text-[#AEB5C0]">{item.label}</p>
          <p className="mt-2 text-2xl font-black">{item.value}</p>
          {item.detail && <p className="mt-1 text-xs text-[#AEB5C0]">{item.detail}</p>}
        </div>
      ))}
    </div>
  );
}
