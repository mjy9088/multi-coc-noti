"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../lib/cn";

export type ToastIntent = "success" | "error" | "warning" | "information";
export type ToastInput = {
  id?: string;
  intent?: ToastIntent;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  duration?: number | null;
};
type ToastItem = ToastInput & { id: string; intent: ToastIntent };
type ToastContextValue = { toast: (input: ToastInput) => string; dismiss: (id: string) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<string, number>());
  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);
  useEffect(
    () => () => {
      for (const timer of timers.current.values()) window.clearTimeout(timer);
      timers.current.clear();
    },
    [],
  );
  const toast = useCallback(
    (input: ToastInput) => {
      const id = input.id || `toast-${++nextId.current}`;
      const item: ToastItem = { ...input, id, intent: input.intent || "information" };
      setItems((current) => [...current.filter((entry) => entry.id !== id), item]);
      const previousTimer = timers.current.get(id);
      if (previousTimer) window.clearTimeout(previousTimer);
      const duration = input.duration === undefined ? (item.intent === "error" ? null : 5000) : input.duration;
      if (duration !== null && duration > 0)
        timers.current.set(
          id,
          window.setTimeout(() => dismiss(id), duration),
        );
      else timers.current.delete(id);
      return id;
    },
    [dismiss],
  );
  const value = useMemo(() => ({ toast, dismiss }), [dismiss, toast]);
  return (
    <ToastContext value={value}>
      {children}
      <ToastViewport items={items} dismiss={dismiss} />
    </ToastContext>
  );
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast must be used inside ToastProvider");
  return value;
}

function ToastViewport({ items, dismiss }: { items: ToastItem[]; dismiss: (id: string) => void }) {
  return (
    <div className="ui-toast-viewport" aria-label="Notifications">
      {items.map((item) => (
        <div
          key={item.id}
          className={cn("ui-toast", `ui-toast-${item.intent}`)}
          role={item.intent === "error" ? "alert" : "status"}
        >
          <div>
            <strong>{item.title}</strong>
            {item.description && <p>{item.description}</p>}
          </div>
          {item.action && (
            <button type="button" onClick={item.action.onClick}>
              {item.action.label}
            </button>
          )}
          <button
            type="button"
            className="ui-toast-dismiss"
            aria-label="Dismiss notification"
            onClick={() => dismiss(item.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
