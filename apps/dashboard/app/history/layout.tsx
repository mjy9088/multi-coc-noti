import type { ReactNode } from "react";
import HistoryShell from "./history-shell";

export default function HistoryLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <HistoryShell />
      {children}
    </>
  );
}
