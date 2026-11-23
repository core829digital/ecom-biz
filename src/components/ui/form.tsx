"use client";

import { createContext, startTransition, useActionState, useContext, useEffect, useRef, useState, type ComponentProps, type FormEvent, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/cn";
import type { ActionState } from "@/lib/action";
import { buttonClass } from "./button";
import { Dialog } from "./dialog";
import { toast } from "./toast";
import { useT } from "@/components/i18n-provider";

const FormStateContext = createContext<ActionState>(null);
const FormPendingContext = createContext(false);

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * Form bound to a server action. Shows a top-level error/success banner and
 * exposes field errors to <Field>/<FieldError> through context.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  onSuccess,
  ...rest
}: {
  action: Action;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  onSuccess?: () => void;
} & Omit<ComponentProps<"form">, "action" | "children" | "onSubmit">) {
  const [state, formAction, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  const [visibleAt, setVisibleAt] = useState<number | undefined>();

  useEffect(() => {
    if (state?.at) setVisibleAt(state.at);
    if (state?.ok && state.message) toast(state.message, "success");
    if (state?.ok) {
      if (resetOnSuccess) ref.current?.reset();
      onSuccess?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.at]);

  // Submit through a transition instead of the `action` prop: React 19 resets
  // uncontrolled fields after an action-prop submission, which would wipe the
  // user's input whenever validation fails.
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pending) return;
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    const fd = new FormData(e.currentTarget, submitter);
    startTransition(() => formAction(fd));
  };

  return (
    <FormStateContext.Provider value={state}>
     <FormPendingContext.Provider value={pending}>
      <form ref={ref} onSubmit={onSubmit} className={className} {...rest}>
        {state?.error && visibleAt === state.at && (
          <div role="alert" className="mb-4 rounded-lg border border-danger/30 bg-danger-bg px-4 py-3 text-sm text-danger">
            {state.error}
          </div>
        )}
        {children}
      </form>
     </FormPendingContext.Provider>
    </FormStateContext.Provider>
  );
}

export function useFieldError(name: string) {
  return useContext(FormStateContext)?.fieldErrors?.[name];
}

export function FieldError({ name }: { name: string }) {
  const error = useFieldError(name);
  if (!error) return null;
  return <p className="mt-1 text-xs text-danger">{error}</p>;
}

export function SubmitButton({
  children,
  variant = "primary",
  className,
  pendingLabel,
  ...props
}: ComponentProps<"button"> & { variant?: "primary" | "secondary" | "danger" | "ghost" | "brand"; pendingLabel?: string }) {
  const status = useFormStatus();
  const ctxPending = useContext(FormPendingContext);
  const pending = status.pending || ctxPending;
  return (
    <button type="submit" disabled={pending || props.disabled} className={buttonClass(variant, "md", className)} {...props}>
      {pending && (
        <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
      )}
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}

/**
 * Submit button for small inline forms. With `confirmMessage`, it opens an
 * accessible confirmation dialog and submits the surrounding form on confirm.
 */
export function ConfirmSubmit({
  children,
  confirmMessage,
  confirmLabel,
  cancelLabel,
  variant = "secondary",
  className,
}: {
  children: ReactNode;
  confirmMessage?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  className?: string;
}) {
  const { pending } = useFormStatus();
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const danger = variant === "danger";
  return (
    <>
      <button
        ref={ref}
        type={confirmMessage ? "button" : "submit"}
        disabled={pending}
        className={cn(buttonClass(variant, "sm"), className)}
        onClick={confirmMessage ? () => setOpen(true) : undefined}
      >
        {pending && <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
        {children}
      </button>
      {confirmMessage && (
        <Dialog
          open={open}
          onClose={() => setOpen(false)}
          title={confirmMessage}
          size="sm"
          footer={
            <>
              <button type="button" className={buttonClass("secondary", "md")} onClick={() => setOpen(false)}>{cancelLabel ?? t("common.cancel")}</button>
              <button
                type="button"
                data-autofocus
                className={buttonClass(danger ? "danger" : "primary", "md")}
                onClick={() => {
                  setOpen(false);
                  ref.current?.form?.requestSubmit();
                }}
              >
                {confirmLabel ?? children}
              </button>
            </>
          }
        />
      )}
    </>
  );
}
