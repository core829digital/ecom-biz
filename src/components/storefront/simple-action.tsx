"use client";

import { startTransition, useActionState, type FormEvent, type ReactNode } from "react";

type State = { ok?: boolean; message?: string; error?: string; at?: number } | null;

/**
 * Small storefront form bound to a server action: shows the result inline, keeps typed values on
 * errors (submits through a transition), and replaces itself with the success message.
 */
export function SimpleActionForm({ action, children, submitLabel, className, buttonClassName }: {
  action: (s: State, fd: FormData) => Promise<State>;
  children?: ReactNode;
  submitLabel: string;
  className?: string;
  buttonClassName?: string;
}) {
  const [state, run, pending] = useActionState(action, null);
  if (state?.ok) return <p role="status" className="text-sm">{state.message}</p>;
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pending) return;
    const fd = new FormData(e.currentTarget);
    startTransition(() => run(fd));
  };
  return (
    <form onSubmit={onSubmit} className={className}>
      {children}
      <button type="submit" disabled={pending} className={buttonClassName ?? "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-brand px-6 text-sm font-medium text-brand-contrast disabled:opacity-60"}>
        {pending && <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
        {submitLabel}
      </button>
      {state?.error && <p role="alert" className="basis-full text-sm text-danger">{state.error}</p>}
    </form>
  );
}
