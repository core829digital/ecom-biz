"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ExternalLink, Laptop, Loader2, Redo2, Smartphone, Undo2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { useT } from "@/components/i18n-provider";
import { toast } from "@/components/ui/toast";
import { themeCssVars, themeContrastIssues, type Theme } from "@/lib/theme";
import { newSectionId, type Section } from "@/lib/theme-sections";
import type { ActionState } from "@/lib/action";
import type { ThemeCapabilities } from "@/lib/theme-capabilities";
import { MediaLibraryProvider } from "@/components/admin/media-picker";
import { SectionInspector, SectionList, type Catalog } from "./editor-sections";
import { SettingsPanel, StylePanel } from "./editor-style";
import { Segmented, type UploadImage } from "./editor-fields";

type Action = (s: ActionState, fd: FormData) => Promise<ActionState>;
type Tab = "sections" | "style" | "settings";
type Status = "idle" | "saving" | "saved" | "error";

const HISTORY = 60;

export function SiteEditor(props: Parameters<typeof SiteEditorInner>[0] & { listImages: (page: number) => Promise<{ items: { id: string; url: string; name: string }[]; more: boolean }> }) {
  const { listImages, ...rest } = props;
  return <MediaLibraryProvider list={listImages}><SiteEditorInner {...rest} /></MediaLibraryProvider>;
}

