"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, ExternalLink, FileText, Trash2, UploadCloud, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { useT } from "@/components/i18n-provider";
import { toast } from "@/components/ui/toast";
import type { MessageKey } from "@/lib/i18n/en";
import { deleteFileAction, uploadFileAction, type MediaItem } from "./actions";

type Row = MediaItem & { places: string[] };
type Job = { id: string; name: string; state: "uploading" | "done" | "error"; error?: string };

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

/** Drag-and-drop uploader + grid of the store's files. */
export function FileLibrary({ slug, files, canDelete, accept }: { slug: string; files: Row[]; canDelete: boolean; accept: string }) {
  const t = useT();
  const tk = (k: string, v?: Record<string, string | number>) => t(k as MessageKey, v);
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const upload = async (list: FileList | File[]) => {
    const items = Array.from(list).slice(0, 30);
    const queued = items.map((f, i) => ({ id: `${Date.now()}-${i}`, name: f.name, state: "uploading" as const }));
    setJobs((j) => [...queued, ...j].slice(0, 12));
    for (const [i, f] of items.entries()) {
      const fd = new FormData();
      fd.append("file", f);
      const res = await uploadFileAction(slug, fd).catch(() => ({ error: t("upload.failed") }) as { error: string });
      setJobs((j) => j.map((x) => (x.id === queued[i].id ? { ...x, state: "error" in res && res.error ? "error" : "done", error: "error" in res ? res.error : undefined } : x)));
    }
    router.refresh();
  };

  const copy = async (f: Row) => {
    const abs = f.url.startsWith("/") ? `${window.location.origin}${f.url}` : f.url;
    await navigator.clipboard.writeText(abs).catch(() => undefined);
    setCopied(f.id);
    setTimeout(() => setCopied(null), 1500);
  };

  const remove = async (f: Row) => {
    if (!window.confirm(tk("media.deleteConfirm", { name: f.name }))) return;
    setDeleting(f.id);
    const res = await deleteFileAction(slug, f.id);
    setDeleting(null);
    if (res.error) toast(res.error, "error");
    else { toast(tk("media.deleted")); router.refresh(); }
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDrag(false); }}
      onDrop={(e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files.length) void upload(e.dataTransfer.files); }}
      className="relative"
    >
      <button type="button" onClick={() => input.current?.click()}
        className={cn("group flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors", drag ? "border-text bg-surface-2" : "border-border-strong hover:border-text/50 hover:bg-surface-2/60")}>
        <motion.span animate={{ y: drag ? -4 : 0, scale: drag ? 1.08 : 1 }} transition={{ type: "spring", stiffness: 400, damping: 24 }} className="flex size-11 items-center justify-center rounded-full bg-surface-2 transition-colors group-hover:bg-text group-hover:text-bg">
          <UploadCloud className="size-5" aria-hidden />
        </motion.span>
        <span className="text-sm font-medium">{tk("media.drop")}</span>
        <span className="text-xs text-muted">{tk("media.dropHint")}</span>
      </button>
      <input ref={input} type="file" multiple accept={accept} className="sr-only" onChange={(e) => { if (e.target.files?.length) void upload(e.target.files); e.target.value = ""; }} />

      <AnimatePresence initial={false}>
        {jobs.length > 0 && (
          <motion.ul initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-3 space-y-1 overflow-hidden">
            {jobs.map((j) => (
              <li key={j.id} className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-1.5 text-xs">
                {j.state === "uploading" ? <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent text-muted" aria-hidden /> : j.state === "done" ? <Check className="size-3.5 text-success" aria-hidden /> : <X className="size-3.5 text-danger" aria-hidden />}
                <span className="min-w-0 flex-1 truncate">{j.name}</span>
                {j.error && <span className="text-danger">{j.error}</span>}
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>

      {files.length === 0 ? (
        <p className="mt-8 text-center text-sm text-muted">{tk("media.empty")}</p>
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          <AnimatePresence initial={false}>
            {files.map((f, i) => (
              <motion.li key={f.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.3, delay: Math.min(i, 10) * 0.02 }}
                className="group overflow-hidden rounded-xl border border-border bg-surface">
                <div className="relative aspect-square bg-surface-2">
                  {f.contentType.startsWith("image/")
                    ? <img src={f.url} alt={f.name} loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                    : <span className="flex size-full flex-col items-center justify-center gap-1 text-muted"><FileText className="size-8" aria-hidden /><span className="text-xs font-medium uppercase">PDF</span></span>}
                  <div className="absolute inset-x-2 top-2 flex justify-end gap-1 opacity-0 transition-opacity duration-200 focus-within:opacity-100 group-hover:opacity-100">
                    <Tool label={copied === f.id ? tk("media.copied") : tk("media.copy")} onClick={() => copy(f)}>{copied === f.id ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}</Tool>
                    <a href={f.url} target="_blank" rel="noreferrer" title={tk("media.open")} aria-label={tk("media.open")} className="flex size-7 items-center justify-center rounded-md bg-surface/90 shadow-sm backdrop-blur hover:bg-surface"><ExternalLink className="size-3.5" aria-hidden /></a>
                    {canDelete && <Tool label={t("common.delete")} onClick={() => remove(f)} danger disabled={deleting === f.id}><Trash2 className="size-3.5" aria-hidden /></Tool>}
                  </div>
                </div>
                <div className="p-2.5">
                  <p className="truncate text-xs font-medium" title={f.name}>{f.name || "—"}</p>
                  <p className="mt-0.5 flex items-center justify-between gap-2 text-[11px] text-muted">
                    <span>{formatBytes(f.size)}</span>
                    {f.places.length > 0 ? <span title={f.places.map((p) => placeLabel(p, tk)).join("\n")} className="rounded-full bg-success-bg px-1.5 text-success">{tk("media.inUse", { count: f.places.length })}</span> : <span>{tk("media.unused")}</span>}
                  </p>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}

function Tool({ label, onClick, children, danger, disabled }: { label: string; onClick: () => void; children: React.ReactNode; danger?: boolean; disabled?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} title={label} aria-label={label} className={cn("flex size-7 items-center justify-center rounded-md bg-surface/90 shadow-sm backdrop-blur hover:bg-surface disabled:opacity-50", danger && "text-danger")}>{children}</button>;
}

export function placeLabel(p: string, tk: (k: string, v?: Record<string, string | number>) => string) {
  const [kind, ...rest] = p.split(":");
  return tk(`media.place.${kind}`, { name: rest.join(":") });
}
