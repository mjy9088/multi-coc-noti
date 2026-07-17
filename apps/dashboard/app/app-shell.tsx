"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createContext, useContext, useEffect, useState } from "react";
import LocaleSwitcher from "./locale-switcher";
import PwaInstall from "./pwa-install";
import { dashboardQueryKey } from "./query-provider";
import { useDashboardFormat } from "./use-dashboard-format";

export type QuickPasteRequest = {
  id: number;
  text: string;
  clipboardError: boolean;
};

const QuickPasteContext = createContext<QuickPasteRequest | null>(null);

const browserApiBase = () =>
  process.env.NEXT_PUBLIC_API_BASE === "same-origin"
    ? ""
    : process.env.NEXT_PUBLIC_API_BASE || `${window.location.protocol}//${window.location.hostname}:8787`;

export function useQuickPasteRequest(): QuickPasteRequest | null {
  return useContext(QuickPasteContext);
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("Dashboard");
  const { formatRelative } = useDashboardFormat();
  const [clockNow, setClockNow] = useState(0);
  const [quickPasteRequest, setQuickPasteRequest] = useState<QuickPasteRequest | null>(null);
  const [quickPasteLoading, setQuickPasteLoading] = useState(false);
  const apiBase = typeof window === "undefined" ? "" : browserApiBase();
  const dashboardQuery = useQuery({
    queryKey: dashboardQueryKey(apiBase),
    queryFn: async () => {
      const response = await fetch(`${apiBase}/api/dashboard`, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json() as Promise<{
        generatedAt: string;
        accounts: Array<{ dataSource?: string }>;
      }>;
    },
    enabled: Boolean(apiBase || typeof window !== "undefined"),
    refetchInterval: 30_000,
  });
  const includesExample = dashboardQuery.data?.accounts.some((account) => account.dataSource === "example") ?? false;
  useEffect(() => {
    const initialClock = window.setTimeout(() => setClockNow(Date.now()), 0);
    const clock = window.setInterval(() => setClockNow(Date.now()), 60_000);
    return () => {
      window.clearTimeout(initialClock);
      window.clearInterval(clock);
    };
  }, []);
  const view = pathname.startsWith("/settings")
    ? "settings"
    : pathname.startsWith("/history")
      ? "history"
      : "dashboard";

  const quickPaste = async () => {
    setQuickPasteLoading(true);
    let text = "";
    let clipboardError = false;
    try {
      text = await navigator.clipboard.readText();
      if (!text.trim()) throw new Error("empty clipboard");
    } catch {
      clipboardError = true;
    }
    setQuickPasteRequest((current) => ({ id: (current?.id || 0) + 1, text, clipboardError }));
    router.push("/settings/paste");
    setQuickPasteLoading(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <QuickPasteContext value={quickPasteRequest}>
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">M</div>
          <div>
            <strong>MULTI VILLAGE</strong>
            <span>COMMAND CENTER</span>
          </div>
        </div>
        <nav aria-label="Dashboard menu">
          <button className={view === "dashboard" ? "nav-active" : ""} onClick={() => router.push("/")}>
            {t("dashboard")}
          </button>
          <button className={view === "history" ? "nav-active" : ""} onClick={() => router.push("/history/upgrades")}>
            {t("history")}
          </button>
          <button className={view === "settings" ? "nav-active" : ""} onClick={() => router.push("/settings/paste")}>
            {t("settings")}
          </button>
          <button className="quick-paste-nav" disabled={quickPasteLoading} onClick={quickPaste}>
            {quickPasteLoading ? t("quickPasteReading") : t("quickPaste")}
          </button>
        </nav>
        <PwaInstall />
        <div className="sync">
          <i className={includesExample ? "warn" : ""} />
          {includesExample
            ? t("exampleIncluded")
            : dashboardQuery.data
              ? `${t("synced")}${clockNow ? ` ${formatRelative(dashboardQuery.data.generatedAt, clockNow)}` : ""}`
              : t("awaiting")}
          <LocaleSwitcher />
        </div>
      </header>
      {children}
    </QuickPasteContext>
  );
}
