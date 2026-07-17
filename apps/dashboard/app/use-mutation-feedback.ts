"use client";

import { useCallback, useState } from "react";

type MutationFeedbackOptions = {
  refresh: () => Promise<void>;
  onChanged: () => void;
  setError: (message: string) => void;
  setMessage: (message: string) => void;
};

export function useMutationFeedback({ refresh, onChanged, setError, setMessage }: MutationFeedbackOptions) {
  const [pending, setPending] = useState(false);

  const run = useCallback(
    async <Result>(action: () => Promise<Result>, success: string): Promise<Result | null> => {
      setPending(true);
      try {
        setError("");
        setMessage("");
        const result = await action();
        setMessage(success);
        await refresh();
        onChanged();
        return result;
      } catch (reason) {
        setMessage("");
        setError((reason as Error).message);
        return null;
      } finally {
        setPending(false);
      }
    },
    [onChanged, refresh, setError, setMessage],
  );

  return { mutationPending: pending, run };
}
