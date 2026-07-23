"use client";

import {
  type OperationState,
  operationFailed,
  operationIdle,
  operationPending,
  operationSucceeded,
} from "@multi-coc/ui";
import { useCallback, useEffect, useState } from "react";

export type MutationFeedback = OperationState<string, string>;

type MutationFeedbackOptions = {
  refresh: () => Promise<void>;
  onChanged: () => void;
};

export function useMutationFeedback({ refresh, onChanged }: MutationFeedbackOptions) {
  const [feedback, setFeedback] = useState<MutationFeedback>(operationIdle);

  useEffect(() => {
    if (feedback.status !== "success") return;
    const timer = window.setTimeout(() => setFeedback(operationIdle()), 4_500);
    return () => window.clearTimeout(timer);
  }, [feedback.status]);

  const run = useCallback(
    async <Result>(action: () => Promise<Result>, success: string): Promise<Result | null> => {
      setFeedback(operationPending());
      try {
        const result = await action();
        await refresh();
        onChanged();
        setFeedback(operationSucceeded(success));
        return result;
      } catch (reason) {
        setFeedback(operationFailed((reason as Error).message));
        return null;
      }
    },
    [onChanged, refresh],
  );

  const clearFeedback = useCallback(() => setFeedback(operationIdle()), []);
  const showError = useCallback((message: string) => setFeedback(operationFailed(message)), []);

  return {
    feedback,
    mutationPending: feedback.status === "pending",
    run,
    clearFeedback,
    showError,
  };
}
