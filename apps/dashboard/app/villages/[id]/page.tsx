import { notFound } from "next/navigation";
import Dashboard from "../../page";
import { isUuid } from "../../route-params";

export default async function VillagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  return <Dashboard initialVillageId={id} />;
}
