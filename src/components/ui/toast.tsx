"use client";

import { useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/cn";

type Tone = "success" | "error" | "info";
type Toast = { id: number; message: string; tone: Tone };

const EMPTY: Toast[] = [];
let toasts: Toast[] = EMPTY;
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Show a toast from anywhere on the client. */
export function toast(message: string, tone: Tone = "success") {
  const id = ++seq;
  toasts = [...toasts.slice(-3), { id, message, tone }];
  emit();
  window.setTimeout(() => dismiss(id), tone === "error" ? 7000 : 4000);
}

function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Mount once per root layout. Announced to screen readers via a polite live region. */
export function Toaster() {
  const items = useSyncExternalStore(subscribe, () => toasts, () => EMPTY);
  const icon = { success: CheckCircle2, error: AlertTriangle, info: Info };
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[110] flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6">
      <AnimatePresence initial={false}>
        {items.map((t) => {
          const Icon = icon[t.tone];
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96, transition: { duration: 0.15 } }}
              transition={{ type: "spring", stiffness: 480, damping: 34 }}
              role="status"
              className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm shadow-elevated"
            >
              <Icon className={cn("mt-0.5 size-4 shrink-0", t.tone === "success" && "text-success", t.tone === "error" && "text-danger", t.tone === "info" && "text-info")} aria-hidden />
              <p className="flex-1 text-text">{t.message}</p>
              <button type="button" onClick={() => dismiss(t.id)} className="text-muted hover:text-text" aria-label="Dismiss"><X className="size-4" /></button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
