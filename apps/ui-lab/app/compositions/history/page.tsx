"use client";

import { Badge, Button, Card, Field, Label, Select } from "@multi-coc/ui";
import { useState } from "react";
import { type CompositionVariant, CompositionWorkbench } from "../composition-workbench";

const variants: CompositionVariant[] = [
  {
    value: "cards",
    label: "A · Scannable cards",
    status: "preferred",
    rationale: "Preserves long identities and touch targets while keeping filters stable.",
  },
  {
    value: "grouped",
    label: "B · Group by village",
    status: "exploring",
    rationale: "Good village narrative, weaker chronological comparison across accounts.",
  },
  {
    value: "timeline",
    label: "C · Visual timeline",
    status: "rejected",
    rationale: "Implies precision and completion semantics the observed exports cannot prove.",
  },
];
const records = [
  { village: "Main village", item: "Archer Queen · Level 96 → 97", when: "Observed today at 14:32", active: true },
  { village: "Builder focus", item: "Multi Mortar · Level 9 → 10", when: "Observed yesterday at 22:18", active: false },
  { village: "Main village", item: "Root Rider · Level 3 → 4", when: "Observed Jul 16 at 08:41", active: false },
];
const manyRecords = Array.from({ length: 36 }, (_, index) => ({
  ...records[index % records.length],
  item: `${records[index % records.length].item} · observation ${index + 1}`,
  when: `Observed ${index + 1} hours ago`,
  active: index < 8,
}));
function Record({ record }: { record: (typeof records)[number] }) {
  return (
    <Card>
      <div className="flow-record">
        <div>
          <strong>{record.item}</strong>
          <span>
            {record.village} · {record.when}
          </span>
        </div>
        <Badge tone={record.active ? "accent" : "neutral"}>{record.active ? "Active" : "Inactive"}</Badge>
      </div>
    </Card>
  );
}

export default function HistoryCompositionPage() {
  const [variant, setVariant] = useState("cards");
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [scale, setScale] = useState<"representative" | "many">("representative");
  const displayedRecords = scale === "many" ? manyRecords : records;
  return (
    <CompositionWorkbench
      title="How should observed history read?"
      question="Can users understand what was seen and when without implying completion or cancellation?"
      criteria={[
        "Observed time and active/inactive meaning remain explicit.",
        "Long translated names wrap without hiding village identity.",
        "Filters remain reachable while loading more records.",
        "A long result list keeps filters, result count, and Load more boundaries understandable.",
        "Visual structure does not imply unprovable causality.",
      ]}
      variants={variants}
      variant={variant}
      viewport={viewport}
      scale={scale}
      onVariant={setVariant}
      onViewport={setViewport}
      onScale={setScale}
    >
      <div className="flow-product composition-history">
        <div>
          <p className="lab-kicker">Upgrade history</p>
          <h2>Observed work over time</h2>
        </div>
        <div className="flow-filter-grid composition-sticky-filters ui-sticky-surface">
          <Field>
            <Label>Village</Label>
            <Select>
              <option>All villages</option>
            </Select>
          </Field>
          <Field>
            <Label>State</Label>
            <Select>
              <option>All states</option>
            </Select>
          </Field>
        </div>
        <div className="composition-list-header ui-sticky-surface">
          <strong>{displayedRecords.length} observed upgrades</strong>
          <span>Newest observation first</span>
        </div>
        {variant === "cards" && (
          <div className="flow-list">
            {displayedRecords.map((record) => (
              <Record key={record.item} record={record} />
            ))}
          </div>
        )}
        {variant === "grouped" && (
          <div className="composition-groups">
            {["Main village", "Builder focus"].map((village) => (
              <section key={village}>
                <h3>{village}</h3>
                <div className="flow-list">
                  {displayedRecords
                    .filter((record) => record.village === village)
                    .map((record) => (
                      <Record key={record.item} record={record} />
                    ))}
                </div>
              </section>
            ))}
          </div>
        )}
        {variant === "timeline" && (
          <div className="composition-timeline">
            {displayedRecords.map((record) => (
              <div key={record.item}>
                <i />
                <Record record={record} />
              </div>
            ))}
          </div>
        )}
        <div className="flow-actions">
          <Button tone="secondary">Load more</Button>
        </div>
      </div>
    </CompositionWorkbench>
  );
}
