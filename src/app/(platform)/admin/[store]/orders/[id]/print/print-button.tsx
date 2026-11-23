"use client";

export function PrintButton({ label }: { label: string }) {
  return <button onClick={() => window.print()} className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white">{label}</button>;
}
