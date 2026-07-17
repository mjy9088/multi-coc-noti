import { notFound } from "next/navigation";
import Dashboard from "../../page";

const sections = { paste: "import", upgrades: "alerts", villages: "villages", groups: "groups" } as const;

export default async function SettingsSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!(section in sections)) notFound();
  return <Dashboard initialSettingsSection={sections[section as keyof typeof sections]} />;
}
