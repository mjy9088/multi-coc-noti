import { notFound } from "next/navigation";
export default async function HistorySectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (section !== "upgrades" && section !== "syncs") notFound();
  return null;
}
