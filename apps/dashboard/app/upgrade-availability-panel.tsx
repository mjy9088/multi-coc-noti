import type { BuilderAvailability, LaboratoryAvailability } from "@multi-coc/upgrade-availability";

type Locale = "ko" | "en";
type UpgradeSlots = {
  laboratory: LaboratoryAvailability | null;
  petHouse: { available: boolean } | null;
  builderBase: { builders: BuilderAvailability; laboratory: LaboratoryAvailability | null } | null;
};

const labels = {
  ko: { title: "업그레이드 가능 상태", builder: "빌더", research: "연구소", pet: "펫", builderBaseBuilder: "장인기지 장인", builderBaseLab: "장인기지 연구소", available: "업그레이드 가능", busy: "진행 중", researching: "연구 중", goblinResearcher: "고블린 연구원 포함", goblinResearcherReady: "고블린 연구원 사용 가능", goblinBuilderReady: "고블린 장인 사용 가능", goblinBuilderActive: "고블린 장인 포함" },
  en: { title: "Upgrade availability", builder: "Builders", research: "Laboratory", pet: "Pet", builderBaseBuilder: "Builder Base builders", builderBaseLab: "Builder Base lab", available: "Upgrade available", busy: "In progress", researching: "researching", goblinResearcher: "includes Goblin Researcher", goblinResearcherReady: "Goblin Researcher available", goblinBuilderReady: "Goblin Builder available", goblinBuilderActive: "includes Goblin Builder" },
} as const;

function builderStatus(free: number, total: number, locale: Locale, regularTotal = total) {
  const t = labels[locale];
  const active = Math.max(0, total - free);
  const status = locale === "ko" ? `${active}/${total} 작업 중 · ${free}명 대기` : `${active}/${total} working · ${free} available`;
  if (total <= regularTotal) return status;
  return `${status} · ${active > regularTotal ? t.goblinBuilderActive : t.goblinBuilderReady}`;
}

function laboratoryStatus(slot: LaboratoryAvailability, locale: Locale) {
  const t = labels[locale];
  const active = slot.active || 0;
  const total = Math.max(1, slot.total || 1);
  if (!active) return slot.available ? t.available : t.busy;
  return `${active}/${total} ${t.researching}${active < total ? ` · ${t.goblinResearcherReady}` : active > 1 ? ` · ${t.goblinResearcher}` : ""}`;
}

// Dashboard cards and Paste game JSON previews intentionally share this component.
// Keep availability wording, counts, and slot layout here so both surfaces change together.
export default function UpgradeAvailabilityPanel({ builders, upgradeSlots, locale }: { builders: BuilderAvailability; upgradeSlots?: UpgradeSlots; locale: Locale }) {
  const t = labels[locale];
  const regularBuilders = builders.regularTotal ?? builders.total;
  const builderText = builderStatus(builders.free, builders.total, locale, regularBuilders);
  return <div className="upgrade-availability"><div className="availability-heading"><div className="hammer">◆</div><strong>{t.title}</strong></div><div className="upgrade-slots">
    <div className={builders.free > 0 ? "ready builder-slot" : "builder-slot"}><span>{t.builder}</span><strong>{builderText}</strong><div className="builder-dots" aria-label={builderText}>{Array.from({ length: builders.total }, (_, i) => <i className={i < builders.total - builders.free ? "busy" : ""} key={i} />)}</div></div>
    {upgradeSlots?.laboratory && <div className={upgradeSlots.laboratory.available ? "ready" : ""}><span>{t.research}</span><strong>{laboratoryStatus(upgradeSlots.laboratory, locale)}</strong></div>}
    {upgradeSlots?.petHouse && <div className={upgradeSlots.petHouse.available ? "ready" : ""}><span>{t.pet}</span><strong>{upgradeSlots.petHouse.available ? t.available : t.busy}</strong></div>}
    {upgradeSlots?.builderBase && <div className={upgradeSlots.builderBase.builders.free > 0 ? "ready" : ""}><span>{t.builderBaseBuilder}</span><strong>{builderStatus(upgradeSlots.builderBase.builders.free, upgradeSlots.builderBase.builders.total, locale)}</strong></div>}
    {upgradeSlots?.builderBase?.laboratory && <div className={upgradeSlots.builderBase.laboratory.available ? "ready" : ""}><span>{t.builderBaseLab}</span><strong>{laboratoryStatus(upgradeSlots.builderBase.laboratory, locale)}</strong></div>}
  </div></div>;
}
