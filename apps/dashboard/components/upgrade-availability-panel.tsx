import type { BuilderAvailability, LaboratoryAvailability } from "@multi-coc/upgrade-availability";
import { useTranslations } from "next-intl";

type UpgradeSlots = {
  laboratory: LaboratoryAvailability | null;
  petHouse: { available: boolean } | null;
  builderBase: { builders: BuilderAvailability; laboratory: LaboratoryAvailability | null } | null;
};

// Dashboard cards and Paste game JSON previews intentionally share this component.
// Keep availability wording, counts, and slot layout here so both surfaces change together.
export default function UpgradeAvailabilityPanel({
  builders,
  upgradeSlots,
}: {
  builders: BuilderAvailability;
  upgradeSlots?: UpgradeSlots;
}) {
  const t = useTranslations("Availability");
  const builderStatus = (free: number, total: number, regularTotal = total) => {
    const active = Math.max(0, total - free);
    const status = t("builderStatus", { active, total, free });
    if (total <= regularTotal) return status;
    return `${status} · ${active > regularTotal ? t("goblinBuilderActive") : t("goblinBuilderReady")}`;
  };
  const laboratoryStatus = (slot: LaboratoryAvailability) => {
    const active = slot.active || 0;
    const total = Math.max(1, slot.total || 1);
    if (!active) return slot.available ? t("available") : t("busy");
    const status = t("laboratoryStatus", { active, total, researching: t("researching") });
    return `${status}${active < total ? ` · ${t("goblinResearcherReady")}` : active > 1 ? ` · ${t("goblinResearcher")}` : ""}`;
  };
  const regularBuilders = builders.regularTotal ?? builders.total;
  const builderText = builderStatus(builders.free, builders.total, regularBuilders);
  return (
    <div className="upgrade-availability">
      <div className="availability-heading">
        <div className="hammer">◆</div>
        <strong>{t("title")}</strong>
      </div>
      <div className="upgrade-slots">
        <div className={builders.free > 0 ? "ready builder-slot" : "builder-slot"}>
          <span>{t("builder")}</span>
          <strong>{builderText}</strong>
          <div className="builder-dots" aria-label={builderText}>
            {Array.from({ length: builders.total }, (_, i) => (
              // These are stateless, position-based visual dots.
              // biome-ignore lint/suspicious/noArrayIndexKey: builder positions have no independent identity.
              <i className={i < builders.total - builders.free ? "busy" : ""} key={i} />
            ))}
          </div>
        </div>
        {upgradeSlots?.laboratory && (
          <div className={upgradeSlots.laboratory.available ? "ready" : ""}>
            <span>{t("research")}</span>
            <strong>{laboratoryStatus(upgradeSlots.laboratory)}</strong>
          </div>
        )}
        {upgradeSlots?.petHouse && (
          <div className={upgradeSlots.petHouse.available ? "ready" : ""}>
            <span>{t("pet")}</span>
            <strong>{upgradeSlots.petHouse.available ? t("available") : t("busy")}</strong>
          </div>
        )}
        {upgradeSlots?.builderBase && (
          <div className={upgradeSlots.builderBase.builders.free > 0 ? "ready" : ""}>
            <span>{t("builderBaseBuilder")}</span>
            <strong>
              {builderStatus(upgradeSlots.builderBase.builders.free, upgradeSlots.builderBase.builders.total)}
            </strong>
          </div>
        )}
        {upgradeSlots?.builderBase?.laboratory && (
          <div className={upgradeSlots.builderBase.laboratory.available ? "ready" : ""}>
            <span>{t("builderBaseLab")}</span>
            <strong>{laboratoryStatus(upgradeSlots.builderBase.laboratory)}</strong>
          </div>
        )}
      </div>
    </div>
  );
}
