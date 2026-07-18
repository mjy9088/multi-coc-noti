"use client";

import { ToastProvider as UiToastProvider } from "@multi-coc/ui";
import type { ReactNode } from "react";

export default function ToastProvider({ children }: { children: ReactNode }) {
  return <UiToastProvider>{children}</UiToastProvider>;
}
