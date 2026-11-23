export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-center text-3xl font-semibold tracking-tight">{title}</h1>
      {subtitle && <p className="mt-2 text-center text-muted">{subtitle}</p>}
      <div className="mt-8">{children}</div>
    </div>
  );
}
