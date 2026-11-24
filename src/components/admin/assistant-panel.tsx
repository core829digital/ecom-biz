"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUp, History, Plus, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { useT } from "@/components/i18n-provider";
import type { MessageKey } from "@/lib/i18n/en";
import { bodyToHtml } from "@/lib/marketing-render";
import type { AssistantMessage } from "@/server/ai/assistant";
import { askAssistantAction, listConversationsAction, loadConversationAction } from "@/app/(platform)/admin/[store]/assistant/actions";

const ease = [0.22, 1, 0.36, 1] as const;

/** Chat with the store assistant, available on every admin page (button, Ctrl+J, or ?assistant=…). */
export function AssistantPanel({ slug, enabled, canUse, memoryHref }: { slug: string; enabled: boolean; canUse: boolean; memoryHref: string }) {
  const t = useT();
  const tk = (k: string, v?: Record<string, string | number>) => t(k as MessageKey, v);
  const reduce = useReducedMotion();
  const search = useSearchParams();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<{ used: number; limit: number } | null>(null);
  const [history, setHistory] = useState<{ id: string; title: string }[] | null>(null);
  const [pending, start] = useTransition();
  const scroller = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);

  const send = useCallback((text: string) => {
    const clean = text.trim();
    if (!clean || pending) return;
    setError(null);
    setInput("");
    setMessages((m) => [...m, { id: `local-${Date.now()}`, role: "user", content: clean, actions: [], createdAt: new Date().toISOString() }]);
    start(async () => {
      const res = await askAssistantAction(slug, conversationId, clean);
      if (res.ok) {
        setConversationId(res.conversationId);
        setMessages((m) => [...m, res.message]);
        setUsage(res.usage);
      } else setError(res.error);
    });
  }, [conversationId, pending, slug]);

  // Ctrl/Cmd + J toggles the panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "j") { e.preventDefault(); setOpen((o) => !o); }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Deep link: ?assistant=1 opens it, ?assistant=build starts the "store in 5 minutes" flow.
  const deepLink = search.get("assistant");
  useEffect(() => {
    if (!deepLink) return;
    setOpen(true);
    if (deepLink === "build" && enabled && canUse) setInput(tk("ai.build.prompt"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLink]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: reduce ? "auto" : "smooth" });
  }, [messages, pending, reduce]);
  useEffect(() => { if (open) setTimeout(() => field.current?.focus(), 250); }, [open]);

  const newChat = () => { setConversationId(null); setMessages([]); setError(null); setHistory(null); };
  const openHistory = async () => setHistory(history ? null : await listConversationsAction(slug));
  const loadChat = async (id: string) => {
    const c = await loadConversationAction(slug, id);
    if (c) { setConversationId(c.id); setMessages(c.messages); setHistory(null); }
  };

  const suggestions = ["ai.suggest.build", "ai.suggest.products", "ai.suggest.campaign", "ai.suggest.seo"];

  return (
    <>
      <motion.button
        type="button" onClick={() => setOpen((o) => !o)} aria-label={tk("ai.open")} aria-expanded={open}
        whileHover={reduce ? undefined : { y: -2 }} whileTap={reduce ? undefined : { scale: 0.94 }}
        className="group fixed bottom-5 right-5 z-40 flex h-12 items-center gap-2 rounded-full bg-text pl-4 pr-5 text-sm font-medium text-bg shadow-[0_12px_32px_-10px_rgb(0_0_0/0.55)]">
        <motion.span animate={{ rotate: open ? 135 : 0 }} transition={{ duration: 0.45, ease }} className="flex">
          {open ? <Plus className="size-4" aria-hidden /> : <Sparkles className="size-4 transition-transform group-hover:scale-110" aria-hidden />}
        </motion.span>
        <span className="hidden sm:inline">{tk("ai.name")}</span>
        <kbd className="ml-1 hidden rounded border border-bg/25 px-1 text-[10px] opacity-60 sm:inline">Ctrl J</kbd>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.aside
            role="dialog" aria-label={tk("ai.name")}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.97, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98, filter: "blur(4px)" }}
            transition={{ duration: 0.38, ease }}
            style={{ transformOrigin: "bottom right" }}
            className="fixed inset-x-2 bottom-20 top-16 z-40 flex flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_30px_80px_-20px_rgb(0_0_0/0.45)] sm:inset-x-auto sm:right-5 sm:top-auto sm:h-[min(680px,calc(100dvh-7rem))] sm:w-[420px]">
            <header className="flex items-center gap-2 border-b border-border px-3 py-2.5">
              <span className="flex size-8 items-center justify-center rounded-full bg-text text-bg"><Sparkles className="size-4" aria-hidden /></span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-tight">{tk("ai.name")}</p>
                <p className="truncate text-[11px] text-muted">{usage ? tk("ai.usage", { used: usage.used, limit: usage.limit }) : tk("ai.tagline")}</p>
              </div>
              <IconButton label={tk("ai.history")} onClick={openHistory}><History className="size-4" aria-hidden /></IconButton>
              <IconButton label={tk("ai.newChat")} onClick={newChat}><Plus className="size-4" aria-hidden /></IconButton>
              <IconButton label={t("common.close")} onClick={() => setOpen(false)}><X className="size-4" aria-hidden /></IconButton>
            </header>

            <AnimatePresence>
              {history && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease }} className="max-h-60 overflow-y-auto border-b border-border bg-surface-2">
                  {history.length === 0 ? <p className="px-4 py-3 text-xs text-muted">{tk("ai.noHistory")}</p> : history.map((h) => (
                    <button key={h.id} type="button" onClick={() => loadChat(h.id)} className="block w-full truncate px-4 py-2 text-left text-sm hover:bg-surface-3">{h.title || tk("ai.untitled")}</button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
              {!enabled ? (
                <Notice title={tk("ai.off.title")} body={tk("ai.off.body")} />
              ) : !canUse ? (
                <Notice title={tk("ai.noAccess.title")} body={tk("ai.noAccess.body")} />
              ) : messages.length === 0 ? (
                <div>
                  <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }} className="text-lg font-semibold tracking-tight">{tk("ai.hello")}</motion.p>
                  <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease, delay: 0.06 }} className="mt-1 text-sm text-muted">{tk("ai.intro")}</motion.p>
                  <ul className="mt-5 space-y-2">
                    {suggestions.map((s, i) => (
                      <motion.li key={s} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease, delay: 0.12 + i * 0.05 }}>
                        <button type="button" onClick={() => send(tk(`${s}.prompt`))} className="group flex w-full items-center justify-between gap-3 rounded-xl border border-border px-3.5 py-3 text-left text-sm transition-colors hover:border-text/40 hover:bg-surface-2">
                          <span>{tk(s)}</span>
                          <ArrowUp className="size-3.5 shrink-0 rotate-45 text-muted transition-transform duration-300 group-hover:rotate-90 group-hover:text-text" aria-hidden />
                        </button>
                      </motion.li>
                    ))}
                  </ul>
                  <Link href={memoryHref} onClick={() => setOpen(false)} className="mt-5 inline-block text-xs text-muted underline">{tk("ai.memoryLink")}</Link>
                </div>
              ) : (
                <ol className="space-y-4">
                  {messages.map((m) => (
                    <motion.li key={m.id} initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease }} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                      {m.role === "user" ? (
                        <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-text px-3.5 py-2 text-sm text-bg">{m.content}</p>
                      ) : (
                        <div className="max-w-[92%] text-sm">
                          {/* bodyToHtml escapes everything: only paragraphs, lists and bold are produced. */}
                          {m.content && <div className="[&_li]:ml-4 [&_li]:list-disc [&_p]:mb-2 [&_p:last-child]:mb-0" dangerouslySetInnerHTML={{ __html: bodyToHtml(m.content) }} />}
                          {m.actions.length > 0 && (
                            <ul className="mt-2 flex flex-wrap gap-1.5">
                              {m.actions.map((a, i) => (
                                <li key={i}>
                                  {a.href ? (
                                    <Link href={a.href} className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-xs font-medium transition-colors hover:border-text/40">{actionLabel(a.label, tk)} →</Link>
                                  ) : <span className="inline-flex rounded-full bg-surface-2 px-2.5 py-1 text-xs text-muted">{actionLabel(a.label, tk)}</span>}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </motion.li>
                  ))}
                  {pending && (
                    <li className="flex items-center gap-1.5 py-1" aria-label={tk("ai.thinking")}>
                      {[0, 1, 2].map((i) => (
                        <motion.span key={i} className="size-1.5 rounded-full bg-muted" animate={{ opacity: [0.25, 1, 0.25], y: [0, -3, 0] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }} />
                      ))}
                      <span className="ml-1 text-xs text-muted">{tk("ai.thinking")}</span>
                    </li>
                  )}
                </ol>
              )}
              {error && <p role="alert" className="mt-4 rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>}
            </div>

            {enabled && canUse && (
              <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="border-t border-border p-2.5">
                <div className="flex items-end gap-2 rounded-xl border border-border bg-bg px-3 py-2 focus-within:border-text/40">
                  <textarea ref={field} rows={1} value={input} maxLength={4000} placeholder={tk("ai.placeholder")} aria-label={tk("ai.placeholder")}
                    onChange={(e) => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`; }}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
                    className="max-h-40 min-h-6 flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted" />
                  <motion.button type="submit" disabled={!input.trim() || pending} aria-label={tk("ai.send")} whileTap={{ scale: 0.9 }}
                    className="flex size-8 shrink-0 items-center justify-center rounded-full bg-text text-bg transition-opacity disabled:opacity-30">
                    <ArrowUp className="size-4" aria-hidden />
                  </motion.button>
                </div>
                <p className="mt-1.5 px-1 text-[10px] text-muted">{tk("ai.disclaimer")}</p>
              </form>
            )}
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} title={label} aria-label={label} className="flex size-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-text">{children}</button>;
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border-strong p-4">
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted">{body}</p>
    </div>
  );
}

/** "products:3" → "3 products created", "campaign:Summer" → "Campaign draft: Summer"… */
function actionLabel(label: string, tk: (k: string, v?: Record<string, string | number>) => string) {
  const [kind, ...rest] = label.split(":");
  const detail = rest.join(":");
  return tk(`ai.action.${kind}`, { detail, count: detail });
}
