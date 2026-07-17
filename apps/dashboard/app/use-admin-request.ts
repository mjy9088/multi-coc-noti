"use client";

import { useCallback } from "react";

export function useAdminRequest(
  apiBase: string,
  token: string,
  invalidTokenMessage: string,
  onUnauthorized: () => void,
) {
  return useCallback(
    async (path: string, init: RequestInit = {}) => {
      const response = await fetch(`${apiBase}${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
      });
      const result = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      if (response.status === 401) {
        onUnauthorized();
        throw new Error(invalidTokenMessage);
      }
      if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
      return result;
    },
    [apiBase, invalidTokenMessage, onUnauthorized, token],
  );
}
