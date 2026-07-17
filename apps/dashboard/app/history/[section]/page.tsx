import { notFound } from "next/navigation";
import Dashboard from "../../page";

export default async function HistorySectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<{ village?: string }>;
}) {
  const [{ section }, { village = "" }] = await Promise.all([params, searchParams]);
  if (section !== "upgrades" && section !== "syncs") notFound();
  return (
    <Dashboard initialHistorySection={section} initialHistoryVillageId={section === "upgrades" ? village : undefined} />
  );
}
