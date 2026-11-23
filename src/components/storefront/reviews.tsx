"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { Star } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { ReviewState } from "@/app/(store)/sites/[site]/products/[handle]/actions";

export function ReviewForm({ action, labels, defaults }: {
  action: (s: ReviewState, fd: FormData) => Promise<ReviewState>;
  labels: Record<"write" | "name" | "email" | "title" | "body" | "submit" | "rating" | "emailHint", string>;
  /** Prefilled for signed-in customers. */
  defaults?: { name: string; email: string };
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const field = "h-11 w-full rounded-lg border border-border bg-bg px-3 text-sm outline-none focus:border-text";
  // Submit through a transition, not the form `action` prop: React resets uncontrolled
  // fields after an action-prop submission, which would wipe the review on a server error.
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pending) return;
    const fd = new FormData(e.currentTarget);
    startTransition(() => formAction(fd));
  };
  if (state?.ok) return <p role="status" className="rounded-xl bg-surface-2 p-4 text-sm">{state.message}</p>;
  return (
    <div>
      {!open && <button type="button" onClick={() => setOpen(true)} className="h-11 rounded-full border border-text px-6 text-sm font-medium transition-colors hover:bg-text hover:text-bg">{labels.write}</button>}
      <AnimatePresence>
        {open && (
          <motion.form onSubmit={onSubmit} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-3 overflow-hidden">
            <fieldset>
              <legend className="mb-1 text-sm font-medium">{labels.rating}</legend>
              <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <label key={n} className="cursor-pointer" onMouseEnter={() => setHover(n)}>
                    <input type="radio" name="rating" value={n} className="sr-only" checked={rating === n} onChange={() => setRating(n)} required />
                    <motion.span whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }} className="block">
                      <Star className={`size-7 ${n <= (hover || rating) ? "fill-amber-400 text-amber-400" : "text-border-strong"}`} aria-hidden />
                    </motion.span>
                    <span className="sr-only">{n}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-3 sm:grid-cols-2">
              <input name="name" required maxLength={60} placeholder={labels.name} aria-label={labels.name} defaultValue={defaults?.name} autoComplete="name" className={field} />
              <input name="email" type="email" required placeholder={labels.email} aria-label={labels.email} defaultValue={defaults?.email} autoComplete="email" className={field} />
            </div>
            <p className="text-xs text-muted">{labels.emailHint}</p>
            <input name="title" maxLength={120} placeholder={labels.title} aria-label={labels.title} className={field} />
            <textarea name="body" required minLength={10} maxLength={4000} rows={4} placeholder={labels.body} aria-label={labels.body} className="w-full rounded-lg border border-border bg-bg p-3 text-sm outline-none focus:border-text" />
            {state?.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
            <button type="submit" disabled={pending || !rating} className="inline-flex h-11 items-center gap-2 rounded-full bg-brand px-6 text-sm font-medium text-brand-contrast transition-opacity disabled:opacity-50">
              {pending && <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
              {labels.submit}
            </button>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
