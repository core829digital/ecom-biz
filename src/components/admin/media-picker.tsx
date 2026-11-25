"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ImageIcon, X } from "lucide-react";
import { useT } from "@/components/i18n-provider";
import type { MessageKey } from "@/lib/i18n/en";

type Item = { id: string; url: string; name: string };
type Lister = (page: number) => Promise<{ items: Item[]; more: boolean }>;

/** Lets any image field offer "choose from library" when an editor provides the store's files. */
const MediaContext = createContext<Lister | null>(null);
export const MediaLibraryProvider = ({ list, children }: { list: Lister; children: React.ReactNode }) => <MediaContext.Provider value={list}>{children}</MediaContext.Provider>;
export const useMediaLibrary = () => useContext(MediaContext);

export function MediaPickerButton({ onPick }: { onPick: (url: string) => void }) {
  const list = useMediaLibrary();
  const t = useT();
  const tk = (k: string) => t(k as MessageKey);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[] | null>(null);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);

  useEffect(() => {
    if (!open || !list) return;
    let alive = true;
    void list(page).then((r) => { if (alive) { setItems((prev) => (page === 1 ? r.items : [...(prev ?? []), ...r.items])); setMore(r.more); } });
    return () => { alive = false; };
  }, [open, page, list]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!list) return null;
  return (
    <>
      <button type="button" onClick={() => { setPage(1); setItems(null); setOpen(true); }} className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-text">
        <ImageIcon className="size-3.5" aria-hidden />{tk("media.pick")}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)}>
            <motion.div role="dialog" aria-label={tk("media.pick")} onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.98 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="flex max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <p className="text-sm font-semibold">{tk("media.pick")}</p>
                <button type="button" onClick={() => setOpen(false)} aria-label={t("common.close")} className="flex size-8 items-center justify-center rounded-lg hover:bg-surface-2"><X className="size-4" aria-hidden /></button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {items === null ? (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">{Array.from({ length: 10 }, (_, i) => <span key={i} className="skeleton aspect-square" />)}</div>
                ) : items.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted">{tk("media.pickEmpty")}</p>
                ) : (
                  <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                    {items.map((it) => (
                      <li key={it.id}>
                        <button type="button" onClick={() => { onPick(it.url); setOpen(false); }} title={it.name} className="group block aspect-square w-full overflow-hidden rounded-lg border border-border transition-[border-color,box-shadow] hover:border-text hover:shadow-md">
                          <img src={it.url} alt={it.name} loading="lazy" className="size-full object-cover transition-transform duration-300 group-hover:scale-105" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {more && <button type="button" onClick={() => setPage((p) => p + 1)} className="mx-auto mt-4 block rounded-lg border border-border px-4 py-2 text-sm hover:bg-surface-2">{tk("media.more")}</button>}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
