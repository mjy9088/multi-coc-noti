"use client";

import { Button, StickyStackItem, StickyStackProvider } from "@multi-coc/ui";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import LocaleSwitcher from "./locale-switcher";
import PwaInstall from "./pwa-install";
import { dashboardQueryKey } from "./query-provider";
import { useDashboardFormat } from "./use-dashboard-format";

export type QuickPasteRequest = {
  id: number;
  text: string;
  clipboardError: boolean;
};

type QuickPasteContextValue = {
  request: QuickPasteRequest | null;
  consume: (id: number) => void;
};

const QuickPasteContext = createContext<QuickPasteContextValue>({ request: null, consume: () => {} });

const browserApiBase = () =>
  process.env.NEXT_PUBLIC_API_BASE === "same-origin"
    ? ""
    : process.env.NEXT_PUBLIC_API_BASE || `${window.location.protocol}//${window.location.hostname}:8787`;

export function useQuickPasteRequest(): QuickPasteContextValue {
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
      }>;
    },
    enabled: Boolean(apiBase || typeof window !== "undefined"),
    refetchInterval: 30_000,
  });
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
  const consumeQuickPaste = useCallback(
    (id: number) => setQuickPasteRequest((current) => (current?.id === id ? null : current)),
    [],
  );
  const quickPasteContext = useMemo(
    () => ({ request: quickPasteRequest, consume: consumeQuickPaste }),
    [consumeQuickPaste, quickPasteRequest],
  );

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
    <QuickPasteContext value={quickPasteContext}>
      <StickyStackProvider>
        <StickyStackItem as="header" order={0} className="app-shell-header">
          <Link className="app-brand" href="/" aria-label={t("dashboard")}>
            <div className="app-brand-mark">M</div>
            <div className="app-brand-copy">
              <strong>MULTI VILLAGE</strong>
              <span>COMMAND CENTER</span>
            </div>
          </Link>
          <nav className="app-primary-nav" aria-label="Dashboard menu">
            <Link className="app-nav-link" href="/" aria-current={view === "dashboard" ? "page" : undefined}>
              {t("dashboard")}
            </Link>
            <Link
              className="app-nav-link"
              href="/history/upgrades"
              aria-current={view === "history" ? "page" : undefined}
            >
              {t("history")}
            </Link>
            <Link
              className="app-nav-link"
              href="/settings/paste"
              aria-current={view === "settings" ? "page" : undefined}
            >
              {t("settings")}
            </Link>
            <Button className="app-quick-paste" size="small" pending={quickPasteLoading} onClick={quickPaste}>
              {quickPasteLoading ? t("quickPasteReading") : t("quickPaste")}
            </Button>
          </nav>
          <div className="app-shell-tools">
            <PwaInstall />
            <div className="app-sync-state" role="status">
              <i />
              <span className="app-sync-copy">
                {dashboardQuery.data
                  ? `${t("synced")}${clockNow ? ` ${formatRelative(dashboardQuery.data.generatedAt, clockNow)}` : ""}`
                  : t("awaiting")}
              </span>
            </div>
            <LocaleSwitcher />
          </div>
        </StickyStackItem>
        {children}
      </StickyStackProvider>
    </QuickPasteContext>
  );
}
