import { redirect } from "next/navigation";

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ village?: string }> }) {
  const { village = "" } = await searchParams;
  redirect(`/history/upgrades${village ? `?village=${encodeURIComponent(village)}` : ""}`);
}
