"use client";

import { ActionBar, Badge, Button, Card, Checkbox, Separator } from "@multi-coc/ui";
import { useState } from "react";
import { type CompositionVariant, CompositionWorkbench } from "../composition-workbench";

const variants: CompositionVariant[] = [
  {
    value: "route",
    label: "A · Full review route",
    status: "exploring",
    rationale: "Best reading space and history semantics, but leaves the user's current screen.",
  },
  {
    value: "dialog",
    label: "B · Centered dialog",
    status: "preferred",
    rationale: "Production default: preserves desktop context and becomes a near-full-height sheet on narrow screens.",
  },
  {
    value: "sheet",
    label: "C · Responsive sheet",
    status: "rejected",
    rationale: "A separate presentation is unnecessary because the owned Dialog already adapts to a mobile sheet.",
  },
];

function ImportFixture({ many, stickyActions }: { many: boolean; stickyActions: boolean }) {
  const upgrades = many
    ? Array.from({ length: 14 }, (_, index) => ({
        name:
          index % 2
            ? `Multi Mortar · Level ${index + 2} → ${index + 3}`
            : `Archer Queen · Level ${90 + index} → ${91 + index}`,
        base: index % 3 ? "Home" : "Builder Base",
        remaining: `${index + 1}h ${index * 3}m remaining`,
      }))
    : [
        { name: "Archer Queen · Level 96 → 97", base: "Changed", remaining: "1d 8h remaining" },
        { name: "Multi Mortar · Level 9 → 10", base: "Builder Base", remaining: "8h 24m remaining" },
      ];
  return (
    <div className="composition-import">
      <div>
        <p className="lab-kicker">Quick import · Main village</p>
        <h2>Changes since the previous export</h2>
        <p className="lab-muted">Exported today at 14:32 · #2ABC</p>
      </div>
      <div className="flow-diff-grid">
        <Card>
          <span className="flow-diff-label">Builders</span>
          <strong>0 → 1 free</strong>
        </Card>
        <Card>
          <span className="flow-diff-label">Upgrades</span>
          <strong>6 → 5 active</strong>
        </Card>
        <Card>
          <span className="flow-diff-label">Next finish</span>
          <strong>Cannon · 48m</strong>
        </Card>
      </div>
      <div className="composition-list-header ui-sticky-surface">
        <strong>Detected work</strong>
        <span>{upgrades.length} upgrades</span>
      </div>
      <div className="flow-list composition-import-list">
        {upgrades.map((upgrade) => (
          <Card key={upgrade.name}>
            <Badge tone={upgrade.base === "Changed" ? "accent" : "neutral"}>{upgrade.base}</Badge>
            <strong>{upgrade.name}</strong>
            <span>{upgrade.remaining}</span>
          </Card>
        ))}
      </div>
      <Separator />
      <Checkbox label="Resources are not ready" description="Keep the 60-minute preparation alert." defaultChecked />
      <ActionBar sticky={stickyActions}>
        <Button tone="quiet">Cancel</Button>
        <Button>Import reviewed data</Button>
      </ActionBar>
    </div>
  );
}

export default function ImportCompositionPage() {
  const [variant, setVariant] = useState("dialog");
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [scale, setScale] = useState<"representative" | "many">("representative");
  return (
    <CompositionWorkbench
      title="How should fast import preserve context?"
      question="Can users review meaningful changes quickly without losing their previous task?"
      criteria={[
        "Changes and final action remain visible at realistic content length.",
        "Failure preserves pasted data and review state.",
        "Mobile keyboard and safe areas do not hide the final action.",
        "Cancel returns to the exact prior context.",
        "A large active-upgrade list scrolls inside the task without losing its title or final action.",
      ]}
      variants={variants}
      variant={variant}
      viewport={viewport}
      scale={scale}
      onVariant={setVariant}
      onViewport={setViewport}
      onScale={setScale}
    >
      <div className="composition-context">
        <div className="composition-fake-dashboard">
          <span>Dashboard context</span>
          <Card>
            <strong>Main village</strong>
            <p className="lab-muted">1 builder available · next finish in 48m</p>
          </Card>
        </div>
        {variant === "dialog" && <div className="composition-backdrop" />}
        <section className={`composition-surface composition-${variant}`}>
          <ImportFixture many={scale === "many"} stickyActions={variant !== "route"} />
        </section>
      </div>
    </CompositionWorkbench>
  );
}
