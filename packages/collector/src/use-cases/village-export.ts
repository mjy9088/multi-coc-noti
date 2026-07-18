import { createAccount, latestVillageExport, saveVillageExport } from "@multi-coc/database";
import type { Account, ResourceStatus } from "@multi-coc/shared";
import { normalizeAccountTags } from "@multi-coc/shared";
import { compareVillageExports, normalizePlayerTag, parseVillageExport } from "@multi-coc/village-export";
import type { CollectorState } from "../services/collector-state.ts";

export type VillageExportInput = Record<string, unknown>;

export function accountInput(value: VillageExportInput, existing: Account | null): Omit<Account, "id" | "legacyIndex"> {
  const label = String(value.label || "").trim();
  if (!label) throw new Error("label is required");
  const playerTag = normalizePlayerTag(value.playerTag || existing?.playerTag);
  const resourceStatus =
    value.resourceStatus == null ? existing?.resourceStatus || "unanswered" : String(value.resourceStatus);
  if (!["abundant", "sufficient", "insufficient", "unanswered"].includes(resourceStatus))
    throw new Error("invalid resource status");
  const preparationValue =
    value.resourcePreparationMinutes === undefined
      ? (existing?.resourcePreparationMinutes ?? 60)
      : value.resourcePreparationMinutes;
  const resourcePreparationMinutes = preparationValue === null ? null : Number(preparationValue);
  if (
    resourcePreparationMinutes != null &&
    (!Number.isInteger(resourcePreparationMinutes) ||
      resourcePreparationMinutes < 1 ||
      resourcePreparationMinutes > 525_600)
  )
    throw new Error("resource preparation time must be whole minutes from 1 to 525600, or disabled");
  return {
    label,
    playerTag,
    color: String(value.color || existing?.color || "#4c9a79"),
    tags: normalizeAccountTags(value.tags, existing?.tags),
    resourceStatus: resourceStatus as ResourceStatus,
    resourceStatusUpdatedAt: existing?.resourceStatusUpdatedAt || new Date().toISOString(),
    resourcePreparationMinutes,
  };
}

export async function previewVillageExport(state: CollectorState, value: VillageExportInput) {
  const parsed = parseVillageExport(value.export ?? value.exportText ?? value);
  const account = state.accounts.find((item) => item.playerTag === parsed.tag);
  const previous = account ? await latestVillageExport(account.id) : null;
  const previousParsed = previous ? parseVillageExport(previous.raw, { allowHistorical: true }) : null;
  return {
    parsed,
    preview: {
      tag: parsed.tag,
      exportedAt: parsed.exportedAt,
      townHall: parsed.townHall,
      builders: parsed.builders,
      upgradeSlots: parsed.upgradeSlots,
      upgrades: parsed.upgrades.map(({ id, name, type, base, level, nextLevel, finishAt }) => ({
        id,
        name,
        type,
        base,
        level,
        nextLevel,
        finishAt,
      })),
      unknownDataIds: parsed.unknownDataIds,
      account: account ? { id: account.id, label: account.label, color: account.color } : null,
      isNew: !account,
      changes: compareVillageExports(previousParsed, parsed),
    },
  };
}

export async function importVillageExport(state: CollectorState, value: VillageExportInput) {
  const { parsed } = await previewVillageExport(state, value);
  let account = state.accounts.find((item) => item.playerTag === parsed.tag);
  let created = false;
  if (!account) {
    const label = String(value.label || "").trim();
    if (!label) throw new Error(`label is required to add new village ${parsed.tag}`);
    account = await createAccount(accountInput({ label, playerTag: parsed.tag }, null));
    created = true;
    await state.refreshAccounts();
  }
  if (!account) throw new Error("failed to create village account");
  await saveVillageExport(account.id, parsed, { resourceStatus: "unanswered" });
  await state.refreshAccounts();
  return {
    account: { id: account.id, label: account.label },
    created,
    exportedAt: parsed.exportedAt,
    upgrades: parsed.upgrades.length,
    builders: parsed.builders,
    unknownDataIds: parsed.unknownDataIds,
  };
}
