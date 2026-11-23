/** Skeleton shown while a store admin page loads (streamed by the App Router). */
export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-6">
      <div className="skeleton h-7 w-48" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <div key={i} className="skeleton h-24" />)}
      </div>
      <div className="skeleton h-72" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
