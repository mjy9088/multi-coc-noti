"use client";

import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogTitle,
  NavLink,
  RequestState,
  StickyStackItem,
  StickyStackProvider,
} from "@multi-coc/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import LocaleSwitcher from "./locale-switcher";
import PwaInstall from "./pwa-install";
import { dashboardQueryKey } from "./query-provider";
import SettingsPanel from "./settings-panel";
import { useDashboardFormat } from "./use-dashboard-format";

type QuickPasteRequest = {
  id: number;
  text: string;
  clipboardError: boolean;
};

const browserApiBase = () =>
  process.env.NEXT_PUBLIC_API_BASE === "same-origin"
    ? ""
    : process.env.NEXT_PUBLIC_API_BASE || `${window.location.protocol}//${window.location.hostname}:8787`;

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const t = useTranslations("Dashboard");
  const settingsT = useTranslations("Settings");
  const { formatRelative } = useDashboardFormat();
  const [clockNow, setClockNow] = useState(0);
  const [quickPasteRequest, setQuickPasteRequest] = useState<QuickPasteRequest | null>(null);
  const [quickPasteLoading, setQuickPasteLoading] = useState(false);
  const [quickPasteOpen, setQuickPasteOpen] = useState(false);
  const [quickPasteMutationPending, setQuickPasteMutationPending] = useState(false);
  const quickPasteSequence = useRef(0);
  const apiBase = typeof window === "undefined" ? "" : browserApiBase();
  const dashboardQuery = useQuery({
    queryKey: dashboardQueryKey(apiBase),
    queryFn: async () => {
      const response = await fetch(`${apiBase}/api/dashboard`, { cache: "no-store", credentials: "include" });
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
  const quickPaste = async () => {
    const id = ++quickPasteSequence.current;
    setQuickPasteOpen(true);
    setQuickPasteRequest(null);
    setQuickPasteLoading(true);
    let text = "";
    let clipboardError = false;
    try {
      text = await navigator.clipboard.readText();
      if (!text.trim()) throw new Error("empty clipboard");
    } catch {
      clipboardError = true;
    }
    if (id !== quickPasteSequence.current) return;
    setQuickPasteRequest({ id, text, clipboardError });
    setQuickPasteLoading(false);
  };

  return (
    <>
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
            <NavLink asChild active={view === "dashboard"} className="app-nav-link">
              <Link href="/">{t("dashboard")}</Link>
            </NavLink>
            <NavLink asChild active={view === "history"} className="app-nav-link">
              <Link href="/history/upgrades">{t("history")}</Link>
            </NavLink>
            <NavLink asChild active={view === "settings"} className="app-nav-link">
              <Link href="/settings/paste">{t("settings")}</Link>
            </NavLink>
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
            <Button size="small" tone="secondary" onClick={() => void signOut({ callbackUrl: "/sign-in" })}>
              {t("signOut")}
            </Button>
          </div>
        </StickyStackItem>
        {children}
      </StickyStackProvider>
      <Dialog
        open={quickPasteOpen}
        onOpenChange={(open) => {
          if (!open && quickPasteMutationPending) return;
          setQuickPasteOpen(open);
          if (!open) {
            quickPasteSequence.current += 1;
            setQuickPasteLoading(false);
            setQuickPasteRequest(null);
          }
        }}
      >
        <DialogContent
          className="quick-paste-dialog"
          closeLabel={settingsT("cancel")}
          onEscapeKeyDown={(event) => quickPasteMutationPending && event.preventDefault()}
          onPointerDownOutside={(event) => quickPasteMutationPending && event.preventDefault()}
        >
          <DialogTitle>{t("quickPaste")}</DialogTitle>
          <DialogDescription>{settingsT("pasteJsonHelp")}</DialogDescription>
          <DialogBody className="quick-paste-dialog-body">
            {quickPasteLoading && <RequestState title={t("quickPasteReading")} />}
            <SettingsPanel
              apiBase={apiBase}
              embedded
              quickPasteRequest={quickPasteRequest}
              onQuickPasteApplied={(id) => setQuickPasteRequest((current) => (current?.id === id ? null : current))}
              onChanged={() => {
                void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
                void queryClient.invalidateQueries({ queryKey: ["upgrade-history"] });
                void queryClient.invalidateQueries({ queryKey: ["sync-history"] });
              }}
              onImportComplete={() => setQuickPasteOpen(false)}
              onImportPendingChange={setQuickPasteMutationPending}
            />
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  );
}
