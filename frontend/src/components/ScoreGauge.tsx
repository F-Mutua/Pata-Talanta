/** Semicircular 0–100 gauge for the talent score. */
export default function ScoreGauge({ value, caption }: { value: number; caption?: string }) {
  const v = Math.max(0, Math.min(100, value));
  const r = 80;
  const cx = 100;
  const cy = 96;
  const len = Math.PI * r; // length of the half circle
  const arc = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;

  return (
    <figure className="flex flex-col items-center">
      <svg viewBox="0 0 200 112" className="w-full max-w-[240px]" role="img" aria-label={`Talent score ${v} out of 100`}>
        <path d={arc} fill="none" stroke="#353941" strokeWidth={14} strokeLinecap="round" />
        <path
          d={arc}
          fill="none"
          stroke="#F47721"
          strokeWidth={14}
          strokeLinecap="round"
          strokeDasharray={`${(v / 100) * len} ${len}`}
        />
        <text x={cx} y={cy - 18} textAnchor="middle" fontSize={40} fontWeight={900} fill="#FFFFFF">
          {v}
        </text>
        <text x={cx} y={cy + 2} textAnchor="middle" fontSize={11} fill="#AEB5C0">
          out of 100
        </text>
        <text x={cx - r} y={cy + 16} textAnchor="middle" fontSize={10} fill="#AEB5C0">
          0
        </text>
        <text x={cx + r} y={cy + 16} textAnchor="middle" fontSize={10} fill="#AEB5C0">
          100
        </text>
      </svg>
      {caption && <figcaption className="mt-2 text-center text-xs text-[#AEB5C0]">{caption}</figcaption>}
    </figure>
  );
}
