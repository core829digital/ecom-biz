import Link from "next/link";
import { cn } from "@/lib/cn";
import { inputClass } from "@/components/ui/fields";

/** Build a URL keeping current params, overriding the given ones (null removes). */
export function withParams(basePath: string, current: Record<string, string | undefined>, patch: Record<string, string | null>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(current)) if (v) sp.set(k, v);
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) sp.delete(k);
    else sp.set(k, v);
  }
  const q = sp.toString();
  return q ? `${basePath}?${q}` : basePath;
}

export function FilterTabs({ basePath, params, name, options }: {
  basePath: string;
  params: Record<string, string | undefined>;
  name: string;
  options: { value: string | null; label: string }[];
}) {
  const current = params[name] ?? null;
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-border px-2" role="tablist">
      {options.map((o) => {
        const active = (o.value ?? null) === current;
        return (
          <Link
            key={o.label}
            href={withParams(basePath, params, { [name]: o.value, page: null })}
            role="tab"
            aria-selected={active}
            className={cn("whitespace-nowrap border-b-2 px-3 py-2.5 text-sm", active ? "border-accent font-medium text-text" : "border-transparent text-muted hover:text-text")}
          >
            {o.label}
          </Link>
        );
      })}
    </div>
  );
}

export function SearchBox({ basePath, params, placeholder }: { basePath: string; params: Record<string, string | undefined>; placeholder: string }) {
  return (
    <form action={basePath} className="p-3">
      {Object.entries(params).map(([k, v]) => (k !== "q" && k !== "page" && v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <input type="search" name="q" defaultValue={params.q} placeholder={placeholder} aria-label={placeholder} className={inputClass} />
    </form>
  );
}

export function Pagination({ basePath, params, page, pages, labels }: {
  basePath: string;
  params: Record<string, string | undefined>;
  page: number;
  pages: number;
  labels: { previous: string; next: string; summary: string };
}) {
  if (pages <= 1) return null;
  return (
    <nav className="flex items-center justify-between px-4 py-3 text-sm" aria-label="Pagination">
      {page > 1 ? <Link className="hover:underline" href={withParams(basePath, params, { page: String(page - 1) })}>← {labels.previous}</Link> : <span />}
      <span className="text-muted">{labels.summary}</span>
      {page < pages ? <Link className="hover:underline" href={withParams(basePath, params, { page: String(page + 1) })}>{labels.next} →</Link> : <span />}
    </nav>
  );
}

export function parsePage(v: string | undefined) {
  const n = parseInt(v ?? "1", 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 10_000) : 1;
}
