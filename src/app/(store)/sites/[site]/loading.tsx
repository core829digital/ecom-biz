/**
 * Shown while a storefront page streams in after a client-side navigation:
 * a thin progress bar in the brand color, so a tap never feels ignored.
 */
export default function Loading() {
  return (
    <div role="progressbar" aria-busy="true" aria-label="Loading" className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden">
      <div className="sf-progress h-full w-1/3 bg-brand" />
    </div>
  );
}
