"use client";

import { useCallback } from "react";

export function useApiRequest(apiBase: string) {
  return useCallback(
    async (path: string, init: RequestInit = {}) => {
      const response = await fetch(`${apiBase}${path}`, {
        ...init,
        credentials: "include",
        headers: { "Content-Type": "application/json", ...init.headers },
      });
      const result = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      if (response.status === 401) {
        window.location.assign("/sign-in");
        throw new Error("Authentication required");
      }
      if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
      return result;
    },
    [apiBase],
  );
}
