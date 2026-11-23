import { Star } from "lucide-react";

/** Read-only star rating (supports fractions via clipped overlay). */
export function Stars({ value, size = 16, label }: { value: number; size?: number; label?: string }) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  return (
    <span className="relative inline-flex" role="img" aria-label={label ?? `${value.toFixed(1)} / 5`}>
      <span className="flex text-border-strong">{Array.from({ length: 5 }, (_, i) => <Star key={i} style={{ width: size, height: size }} className="fill-current" aria-hidden />)}</span>
      <span className="absolute inset-0 flex overflow-hidden text-amber-400" style={{ width: `${pct}%` }}>
        {Array.from({ length: 5 }, (_, i) => <Star key={i} style={{ width: size, height: size }} className="shrink-0 fill-current" aria-hidden />)}
      </span>
    </span>
  );
}
