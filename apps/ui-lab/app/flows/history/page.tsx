"use client";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Label,
  RequestState,
  Select,
  Skeleton,
  Tab,
  Tabs,
} from "@multi-coc/ui";
import { useState } from "react";
import { type FlowControls, FlowWorkbench } from "../flow-workbench";

const scenarios = [
  { value: "upgrades", label: "Upgrade records" },
  { value: "syncs", label: "Sync records" },
  { value: "empty", label: "No records" },
  { value: "filtered", label: "No filter results" },
  { value: "pagination", label: "Loading more" },
  { value: "long-content", label: "Long record content" },
];
const initial: FlowControls = { scenario: "upgrades", viewport: "desktop", latency: "instant", result: "success" };

export default function HistoryFlowPage() {
  const [controls, setControls] = useState(initial);
  const section = controls.scenario === "syncs" ? "syncs" : "upgrades";
  const loading = controls.latency === "slow" || controls.scenario === "pagination";
  return (
    <FlowWorkbench
      title="History that stays scannable"
      description="Exercise filtering, pagination, empty results, request failure, and long upgrade identities without relying on stored history."
      scenarios={scenarios}
      controls={controls}
      onChange={setControls}
    >
      <div className="flow-product history-sim">
        <div>
          <p className="lab-kicker">History</p>
          <h2>What changed and when</h2>
        </div>
        <Tabs
          label="History type"
          value={section}
          onValueChange={(value) => setControls({ ...controls, scenario: value })}
        >
          <Tab value="upgrades">Upgrades</Tab>
          <Tab value="syncs">Syncs</Tab>
        </Tabs>
        <div className="flow-filter-grid">
          <Field>
            <Label>Village</Label>
            <Select>
              <option>All villages</option>
              <option>Main village</option>
            </Select>
          </Field>
          <Field>
            <Label>{section === "upgrades" ? "State" : "Import result"}</Label>
            <Select>
              <option>All</option>
              <option>{section === "upgrades" ? "Active" : "Imported"}</option>
            </Select>
          </Field>
        </div>
        {controls.result === "failure" && (
          <RequestState
            tone="error"
            title="History could not be loaded"
            description="Filters remain selected for retry."
            action={
              <Button size="small" tone="secondary">
                Retry
              </Button>
            }
          />
        )}
        {controls.scenario === "empty" ? (
          <EmptyState title="No history yet" description="Records appear after the first village import." />
        ) : controls.scenario === "filtered" ? (
          <EmptyState
            title="No records match these filters"
            action={
              <Button size="small" tone="secondary">
                Clear filters
              </Button>
            }
          />
        ) : (
          <div className="flow-list">
            {section === "syncs" ? (
              <>
                <Card>
                  <div className="flow-record">
                    <div>
                      <strong>Main village</strong>
                      <span>Imported today at 14:32</span>
                    </div>
                    <Badge tone="success">5 active upgrades</Badge>
                  </div>
                </Card>
                <Card>
                  <div className="flow-record">
                    <div>
                      <strong>Builder focus</strong>
                      <span>Imported yesterday at 22:18</span>
                    </div>
                    <Badge>2 Builder Base</Badge>
                  </div>
                </Card>
              </>
            ) : (
              <>
                <Card>
                  <div className="flow-record">
                    <div>
                      <strong>
                        {controls.scenario === "long-content"
                          ? "A deliberately long translated building name that must wrap without hiding its level"
                          : "Archer Queen · Level 96 → 97"}
                      </strong>
                      <span>Main village · observed today at 14:32</span>
                    </div>
                    <Badge tone="accent">Active</Badge>
                  </div>
                </Card>
                <Card>
                  <div className="flow-record">
                    <div>
                      <strong>Multi Mortar · Level 9 → 10</strong>
                      <span>Builder focus · observed yesterday</span>
                    </div>
                    <Badge>Inactive</Badge>
                  </div>
                </Card>
              </>
            )}
            {loading && (
              <Card>
                <div className="lab-stack">
                  <Skeleton width="48%" />
                  <Skeleton width="76%" />
                </div>
              </Card>
            )}
          </div>
        )}
        <div className="flow-actions">
          <Button tone="secondary" pending={loading}>
            {loading ? "Loading more…" : "Load more"}
          </Button>
        </div>
      </div>
    </FlowWorkbench>
  );
}
