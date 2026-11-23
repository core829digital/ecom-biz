"use client";

/** Last-resort boundary when a root layout itself fails: plain HTML, no dependencies. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0, color: "#18181b", background: "#fafafa" }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 20, margin: 0 }}>Something went wrong · Si è verificato un errore</h1>
          {error.digest && <p style={{ fontFamily: "monospace", fontSize: 12, color: "#71717a" }}>ref: {error.digest}</p>}
          <button onClick={reset} style={{ marginTop: 16, height: 40, padding: "0 16px", borderRadius: 8, border: 0, background: "#18181b", color: "#fff", cursor: "pointer" }}>
            Try again · Riprova
          </button>
        </div>
      </body>
    </html>
  );
}
