"use client";

import { useEffect, useState, type RefObject } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, ArrowUp, Copy, EyeOff, Plus, Trash2 } from "lucide-react";
import { useT } from "@/components/i18n-provider";
import type { MessageKey } from "@/lib/i18n/en";
import { blankSection, MAX_SECTIONS, newSectionId, SECTION_TYPES, type Section, type SectionType } from "@/lib/theme-sections";
import { toast } from "@/components/ui/toast";
import { SECTION_ICONS } from "./editor-sections";

type Rect = { top: number; left: number; width: number; height: number; viewH: number };

/**
 * Floating controls over the section under the pointer in the live preview: move, duplicate,
 * hide, delete, and "+" to insert a new section right below. Positioned in the preview frame's
 * coordinates and kept in place while the preview scrolls.
 */
export function SectionOverlay({ frame, version, sectionId, sections, onChange, onSelect }: {
  frame: RefObject<HTMLIFrameElement | null>; version: number; sectionId: string | null; sections: Section[];
  onChange: (s: Section[]) => void; onSelect: (id: string) => void;
}) {
  const t = useT();
  const tk = (k: string, v?: Record<string, string | number>) => t(k as MessageKey, v);
  const [rect, setRect] = useState<Rect | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    setAdding(false);
    let win: Window | null = null;
    try { win = frame.current?.contentWindow ?? null; } catch { win = null; }
    const doc = win?.document;
    if (!win || !doc || !sectionId) { setRect(null); return; }
    let raf = 0;
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = doc.querySelector<HTMLElement>(`[data-section-id="${sectionId}"]`);
        if (!el) { setRect(null); return; }
        const r = el.getBoundingClientRect();
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height, viewH: win!.innerHeight });
      });
    };
    measure();
    win.addEventListener("scroll", measure, { passive: true });
    win.addEventListener("resize", measure);
    return () => { cancelAnimationFrame(raf); win?.removeEventListener("scroll", measure); win?.removeEventListener("resize", measure); };
  }, [frame, version, sectionId, sections.length]);

  const index = sections.findIndex((s) => s.id === sectionId);
  const section = sections[index];
  if (!rect || !section) return null;

  const move = (dir: -1 | 1) => {
    const to = index + dir;
    if (to < 0 || to >= sections.length) return;
    const next = [...sections];
    [next[index], next[to]] = [next[to], next[index]];
    onChange(next);
  };
  const duplicate = () => {
    const copy = { ...structuredClone(section), id: newSectionId() } as Section;
    onChange([...sections.slice(0, index + 1), copy, ...sections.slice(index + 1)]);
    onSelect(copy.id);
  };
  const hide = () => {
    onChange(sections.map((s) => (s.id === section.id ? { ...s, enabled: false } : s)));
    toast(tk("editor.overlay.hidden"));
  };
  const remove = () => {
    onChange(sections.filter((s) => s.id !== section.id));
    toast(tk("editor.overlay.removed"));
  };
  const insert = (type: SectionType) => {
    const s = blankSection(type);
    onChange([...sections.slice(0, index + 1), s, ...sections.slice(index + 1)]);
    onSelect(s.id);
    setAdding(false);
  };

  // Keep the toolbar visible when the section's top is scrolled out of view.
  const barTop = Math.max(8, Math.min(rect.top + 8, rect.top + rect.height - 44));
  const plusTop = rect.top + rect.height;
  const visible = rect.top + rect.height > 0 && rect.top < rect.viewH;
  if (!visible) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden" aria-hidden={false}>
      <motion.div key={section.id} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}
        className="pointer-events-auto absolute flex items-center gap-0.5 rounded-lg border border-black/10 bg-white/95 p-0.5 text-zinc-800 shadow-lg backdrop-blur"
        style={{ top: barTop, left: Math.max(8, rect.left + rect.width - 8 - 200) }}>
        <span className="px-2 text-[11px] font-semibold">{tk(`editor.section.${section.type}`)}</span>
        <Btn label={tk("editor.moveUp")} onClick={() => move(-1)} disabled={index === 0}><ArrowUp className="size-3.5" /></Btn>
        <Btn label={tk("editor.moveDown")} onClick={() => move(1)} disabled={index === sections.length - 1}><ArrowDown className="size-3.5" /></Btn>
        <Btn label={tk("editor.duplicate")} onClick={duplicate} disabled={sections.length >= MAX_SECTIONS}><Copy className="size-3.5" /></Btn>
        <Btn label={tk("editor.hide")} onClick={hide}><EyeOff className="size-3.5" /></Btn>
        <Btn label={tk("editor.removeSection")} onClick={remove} danger><Trash2 className="size-3.5" /></Btn>
      </motion.div>

      {plusTop > 0 && plusTop < rect.viewH && (
        <div className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2" style={{ top: plusTop, left: rect.left + rect.width / 2 }}>
          <motion.button type="button" onClick={() => setAdding((a) => !a)} disabled={sections.length >= MAX_SECTIONS} title={tk("editor.addSection")} aria-label={tk("editor.addSection")}
            whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.92 }}
            className="flex size-7 items-center justify-center rounded-full bg-zinc-900 text-white shadow-lg ring-4 ring-white/70 disabled:opacity-40">
            <motion.span animate={{ rotate: adding ? 45 : 0 }} transition={{ duration: 0.3 }}><Plus className="size-4" /></motion.span>
          </motion.button>
          <AnimatePresence>
            {adding && (
              <motion.ul initial={{ opacity: 0, y: 6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, scale: 0.97 }} transition={{ duration: 0.18 }}
                className="absolute left-1/2 top-9 grid w-72 -translate-x-1/2 grid-cols-2 gap-1 rounded-xl border border-black/10 bg-white p-1.5 text-zinc-800 shadow-2xl">
                {SECTION_TYPES.map((type) => {
                  const Icon = SECTION_ICONS[type];
                  return (
                    <li key={type}>
                      <button type="button" onClick={() => insert(type)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-zinc-100">
                        <Icon className="size-3.5 text-zinc-500" />{tk(`editor.section.${type}`)}
                      </button>
                    </li>
                  );
                })}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function Btn({ label, onClick, children, disabled, danger }: { label: string; onClick: () => void; children: React.ReactNode; disabled?: boolean; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={label} aria-label={label}
      className={`flex size-7 items-center justify-center rounded-md transition-colors hover:bg-zinc-100 disabled:opacity-30 ${danger ? "text-red-600" : ""}`}>
      {children}
    </button>
  );
}
