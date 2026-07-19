import { notFound } from "next/navigation";
import { isUuid } from "../../../route-params";

export default async function VillageSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  return null;
}
