"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/ui/form";
import { inputClass } from "@/components/ui/fields";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n-provider";
import { cn } from "@/lib/cn";
import type { ActionState } from "@/lib/action";

type Item = { title: string; url: string };

export function MenuEditor({ action, initial, suggestions }: { action: (s: ActionState, fd: FormData) => Promise<ActionState>; initial: Item[]; suggestions: Item[] }) {
  const t = useT();
  const [items, setItems] = useState<Item[]>(initial);
  const set = (i: number, patch: Partial<Item>) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (i: number, d: -1 | 1) => setItems((xs) => {
    const j = i + d;
    if (j < 0 || j >= xs.length) return xs;
    const n = [...xs];
    [n[i], n[j]] = [n[j], n[i]];
    return n;
  });
  const listId = `links-${Math.abs(initial.length * 7919)}`;
  return (
    <ActionForm action={action} className="space-y-3">
      <input type="hidden" name="items" value={JSON.stringify(items)} />
      <datalist id={listId}>{suggestions.map((s) => <option key={s.url} value={s.url}>{s.title}</option>)}</datalist>
      {items.length === 0 && <p className="text-sm text-muted">{t("navigation.empty")}</p>}
      {items.map((it, i) => (
        <div key={i} className="flex flex-wrap gap-2 sm:flex-nowrap">
          <input className={cn(inputClass, "sm:w-48")} aria-label={t("navigation.label")} placeholder={t("navigation.label")} value={it.title} onChange={(e) => set(i, { title: e.target.value })} />
          <input className={cn(inputClass, "flex-1")} aria-label={t("navigation.link")} placeholder="/collections/all" list={listId} value={it.url}
            onChange={(e) => {
              const url = e.target.value;
              const s = suggestions.find((x) => x.url === url);
              set(i, { url, ...(s && !it.title ? { title: s.title } : {}) });
            }} />
          <span className="flex">
            <Button variant="ghost" size="sm" className="h-10" onClick={() => move(i, -1)} aria-label="Up">↑</Button>
            <Button variant="ghost" size="sm" className="h-10" onClick={() => move(i, 1)} aria-label="Down">↓</Button>
            <Button variant="ghost" size="sm" className="h-10 text-danger" onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))}>{t("common.delete")}</Button>
          </span>
        </div>
      ))}
      <div className="flex items-center justify-between pt-2">
        <Button variant="secondary" size="sm" onClick={() => setItems((xs) => [...xs, { title: "", url: "" }])} disabled={items.length >= 30}>+ {t("navigation.add")}</Button>
        <SubmitButton>{t("common.save")}</SubmitButton>
      </div>
    </ActionForm>
  );
}
