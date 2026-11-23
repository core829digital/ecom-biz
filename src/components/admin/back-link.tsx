import Link from "next/link";

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="mb-1 inline-block text-sm text-muted hover:text-text">
      ← {label}
    </Link>
  );
}
