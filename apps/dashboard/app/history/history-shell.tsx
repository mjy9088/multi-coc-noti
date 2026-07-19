"use client";

import { usePathname, useSearchParams } from "next/navigation";
import HistoryNav from "../history-nav";
import HistoryPanel from "../history-panel";
import SyncHistoryPanel from "../sync-history-panel";

const browserApiBase = () =>
  process.env.NEXT_PUBLIC_API_BASE === "same-origin"
    ? ""
    : process.env.NEXT_PUBLIC_API_BASE || `${window.location.protocol}//${window.location.hostname}:8787`;

export default function HistoryShell() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const section = pathname.endsWith("/syncs") ? "syncs" : "upgrades";
  const apiBase = typeof window === "undefined" ? "" : browserApiBase();

  return (
    <main>
      <section className="history-shell">
        <HistoryNav section={section} />
        {section === "upgrades" ? (
          <HistoryPanel apiBase={apiBase} initialVillageId={searchParams.get("village") || ""} />
        ) : (
          <SyncHistoryPanel apiBase={apiBase} />
        )}
      </section>
    </main>
  );
}
