import { notFound } from "next/navigation";

const sections = new Set(["paste", "upgrades", "notification-channels", "villages", "groups"]);

export default async function SettingsSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!sections.has(section)) notFound();
  return null;
}
