"use client";

import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import AdminPanel from "../admin-panel";
import { useQuickPasteRequest } from "../app-shell";

type SettingsSection = "import" | "alerts" | "villages" | "groups";

const sectionByPath = {
  paste: "import",
  upgrades: "alerts",
  villages: "villages",
  groups: "groups",
} as const;

const pathBySection: Record<SettingsSection, string> = {
  import: "/settings/paste",
  alerts: "/settings/upgrades",
  villages: "/settings/villages",
  groups: "/settings/groups",
};

const browserApiBase = () =>
  process.env.NEXT_PUBLIC_API_BASE === "same-origin"
    ? ""
    : process.env.NEXT_PUBLIC_API_BASE || `${window.location.protocol}//${window.location.hostname}:8787`;

export default function SettingsShell() {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const quickPaste = useQuickPasteRequest();
  const segments = pathname.split("/").filter(Boolean);
  const section = sectionByPath[segments[1] as keyof typeof sectionByPath] || "import";
  const villageId = segments[1] === "villages" && segments[2] ? decodeURIComponent(segments[2]) : null;
  const apiBase = typeof window === "undefined" ? "" : browserApiBase();

  return (
    <main>
      <AdminPanel
        apiBase={apiBase}
        onChanged={() => {
          void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
          void queryClient.invalidateQueries({ queryKey: ["upgrade-history"] });
        }}
        onSectionChange={(next) => router.push(pathBySection[next], { scroll: false })}
        onVillageChange={(accountId) =>
          router.push(`/settings/villages/${encodeURIComponent(accountId)}`, { scroll: false })
        }
        initialSection={section}
        initialAccountId={villageId}
        quickPasteRequest={quickPaste.request}
        onQuickPasteApplied={quickPaste.consume}
      />
    </main>
  );
}