function SiteEditorInner({ initial, hasDraft: initialDraft, storeName, backHref, previewSrc, storeUrl, fonts, catalog, caps, saveDraft, publish, discard, uploadImage }: {
  initial: Theme; hasDraft: boolean; storeName: string; backHref: string; previewSrc: string; storeUrl: string;
  fonts: { value: string; label: string }[]; catalog: Catalog; caps: ThemeCapabilities;
  saveDraft: Action; publish: Action; discard: () => Promise<{ theme: Theme }>; uploadImage: UploadImage;
}) {
  const t = useT();
  const [history, setHistory] = useState<{ past: Theme[]; present: Theme; future: Theme[] }>({ past: [], present: initial, future: [] });
  const theme = history.present;
  const [tab, setTab] = useState<Tab>("sections");
  const [selected, setSelected] = useState<string | null>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [status, setStatus] = useState<Status>("idle");
  const [hasDraft, setHasDraft] = useState(initialDraft);
  const [publishing, setPublishing] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const lastPush = useRef(0);
  const saveSeq = useRef(0);
  const skipSave = useRef(true);

  /** Records an undo step at most every 600 ms, so typing a word is one step, not one per letter. */
  const commit = useCallback((next: Theme) => {
    setHistory((h) => {
      const now = Date.now();
      const coalesce = now - lastPush.current < 600 && h.past.length > 0;
      lastPush.current = now;
      return { past: coalesce ? h.past : [...h.past, h.present].slice(-HISTORY), present: next, future: [] };
    });
  }, []);
  const update = useCallback((patch: Partial<Theme>) => commit({ ...history.present, ...patch }), [commit, history.present]);
  const setSections = (sections: Section[]) => update({ sections });
  const undo = useCallback(() => setHistory((h) => (h.past.length ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] } : h)), []);
  const redo = useCallback(() => setHistory((h) => (h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) } : h)), []);

  // Keyboard shortcuts (outside text fields, where the browser's own undo applies).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, [contenteditable]") || !(e.metaKey || e.ctrlKey)) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if (k === "y" || (k === "z" && e.shiftKey)) { e.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const previewDoc = () => {
    try { return frame.current?.contentDocument ?? null; } catch { return null; }
  };

  /**
   * Colors and shapes apply instantly in the preview; content changes arrive with the reload.
   * Everything goes through one injected <style> in the preview's <head>: elements rendered by
   * React are never touched, so the preview page hydrates without mismatches.
   */
  const paintPreview = useCallback(() => {
    const doc = previewDoc();
    if (!doc?.head || !doc.querySelector("body.storefront")) return;
    let style = doc.getElementById("sf-editor-overrides");
    if (!style) {
      style = doc.createElement("style");
      style.id = "sf-editor-overrides";
      doc.head.appendChild(style);
    }
    const vars = Object.entries(themeCssVars(theme)).map(([k, v]) => `${k}: ${v} !important;`).join(" ");
    const outline = selected && /^[a-z0-9]+$/.test(selected)
      ? `[data-section-id="${selected}"] { outline: 2px solid var(--brand); outline-offset: -2px; }`
      : "";
    style.textContent = `body.storefront { ${vars} } ${outline}`;
  }, [theme, selected]);
  useEffect(paintPreview, [paintPreview]);

  const reloadPreview = () => {
    const win = frame.current?.contentWindow;
    if (!win) return;
    try {
      sessionStorage.setItem("editor-scroll", String(win.scrollY));
      win.location.reload();
    } catch { /* cross-origin navigation inside the preview: leave it */ }
  };

  const onFrameLoad = () => {
    const doc = previewDoc();
    if (!doc) return;
    const y = Number(sessionStorage.getItem("editor-scroll") ?? 0);
    sessionStorage.removeItem("editor-scroll");
    if (y) doc.defaultView?.scrollTo({ top: y });
    paintPreview();
    // Clicking a homepage section in the preview opens it in the sidebar.
    doc.addEventListener("click", (e) => {
      const sec = (e.target as HTMLElement).closest<HTMLElement>("[data-section-id]");
      if (!sec) return;
      e.preventDefault();
      setTab("sections");
      setSelected(sec.dataset.sectionId ?? null);
    }, true);
  };

  // Autosave the draft shortly after the last change, then refresh the preview.
  useEffect(() => {
    if (skipSave.current) { skipSave.current = false; return; }
    setStatus("saving");
    const seq = ++saveSeq.current;
    const timer = setTimeout(async () => {
      const fd = new FormData();
      fd.set("payload", JSON.stringify(theme));
      const res = await saveDraft(null, fd).catch(() => null);
      if (seq !== saveSeq.current) return;
      if (res?.ok) { setStatus("saved"); setHasDraft(true); reloadPreview(); }
      else { setStatus("error"); toast(res?.error ?? t("editor.saveFailed"), "error"); }
    }, 700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (status === "saving") e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [status]);

  // Scroll the preview to the section being edited.
  useEffect(() => {
    if (!selected) return;
    previewDoc()?.querySelector(`[data-section-id="${selected}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selected]);

  const doPublish = async () => {
    setPublishing(true);
    const fd = new FormData();
    fd.set("payload", JSON.stringify(theme));
    const res = await publish(null, fd).catch(() => null);
    setPublishing(false);
    if (res?.ok) { setHasDraft(false); toast(t("theme.published")); }
    else toast(res?.error ?? t("editor.saveFailed"), "error");
  };

  const doDiscard = async () => {
    if (!confirmDiscard) { setConfirmDiscard(true); setTimeout(() => setConfirmDiscard(false), 3500); return; }
    setConfirmDiscard(false);
    const { theme: published } = await discard();
    skipSave.current = true;
    setHistory({ past: [], present: published, future: [] });
    setHasDraft(false);
    setSelected(null);
    setStatus("idle");
    reloadPreview();
  };

  const sel = theme.sections.find((s) => s.id === selected) ?? null;
  const issues = themeContrastIssues(theme);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-surface-2 text-text">
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-surface px-3">
        <Link href={backHref} className="flex size-9 items-center justify-center rounded-lg hover:bg-surface-2" aria-label={t("common.back")}><ArrowLeft className="size-4" aria-hidden /></Link>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">{storeName}</p>
          <SaveStatus status={status} hasDraft={hasDraft} />
        </div>
        <div className="ml-2 hidden items-center gap-0.5 sm:flex">
          <IconBtn label={t("editor.undo")} onClick={undo} disabled={!history.past.length}><Undo2 className="size-4" aria-hidden /></IconBtn>
          <IconBtn label={t("editor.redo")} onClick={redo} disabled={!history.future.length}><Redo2 className="size-4" aria-hidden /></IconBtn>
        </div>
        <div className="mx-auto hidden lg:block">
          <Segmented hideLabel label={t("editor.device")} value={device} onChange={setDevice} options={[
            { value: "desktop", label: <Laptop className="size-4" aria-hidden />, title: t("editor.desktop") },
            { value: "mobile", label: <Smartphone className="size-4" aria-hidden />, title: t("editor.mobile") },
          ]} />
        </div>
        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          <a href={storeUrl} target="_blank" rel="noreferrer" className="hidden h-9 items-center gap-1.5 rounded-lg px-3 text-sm text-muted hover:bg-surface-2 hover:text-text md:flex">
            {t("nav.viewStore")}<ExternalLink className="size-3.5" aria-hidden />
          </a>
          <button type="button" onClick={() => setShowPreview((v) => !v)} className="h-9 rounded-lg border border-border px-3 text-sm lg:hidden">{showPreview ? t("editor.edit") : t("theme.preview")}</button>
          {hasDraft && (
            <button type="button" onClick={doDiscard} className={cn("hidden h-9 rounded-lg px-3 text-sm transition-colors sm:block", confirmDiscard ? "bg-danger-bg text-danger" : "text-muted hover:bg-surface-2 hover:text-text")}>
              {confirmDiscard ? t("editor.discardConfirm") : t("editor.discard")}
            </button>
          )}
          <button type="button" onClick={doPublish} disabled={publishing || status === "saving" || !hasDraft}
            className="relative flex h-9 items-center gap-2 overflow-hidden rounded-lg bg-accent px-4 text-sm font-medium text-accent-contrast transition-opacity hover:opacity-90 disabled:opacity-40">
            {publishing && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {t("editor.publish")}
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Sidebar */}
        <aside className={cn("flex w-full shrink-0 flex-col border-r border-border bg-surface lg:w-[340px]", showPreview && "hidden lg:flex")}>
          <nav className="flex shrink-0 gap-1 border-b border-border p-2" aria-label={t("editor.panels")}>
            {(["sections", "style", "settings"] as const).map((k) => (
              <button key={k} type="button" onClick={() => { setTab(k); if (k !== "sections") setSelected(null); }} aria-current={tab === k}
                className={cn("relative h-8 flex-1 rounded-md text-sm font-medium transition-colors", tab === k ? "text-text" : "text-muted hover:text-text")}>
                {tab === k && <motion.span layoutId="editor-tab" className="absolute inset-0 -z-0 rounded-md bg-surface-2" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
                <span className="relative">{t(`editor.tab.${k}`)}</span>
                {k === "style" && issues.length > 0 && <span className="absolute right-2 top-1.5 size-1.5 rounded-full bg-danger" aria-label={t("editor.contrast.fail")} />}
              </button>
            ))}
          </nav>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div key={tab + (sel ? sel.id : "")} initial={{ opacity: 0, x: sel ? 16 : -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}>
                {tab === "sections" && !sel && <SectionList sections={theme.sections} selected={selected} onSelect={setSelected} onChange={setSections} />}
                {tab === "sections" && sel && (
                  <SectionInspector section={sel} catalog={catalog} caps={caps} uploadImage={uploadImage}
                    onChange={(next) => setSections(theme.sections.map((s) => (s.id === next.id ? next : s)))}
                    onBack={() => setSelected(null)}
                    onDuplicate={() => {
                      const i = theme.sections.findIndex((s) => s.id === sel.id);
                      const copy = { ...structuredClone(sel), id: newSectionId() } as Section;
                      setSections([...theme.sections.slice(0, i + 1), copy, ...theme.sections.slice(i + 1)]);
                      setSelected(copy.id);
                    }}
                    onDelete={() => { setSections(theme.sections.filter((s) => s.id !== sel.id)); setSelected(null); }} />
                )}
                {tab === "style" && <StylePanel theme={theme} update={update} fonts={fonts} caps={caps} uploadImage={uploadImage} />}
                {tab === "settings" && <SettingsPanel theme={theme} update={update} caps={caps} />}
              </motion.div>
            </AnimatePresence>
          </div>
        </aside>

        {/* Live preview */}
        <main className={cn("min-w-0 flex-1 items-start justify-center overflow-hidden p-3 lg:flex lg:p-5", showPreview ? "flex" : "hidden")}>
          <motion.div layout transition={{ type: "spring", stiffness: 260, damping: 32 }}
            className={cn("h-full overflow-hidden bg-white shadow-[0_1px_2px_rgb(0_0_0/0.06),0_12px_40px_-12px_rgb(0_0_0/0.25)]", device === "mobile" ? "w-[390px] max-w-full rounded-[28px] border-[6px] border-black" : "w-full rounded-xl border border-border")}>
            <iframe ref={frame} src={previewSrc} onLoad={onFrameLoad} title={t("theme.preview")} className="size-full bg-white" />
          </motion.div>
        </main>
      </div>
    </div>
  );
}

function IconBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={label} aria-label={label} className="flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-text disabled:opacity-30 disabled:hover:bg-transparent">
      {children}
    </button>
  );
}

function SaveStatus({ status, hasDraft }: { status: Status; hasDraft: boolean }) {
  const t = useT();
  const text = status === "saving" ? t("common.saving") : status === "error" ? t("editor.saveFailed") : hasDraft ? t("editor.draftUnpublished") : t("editor.upToDate");
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.p key={text} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -3 }} transition={{ duration: 0.15 }}
        className={cn("flex items-center gap-1.5 text-[11px] leading-tight", status === "error" ? "text-danger" : "text-muted")}>
        <span className={cn("size-1.5 rounded-full", status === "saving" ? "animate-pulse bg-warning" : status === "error" ? "bg-danger" : hasDraft ? "bg-warning" : "bg-success")} aria-hidden />
        {text}
      </motion.p>
    </AnimatePresence>
  );
}
