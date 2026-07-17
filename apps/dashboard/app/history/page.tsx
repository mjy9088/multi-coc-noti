import Dashboard from "../page";

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ village?: string }> }) {
  const { village = "" } = await searchParams;
  return <Dashboard initialHistoryVillageId={village} />;
}
