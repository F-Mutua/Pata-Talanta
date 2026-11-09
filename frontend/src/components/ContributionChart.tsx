"use client";

import { useState } from "react";

export type ChartPoint = {
  id: string;
  label: string; // opponent
  date: string; // formatted
  goals: number;
  assists: number;
};

/**
 * Goal contributions (goals + assists) per match, oldest → newest.
 * One series, so no legend: the heading names it. Hover/focus a bar for the
 * breakdown.
 */
export default function ContributionChart({ points }: { points: ChartPoint[] }) {
  const [active, setActive] = useState<number | null>(null);

  if (points.length === 0) return null;

  const W = 600;
  const H = 180;
  const pad = { top: 12, right: 8, bottom: 28, left: 28 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;

  const values = points.map((p) => p.goals + p.assists);
  const max = Math.max(2, ...values);
  const ticks = max <= 4 ? [0, 1, 2, 3, 4].filter((t) => t <= max) : [0, Math.round(max / 2), max];

  const slot = innerW / points.length;
  const barW = Math.min(36, slot * 0.6);
  const y = (v: number) => pad.top + innerH - (v / max) * innerH;

  const a = active !== null ? points[active] : null;

  return (
    <figure>
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block h-auto w-full"
          role="img"
          aria-label={`Goals plus assists over your last ${points.length} matches`}
          onMouseLeave={() => setActive(null)}
        >
          {/* Recessive grid */}
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={pad.left}
                x2={W - pad.right}
                y1={y(t)}
                y2={y(t)}
                stroke="#353941"
                strokeWidth={1}
              />
              <text x={pad.left - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="#AEB5C0">
                {t}
              </text>
            </g>
          ))}

          {points.map((p, i) => {
            const v = values[i];
            const cx = pad.left + slot * i + slot / 2;
            const top = y(v);
            const h = pad.top + innerH - top;
            return (
              <g key={p.id}>
                {/* Hit target wider and taller than the bar */}
                <rect
                  x={pad.left + slot * i}
                  y={pad.top}
                  width={slot}
                  height={innerH}
                  fill="transparent"
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  tabIndex={0}
                  aria-label={`${p.label}, ${p.date}: ${p.goals} goals, ${p.assists} assists`}
                />
                {v > 0 ? (
                  <path
                    // Rounded data end (4px), square at the baseline.
                    d={`M${cx - barW / 2},${top + h} V${top + Math.min(4, h)} Q${cx - barW / 2},${top} ${cx - barW / 2 + Math.min(4, h)},${top} H${cx + barW / 2 - Math.min(4, h)} Q${cx + barW / 2},${top} ${cx + barW / 2},${top + Math.min(4, h)} V${top + h} Z`}
                    fill="#F47721"
                    opacity={active === null || active === i ? 1 : 0.45}
                    pointerEvents="none"
                  />
                ) : (
                  <line
                    x1={cx - barW / 2}
                    x2={cx + barW / 2}
                    y1={pad.top + innerH}
                    y2={pad.top + innerH}
                    stroke="#F47721"
                    strokeWidth={2}
                    opacity={0.6}
                    pointerEvents="none"
                  />
                )}
                <text
                  x={cx}
                  y={H - 8}
                  textAnchor="middle"
                  fontSize={11}
                  fill={active === i ? "#FFFFFF" : "#AEB5C0"}
                  pointerEvents="none"
                >
                  {p.label.length > 9 ? `${p.label.slice(0, 8)}…` : p.label}
                </text>
              </g>
            );
          })}
        </svg>

        {a && active !== null && (
          <div
            className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-lg border border-[#454A54] bg-[#17191D] px-3 py-2 text-xs shadow-lg"
            style={{ left: `${((pad.left + slot * active + slot / 2) / W) * 100}%` }}
            role="status"
          >
            <p className="font-semibold text-white">vs {a.label}</p>
            <p className="text-[#AEB5C0]">{a.date}</p>
            <p className="mt-1 text-white">
              {a.goals} goal{a.goals === 1 ? "" : "s"} · {a.assists} assist{a.assists === 1 ? "" : "s"}
            </p>
          </div>
        )}
      </div>
    </figure>
  );
}
