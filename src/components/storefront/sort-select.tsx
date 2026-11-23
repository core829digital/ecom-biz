"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function SortSelect({ value, label, options }: { value: string; label: string; options: { value: string; label: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <label className="flex items-center gap-2">
      <span className="text-muted">{label}</span>
      <select
        className="rounded-md border border-border bg-bg px-2 py-1.5"
        value={value}
        onChange={(e) => {
          const sp = new URLSearchParams(params);
          sp.set("sort", e.target.value);
          sp.delete("page");
          router.push(`${pathname}?${sp}`);
        }}
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}
