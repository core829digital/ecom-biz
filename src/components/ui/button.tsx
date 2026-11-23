import Link from "next/link";
import { cn } from "@/lib/cn";
import type { ComponentProps } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost" | "brand";
type Size = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap";
const variants: Record<Variant, string> = {
  primary: "bg-accent text-accent-contrast hover:opacity-90",
  secondary: "bg-surface text-text border border-border hover:bg-surface-2",
  danger: "bg-danger text-white hover:opacity-90",
  ghost: "text-text hover:bg-surface-2",
  brand: "bg-brand text-brand-contrast hover:opacity-90",
};
const sizes: Record<Size, string> = { sm: "h-8 px-3 text-sm", md: "h-10 px-4 text-sm" };

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}
