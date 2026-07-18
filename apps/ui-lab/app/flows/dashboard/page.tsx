"use client";

import { Badge, Button, Card, EmptyState, RequestState, Skeleton } from "@multi-coc/ui";
import { useState } from "react";
import { type FlowControls, FlowWorkbench } from "../flow-workbench";

const scenarios = [
  { value: "normal", label: "Mixed village status" },
  { value: "empty", label: "No villages" },
  { value: "filtered", label: "No filter results" },
  { value: "stale", label: "Cached / stale data" },
  { value: "builder-only", label: "Builder Base only" },
  { value: "long-content", label: "Long names and tags" },
];
const initial: FlowControls = { scenario: "normal", viewport: "desktop", latency: "instant", result: "success" };

export default function DashboardFlowPage() {
  const [controls, setControls] = useState(initial);
  const loading = controls.latency === "slow";
  const failed = controls.result === "failure";
  return (
    <FlowWorkbench
      title="Dashboard at its edges"
      description="Check information priority when data is empty, stale, filtered, unusually long, or concentrated in Builder Base."
      scenarios={scenarios}
      controls={controls}
      onChange={setControls}
    >
      <div className="flow-product dashboard-sim">
        <div className="flow-sim-header">
          <div>
            <p className="lab-kicker">Village overview</p>
            <h2>Village status today</h2>
          </div>
          <Button>Quick paste</Button>
        </div>
        {failed && (
          <RequestState
            tone="error"
            title="Dashboard could not refresh"
            description="Previously loaded data remains visible when available."
            action={
              <Button size="small" tone="secondary">
                Retry
              </Button>
            }
          />
        )}
        {controls.scenario === "stale" && (
          <RequestState
            tone="warning"
            title="Showing cached data"
            description="Last successful refresh was 18 minutes ago."
            action={
              <Button size="small" tone="secondary">
                Retry
              </Button>
            }
          />
        )}
        {loading ? (
          <div className="flow-metric-grid">
            {[1, 2, 3].map((n) => (
              <Card key={n}>
                <div className="lab-stack">
                  <Skeleton width="45%" />
                  <Skeleton width="70%" />
                </div>
              </Card>
            ))}
          </div>
        ) : controls.scenario === "empty" ? (
          <EmptyState
            title="No villages yet"
            description="Paste a game export to add the first village."
            action={<Button>Add village data</Button>}
          />
        ) : controls.scenario === "filtered" ? (
          <EmptyState
            title="No villages match these filters"
            description="No data was deleted. Clear one or more filters."
            action={<Button tone="secondary">Clear filters</Button>}
          />
        ) : (
          <>
            <div className="flow-metric-grid">
              <Card>
                <span>Home Village idle</span>
                <strong>{controls.scenario === "builder-only" ? "0" : "3"}</strong>
              </Card>
              <Card>
                <span>Builder Base idle</span>
                <strong>{controls.scenario === "builder-only" ? "1" : "2"}</strong>
              </Card>
              <Card>
                <span>Next completion</span>
                <strong>48m</strong>
              </Card>
            </div>
            <div className="flow-filter-bar">
              <Button size="small" tone="secondary">
                All accounts
              </Button>
              <Button size="small" tone="quiet">
                Available slots
              </Button>
              <Button size="small" tone="quiet">
                Update needed
              </Button>
            </div>
            <div className="flow-village-grid">
              <Card selected>
                <div className="flow-card-heading">
                  <span className="flow-avatar">M</span>
                  <div>
                    <strong>
                      {controls.scenario === "long-content"
                        ? "Main village with a deliberately very long display name"
                        : "Main village"}
                    </strong>
                    <small>
                      #2ABC · War · Main ·{" "}
                      {controls.scenario === "long-content" ? "International tournament roster" : "Daily"}
                    </small>
                  </div>
                  <Badge tone="accent">1 free</Badge>
                </div>
                <div className="flow-slot-row">
                  <span>
                    Builders <b>{controls.scenario === "builder-only" ? "0/6" : "1/6"}</b>
                  </span>
                  <span>
                    Laboratory <b>Busy</b>
                  </span>
                  <span>
                    Pet House <b>Ready</b>
                  </span>
                </div>
              </Card>
              <Card>
                <div className="flow-card-heading">
                  <span className="flow-avatar blue">B</span>
                  <div>
                    <strong>Builder focus</strong>
                    <small>#8XYZ · Builder Base</small>
                  </div>
                  {controls.scenario === "stale" ? <Badge tone="warning">Update needed</Badge> : <Badge>Busy</Badge>}
                </div>
                <div className="flow-slot-row">
                  <span>
                    Home <b>0/6</b>
                  </span>
                  <span>
                    Builder Base <b>1/2 free</b>
                  </span>
                </div>
              </Card>
            </div>
          </>
        )}
      </div>
    </FlowWorkbench>
  );
}
