"use client";

import { Badge, Button, Card } from "@multi-coc/ui";
import { useState } from "react";
import { type CompositionVariant, CompositionWorkbench } from "../composition-workbench";

const variants: CompositionVariant[] = [
  {
    value: "availability",
    label: "A · Availability first",
    status: "preferred",
    rationale: "Directly answers where work can start; chart remains supporting evidence.",
  },
  {
    value: "timeline",
    label: "B · Timeline first",
    status: "exploring",
    rationale: "Useful during busy periods but delays the most common free-slot decision.",
  },
  {
    value: "compact",
    label: "C · Dense command table",
    status: "rejected",
    rationale: "High scan efficiency on desktop, but poor touch hierarchy and mobile translation.",
  },
];
const villages = [
  { name: "Main village", tag: "#2ABC", free: "1 Home", next: "48m", status: "Ready" },
  { name: "Builder focus", tag: "#8XYZ", free: "1 Builder", next: "8h 24m", status: "Update needed" },
  { name: "War mini", tag: "#9MINI", free: "None", next: "1d 8h", status: "Busy" },
];
const manyVillages = Array.from({ length: 30 }, (_, index) => ({
  ...villages[index % villages.length],
  name: `${villages[index % villages.length].name} ${index + 1}`,
  tag: `#V${String(index + 1).padStart(3, "0")}`,
  status: index % 7 === 0 ? "Update needed" : index % 3 === 0 ? "Ready" : "Busy",
}));

function Summary() {
  return (
    <div className="flow-metric-grid">
      <Card>
        <span>Home Village idle</span>
        <strong>3</strong>
      </Card>
      <Card>
        <span>Builder Base idle</span>
        <strong>2</strong>
      </Card>
      <Card>
        <span>Next completion</span>
        <strong>48m</strong>
      </Card>
    </div>
  );
}
function Timeline({ many }: { many: boolean }) {
  return (
    <Card className="composition-chart">
      <div>
        <strong>Upgrade outlook</strong>
        <span>{many ? "74 active · 18 slots released in 24h" : "8 active · 5 slots released in 24h"}</span>
      </div>
      <div className="composition-bars">
        <i style={{ height: "35%" }} />
        <i style={{ height: "78%" }} />
        <i style={{ height: "52%" }} />
        <i style={{ height: "90%" }} />
        <i style={{ height: "40%" }} />
      </div>
    </Card>
  );
}
function Cards({ items }: { items: typeof villages }) {
  return (
    <div className="flow-village-grid">
      {items.map((village) => (
        <Card key={village.tag}>
          <div className="flow-card-heading">
            <span className="flow-avatar">{village.name[0]}</span>
            <div>
              <strong>{village.name}</strong>
              <small>{village.tag}</small>
            </div>
            <Badge
              tone={village.status === "Ready" ? "success" : village.status === "Update needed" ? "warning" : "neutral"}
            >
              {village.status}
            </Badge>
          </div>
          <div className="flow-slot-row">
            <span>
              Available <b>{village.free}</b>
            </span>
            <span>
              Next <b>{village.next}</b>
            </span>
          </div>
        </Card>
      ))}
    </div>
  );
}

export default function DashboardCompositionPage() {
  const [variant, setVariant] = useState("availability");
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [scale, setScale] = useState<"representative" | "many">("representative");
  const displayedVillages = scale === "many" ? manyVillages : villages;
  return (
    <CompositionWorkbench
      title="What should Dashboard answer first?"
      question="Which village can start useful work now, and what needs attention next?"
      criteria={[
        "A free Home or Builder Base slot is identifiable within one scan.",
        "Update-needed villages outrank decorative metrics.",
        "Charts remain above a list of dozens without outranking availability summary.",
        "Search, filters, and result count remain reachable while scanning a long list.",
        "Mobile order preserves the same task priority.",
      ]}
      variants={variants}
      variant={variant}
      viewport={viewport}
      scale={scale}
      onVariant={setVariant}
      onViewport={setViewport}
      onScale={setScale}
    >
      <div className="flow-product composition-dashboard">
        <div className="flow-sim-header">
          <div>
            <p className="lab-kicker">Village overview</p>
            <h2>Village status today</h2>
          </div>
          <Button>Quick paste</Button>
        </div>
        {variant === "availability" && (
          <>
            <Summary />
            <Timeline many={scale === "many"} />
            <div className="composition-list-header ui-sticky-surface">
              <div>
                <strong>Villages</strong>
                <span>{displayedVillages.length} results · availability sorted</span>
              </div>
              <div>
                <Button size="small" tone="secondary">
                  Search
                </Button>
                <Button size="small" tone="quiet">
                  Filters
                </Button>
              </div>
            </div>
            <Cards items={displayedVillages} />
          </>
        )}
        {variant === "timeline" && (
          <>
            <Timeline many={scale === "many"} />
            <Summary />
            <div className="composition-list-header ui-sticky-surface">
              <strong>Villages · {displayedVillages.length}</strong>
              <Button size="small" tone="secondary">
                Filter
              </Button>
            </div>
            <Cards items={displayedVillages} />
          </>
        )}
        {variant === "compact" && (
          <>
            <Summary />
            <div className="composition-table">
              <div className="header">
                <span>Village</span>
                <span>Available</span>
                <span>Next</span>
                <span>Status</span>
              </div>
              {displayedVillages.map((village) => (
                <div key={village.tag}>
                  <strong>{village.name}</strong>
                  <span>{village.free}</span>
                  <span>{village.next}</span>
                  <Badge>{village.status}</Badge>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </CompositionWorkbench>
  );
}
