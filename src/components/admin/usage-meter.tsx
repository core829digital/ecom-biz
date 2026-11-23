import Link from "next/link";
import { cn } from "@/lib/cn";

/** Compact plan usage card for the sidebar. Bars turn amber at 80% and red at 100%. */
export function UsageMeter({ title, planName, href, rows }: { title: string; planName: string; href: string; rows: { label: string; used: number; limit: number | null }[] }) {
  return (
    <Link href={href} className="block rounded-lg border border-border bg-surface p-3 text-xs transition-colors hover:border-border-strong">
      <p className="flex items-center justify-between font-medium"><span>{title}</span><span className="text-muted">{planName}</span></p>
      <ul className="mt-2 space-y-2">
        {rows.map((r) => {
          const pct = r.limit ? Math.min(100, Math.round((r.used / r.limit) * 100)) : 0;
          return (
            <li key={r.label}>
              <div className="flex justify-between text-muted"><span>{r.label}</span><span className="tabular-nums">{r.used}{r.limit !== null ? ` / ${r.limit}` : ""}</span></div>
              {r.limit !== null && (
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-valuenow={r.used} aria-valuemax={r.limit} aria-label={r.label}>
                  <div className={cn("h-full rounded-full transition-[width] duration-500", pct >= 100 ? "bg-danger" : pct >= 80 ? "bg-warning" : "bg-accent")} style={{ width: `${pct}%` }} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Link>
  );
}
