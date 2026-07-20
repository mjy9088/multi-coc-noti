"use client";

import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import SettingsPanel from "../settings-panel";

type SettingsSection = "import" | "upgrades" | "channels" | "villages" | "groups";

const sectionByPath = {
  paste: "import",
  upgrades: "upgrades",
  "notification-channels": "channels",
  villages: "villages",
  groups: "groups",
} as const;

const pathBySection: Record<SettingsSection, string> = {
  import: "/settings/paste",
  upgrades: "/settings/upgrades",
  channels: "/settings/notification-channels",
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
  const segments = pathname.split("/").filter(Boolean);
  const section = sectionByPath[segments[1] as keyof typeof sectionByPath] || "import";
  const villageId = segments[1] === "villages" && segments[2] ? decodeURIComponent(segments[2]) : null;
  const apiBase = typeof window === "undefined" ? "" : browserApiBase();

  return (
    <main>
      <SettingsPanel
        apiBase={apiBase}
        onChanged={() => {
          void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
          void queryClient.invalidateQueries({ queryKey: ["upgrade-history"] });
          void queryClient.invalidateQueries({ queryKey: ["sync-history"] });
        }}
        onSectionChange={(next) => router.push(pathBySection[next], { scroll: false })}
        onVillageChange={(accountId) =>
          router.push(`/settings/villages/${encodeURIComponent(accountId)}`, { scroll: false })
        }
        initialSection={section}
        initialAccountId={villageId}
      />
    </main>
  );
}
