"use client";

import { useState } from "react";
import { ActionForm, SubmitButton, useFieldError } from "@/components/ui/form";
import { Input, inputClass } from "@/components/ui/fields";
import { useT } from "@/components/i18n-provider";
import type { ActionState } from "@/lib/action";

/**
 * `countries` is computed on the server: country names come from the runtime's ICU data,
 * which differs between Node and browsers and would otherwise cause hydration mismatches.
 */
export function ZoneForm({ action, initial, countries: all }: { action: (s: ActionState, fd: FormData) => Promise<ActionState>; initial?: { name: string; countries: string[] }; countries: { code: string; name: string }[] }) {
  const t = useT();
  const [selected, setSelected] = useState<string[]>(initial?.countries ?? []);
  const [filter, setFilter] = useState("");
  const world = selected.includes("*");
  const visible = all.filter((c) => !filter || c.name.toLowerCase().includes(filter.toLowerCase()) || c.code.toLowerCase() === filter.toLowerCase());
  return (
    <ActionForm action={action} className="space-y-4">
      <Input name="name" label={t("settings.shipping.zoneName")} defaultValue={initial?.name} placeholder={t("settings.shipping.zoneNamePlaceholder")} required />
      {(world ? ["*"] : selected).map((c) => <input key={c} type="hidden" name="countries" value={c} />)}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={world} onChange={(e) => setSelected(e.target.checked ? ["*"] : [])} /> {t("settings.shipping.restOfWorld")}
      </label>
      {!world && (
        <div>
          <p className="mb-1 text-sm font-medium">{t("settings.shipping.countries")} <span className="text-muted">({selected.length})</span></p>
          <input className={inputClass} placeholder={t("common.search")} aria-label={t("common.search")} value={filter} onChange={(e) => setFilter(e.target.value)} />
          <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-border p-2">
            {visible.map((c) => (
              <label key={c.code} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-surface-2">
                <input type="checkbox" checked={selected.includes(c.code)} onChange={(e) => setSelected((s) => (e.target.checked ? [...s, c.code] : s.filter((x) => x !== c.code)))} />
                {c.name}
              </label>
            ))}
          </div>
          <CountriesError />
        </div>
      )}
      <div className="flex justify-end"><SubmitButton>{t("common.save")}</SubmitButton></div>
    </ActionForm>
  );
}

function CountriesError() {
  const e = useFieldError("countries");
  return e ? <p className="mt-1 text-xs text-danger">{e}</p> : null;
}
