"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html>
      <body>
        <main className="request-state shell error" role="alert">
          <span aria-hidden="true">!</span>
          <h1>Something went wrong</h1>
          <p>The page could not be rendered.</p>
          <button type="button" onClick={reset}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
