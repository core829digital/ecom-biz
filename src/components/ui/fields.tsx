"use client";

import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useFieldError } from "./form";

export const inputClass =
  "block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-muted/70 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 disabled:opacity-60";

function FieldShell({
  id,
  label,
  hint,
  name,
  children,
  className,
}: {
  id: string;
  label?: ReactNode;
  hint?: ReactNode;
  name?: string;
  children: ReactNode;
  className?: string;
}) {
  const error = useFieldError(name ?? "");
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="mb-1 block text-sm font-medium text-text">
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

type Common = { label?: ReactNode; hint?: ReactNode; wrapperClassName?: string };

export function Input({ label, hint, wrapperClassName, className, id, name, ...props }: ComponentProps<"input"> & Common) {
  const auto = useId();
  const fid = id ?? auto;
  const error = useFieldError(name ?? "");
  return (
    <FieldShell id={fid} label={label} hint={hint} name={name} className={wrapperClassName}>
      <input
        id={fid}
        name={name}
        aria-invalid={!!error || undefined}
        aria-describedby={error ? `${fid}-error` : undefined}
        className={cn(inputClass, error && "border-danger", className)}
        {...props}
      />
    </FieldShell>
  );
}

export function Textarea({ label, hint, wrapperClassName, className, id, name, ...props }: ComponentProps<"textarea"> & Common) {
  const auto = useId();
  const fid = id ?? auto;
  const error = useFieldError(name ?? "");
  return (
    <FieldShell id={fid} label={label} hint={hint} name={name} className={wrapperClassName}>
      <textarea id={fid} name={name} rows={4} className={cn(inputClass, error && "border-danger", className)} {...props} />
    </FieldShell>
  );
}

export function Select({
  label,
  hint,
  wrapperClassName,
  className,
  id,
  name,
  children,
  ...props
}: ComponentProps<"select"> & Common) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <FieldShell id={fid} label={label} hint={hint} name={name} className={wrapperClassName}>
      <select id={fid} name={name} className={cn(inputClass, "pr-8", className)} {...props}>
        {children}
      </select>
    </FieldShell>
  );
}

export function Checkbox({ label, hint, className, id, ...props }: ComponentProps<"input"> & { label: ReactNode; hint?: ReactNode }) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <div className={cn("flex items-start gap-2", className)}>
      <input id={fid} type="checkbox" className="mt-0.5 size-4 rounded border-border accent-[var(--accent)]" {...props} />
      <div>
        <label htmlFor={fid} className="text-sm text-text">{label}</label>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
    </div>
  );
}
