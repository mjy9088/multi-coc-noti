"use client";

import { ErrorState } from "./request-state";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main>
      <ErrorState message={error.message} retry={reset} />
    </main>
  );
}
