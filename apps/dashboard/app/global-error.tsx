"use client";

import { Button, RequestState } from "@multi-coc/ui";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html>
      <body>
        <main className="shell">
          <RequestState
            tone="error"
            title="Something went wrong"
            description="The page could not be rendered."
            action={<Button onClick={reset}>Try again</Button>}
          />
        </main>
      </body>
    </html>
  );
}
