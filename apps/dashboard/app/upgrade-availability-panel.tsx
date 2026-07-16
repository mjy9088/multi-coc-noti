import type { BuilderAvailability, LaboratoryAvailability } from "@multi-coc/upgrade-availability";
import { useI18n } from "./i18n";

type UpgradeSlots = {
  laboratory: LaboratoryAvailability | null;
  petHouse: { available: boolean } | null;
  builderBase: { builders: BuilderAvailability; laboratory: LaboratoryAvailability | null } | null;
};

function builderStatus(free: number, total: number, isKorean: boolean, t: ReturnType<typeof useI18n>["messages"], regularTotal = total) {
  const active = Math.max(0, total - free);
  const status = isKorean ? `${active}/${total} 작업 중 · ${free}명 대기` : `${active}/${total} working · ${free} available`;
  if (total <= regularTotal) return status;
  return `${status} · ${active > regularTotal ? t.goblinBuilderActive : t.goblinBuilderReady}`;
}

function laboratoryStatus(slot: LaboratoryAvailability, t: ReturnType<typeof useI18n>["messages"]) {
  const active = slot.active || 0;
  const total = Math.max(1, slot.total || 1);
  if (!active) return slot.available ? t.available : t.busy;
  return `${active}/${total} ${t.researching}${active < total ? ` · ${t.goblinResearcherReady}` : active > 1 ? ` · ${t.goblinResearcher}` : ""}`;
}

// Dashboard cards and Paste game JSON previews intentionally share this component.
// Keep availability wording, counts, and slot layout here so both surfaces change together.
export default function UpgradeAvailabilityPanel({ builders, upgradeSlots }: { builders: BuilderAvailability; upgradeSlots?: UpgradeSlots }) {
  const { isKorean, messages: t } = useI18n();
  const regularBuilders = builders.regularTotal ?? builders.total;
  const builderText = builderStatus(builders.free, builders.total, isKorean, t, regularBuilders);
  return <div className="upgrade-availability"><div className="availability-heading"><div className="hammer">◆</div><strong>{t.availabilityTitle}</strong></div><div className="upgrade-slots">
    <div className={builders.free > 0 ? "ready builder-slot" : "builder-slot"}><span>{t.availabilityBuilder}</span><strong>{builderText}</strong><div className="builder-dots" aria-label={builderText}>{Array.from({ length: builders.total }, (_, i) => <i className={i < builders.total - builders.free ? "busy" : ""} key={i} />)}</div></div>
    {upgradeSlots?.laboratory && <div className={upgradeSlots.laboratory.available ? "ready" : ""}><span>{t.availabilityResearch}</span><strong>{laboratoryStatus(upgradeSlots.laboratory, t)}</strong></div>}
    {upgradeSlots?.petHouse && <div className={upgradeSlots.petHouse.available ? "ready" : ""}><span>{t.availabilityPet}</span><strong>{upgradeSlots.petHouse.available ? t.available : t.busy}</strong></div>}
    {upgradeSlots?.builderBase && <div className={upgradeSlots.builderBase.builders.free > 0 ? "ready" : ""}><span>{t.availabilityBuilderBaseBuilder}</span><strong>{builderStatus(upgradeSlots.builderBase.builders.free, upgradeSlots.builderBase.builders.total, isKorean, t)}</strong></div>}
    {upgradeSlots?.builderBase?.laboratory && <div className={upgradeSlots.builderBase.laboratory.available ? "ready" : ""}><span>{t.availabilityBuilderBaseLab}</span><strong>{laboratoryStatus(upgradeSlots.builderBase.laboratory, t)}</strong></div>}
  </div></div>;
}
