"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export const dashboardQueryKey = (apiBase: string) => ["dashboard", apiBase] as const;
export const historyQueryKey = (apiBase: string, filters: Record<string, string>) =>
  ["upgrade-history", apiBase, filters] as const;

export default function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            gcTime: 10 * 60_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
