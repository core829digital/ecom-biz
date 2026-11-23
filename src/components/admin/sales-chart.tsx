"use client";

import { useState } from "react";

type Point = { date: string; label: string; value: number; display: string; orders: number };

/**
 * Single-series daily bar chart. One neutral accent hue (no legend needed: the card title names it),
 * thin bars with rounded data-ends on a 2px gap, recessive gridlines, hover tooltip and a table fallback.
 */
export function SalesChart({ points, ordersLabel, emptyLabel, tableLabel }: { points: Point[]; ordersLabel: string; emptyLabel: string; tableLabel: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...points.map((p) => p.value), 0);
  if (max === 0) return <p className="flex h-48 items-center justify-center text-sm text-muted">{emptyLabel}</p>;
  const W = 600, H = 180, PAD_B = 18, gap = 2;
  const bw = W / points.length - gap;
  const ticks = [0.5, 1].map((f) => f * max);
  const h = (v: number) => (v / max) * (H - PAD_B - 8);
  const active = hover !== null ? points[hover] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-48 w-full" preserveAspectRatio="none" role="img" aria-hidden onMouseLeave={() => setHover(null)}>
        {ticks.map((v) => (
          <line key={v} x1={0} x2={W} y1={H - PAD_B - h(v)} y2={H - PAD_B - h(v)} stroke="var(--border)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        ))}
        <line x1={0} x2={W} y1={H - PAD_B} y2={H - PAD_B} stroke="var(--border)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        {points.map((p, i) => {
          const x = i * (bw + gap) + gap / 2;
          const bh = Math.max(p.value > 0 ? 2 : 0, h(p.value));
          return (
            <g key={p.date} onMouseEnter={() => setHover(i)}>
              {/* Hit target larger than the mark */}
              <rect x={x - gap / 2} y={0} width={bw + gap} height={H} fill="transparent" />
              <path
                d={bh > 0 ? `M${x},${H - PAD_B} v${-(bh - Math.min(4, bh))} q0,${-Math.min(4, bh)} ${Math.min(4, bw / 2)},${-Math.min(4, bh)} h${bw - 2 * Math.min(4, bw / 2)} q${Math.min(4, bw / 2)},0 ${Math.min(4, bw / 2)},${Math.min(4, bh)} v${bh - Math.min(4, bh)} z` : ""}
                fill="var(--accent)"
                opacity={hover === null || hover === i ? 1 : 0.45}
              />
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-muted" aria-hidden>
        <span>{points[0]?.label}</span>
        <span>{points[Math.floor(points.length / 2)]?.label}</span>
        <span>{points[points.length - 1]?.label}</span>
      </div>
      {active && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-lg"
          style={{ left: `${((hover! + 0.5) / points.length) * 100}%` }}
        >
          <p className="font-medium text-text">{active.label}</p>
          <p className="tabular-nums text-text">{active.display}</p>
          <p className="text-muted">{active.orders} {ordersLabel}</p>
        </div>
      )}
      <table className="sr-only">
        <caption>{tableLabel}</caption>
        <tbody>{points.map((p) => <tr key={p.date}><th scope="row">{p.label}</th><td>{p.display}</td><td>{p.orders}</td></tr>)}</tbody>
      </table>
    </div>
  );
}
