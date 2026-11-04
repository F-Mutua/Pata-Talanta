"use client";

import { useState } from "react";

/**
 * Pitch heatmap. `intensities` is rows × cols of non-negative numbers, laid
 * out with columns running goal-to-goal (left = own goal) and rows running
 * touchline-to-touchline. Values are normalised to the grid's maximum, so
 * the scale reads as "share of this player's peak activity".
 *
 * Sequential encoding: one hue (brand orange), opacity rises with intensity.
 */
const W = 105;
const H = 68;

export default function Heatmap({
  intensities,
  caption,
}: {
  intensities: number[][];
  caption?: string;
}) {
  const [hover, setHover] = useState<{ r: number; c: number } | null>(null);

  const rows = intensities.length;
  const cols = rows ? intensities[0].length : 0;
  if (!rows || !cols) return null;

  const max = Math.max(...intensities.flat().map((v) => Number(v) || 0), 0);
  const total = intensities.flat().reduce((t, v) => t + (Number(v) || 0), 0);
  const cw = W / cols;
  const ch = H / rows;
  const share = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);

  const hovered = hover ? Number(intensities[hover.r][hover.c]) || 0 : null;
  const third = (c: number) =>
    c < cols / 3 ? "defensive third" : c < (2 * cols) / 3 ? "middle third" : "attacking third";

  return (
    <figure>
      <div className="relative overflow-hidden rounded-xl border border-white/15 bg-[#1B3A2A]">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block h-auto w-full"
          role="img"
          aria-label={`Activity heatmap, ${rows} by ${cols} zones. ${caption ?? ""}`}
          onMouseLeave={() => setHover(null)}
        >
          {intensities.map((row, r) =>
            row.map((raw, c) => {
              const v = Number(raw) || 0;
              const t = max > 0 ? v / max : 0;
              return (
                <rect
                  key={`${r}-${c}`}
                  x={c * cw + 0.2}
                  y={r * ch + 0.2}
                  width={cw - 0.4}
                  height={ch - 0.4}
                  rx={0.6}
                  fill="#F47721"
                  fillOpacity={t === 0 ? 0 : 0.12 + t * 0.83}
                  stroke={hover?.r === r && hover?.c === c ? "#fff" : "none"}
                  strokeWidth={0.4}
                  onMouseEnter={() => setHover({ r, c })}
                />
              );
            })
          )}

          {/* Pitch markings, drawn above the cells */}
          <g fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth={0.4} pointerEvents="none">
            <rect x={0.2} y={0.2} width={W - 0.4} height={H - 0.4} />
            <line x1={W / 2} y1={0} x2={W / 2} y2={H} />
            <circle cx={W / 2} cy={H / 2} r={9.15} />
            <rect x={0.2} y={H / 2 - 20.16} width={16.5} height={40.32} />
            <rect x={W - 16.7} y={H / 2 - 20.16} width={16.5} height={40.32} />
            <rect x={0.2} y={H / 2 - 9.16} width={5.5} height={18.32} />
            <rect x={W - 5.7} y={H / 2 - 9.16} width={5.5} height={18.32} />
          </g>
        </svg>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-[#AEB5C0]">
        <p className="min-h-[1rem]" aria-live="polite">
          {hover && hovered !== null
            ? `Zone ${hover.r + 1}·${hover.c + 1} (${third(hover.c)}): ${share(hovered)}% of recorded activity`
            : "Hover a zone for detail · attacking left → right"}
        </p>
        <div className="flex items-center gap-2">
          <span>Low</span>
          <span
            className="h-2 w-24 rounded-full"
            style={{
              background:
                "linear-gradient(to right, rgba(244,119,33,0.12), rgba(244,119,33,0.95))",
            }}
          />
          <span>High</span>
        </div>
      </div>
      {caption && <figcaption className="mt-1 text-xs text-[#AEB5C0]">{caption}</figcaption>}
    </figure>
  );
}
