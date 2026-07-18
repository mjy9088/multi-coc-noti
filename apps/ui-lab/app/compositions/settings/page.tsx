"use client";

import {
  ActionBar,
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  Field,
  Input,
  Label,
  Select,
  SplitLayout,
} from "@multi-coc/ui";
import { useState } from "react";
import { type CompositionVariant, CompositionWorkbench } from "../composition-workbench";

const variants: CompositionVariant[] = [
  {
    value: "form-first",
    label: "A · Form-first desktop",
    status: "preferred",
    rationale:
      "Desktop keeps form context first; mobile keeps the list as its base and opens settings in a bottom sheet.",
  },
  {
    value: "list-first",
    label: "B · List-first desktop",
    status: "rejected",
    rationale: "Desktop comparison only. Mobile uses the same list-to-detail bottom-sheet pattern across variants.",
  },
  {
    value: "split",
    label: "C · Persistent split pane",
    status: "exploring",
    rationale: "Strong desktop orientation; needs a deliberate mobile collapse rule.",
  },
];

const villageNames = [
  "Main village",
  "Builder focus",
  "War mini",
  "Donation account",
  "Capital weekend",
  "Rush project",
];

function VillageList({ count, selected, onSelect }: { count: number; selected: boolean; onSelect?: () => void }) {
  const items = Array.from({ length: count }, (_, index) => ({ id: `V${String(index + 1).padStart(3, "0")}`, index }));
  return (
    <aside className="composition-village-browser" aria-label="Village list">
      <div className="composition-list-header ui-sticky-surface">
        <div>
          <strong>Villages</strong>
          <span>{count} accounts</span>
        </div>
        <Button size="small" tone="secondary">
          Search
        </Button>
      </div>
      <div className="flow-side-list composition-scroll-list">
        {items.map((item) => (
          <button key={item.id} className={selected && item.index === 0 ? "selected" : undefined} onClick={onSelect}>
            <span className={`flow-avatar ${item.index % 2 ? "blue" : ""}`}>
              {villageNames[item.index % villageNames.length][0]}
            </span>
            <span className="flow-side-copy">
              <strong>
                {villageNames[item.index % villageNames.length]}
                {count > 6 ? ` ${item.index + 1}` : ""}
              </strong>
              <small>#{item.id}</small>
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
}
function Form({ onClose }: { onClose?: () => void }) {
  return (
    <section className="flow-pane">
      <div className="flow-review-heading">
        <div>
          <p className="lab-kicker">Manage village</p>
          <h2>Main village</h2>
        </div>
        <Badge tone="success">Saved</Badge>
      </div>
      {onClose && (
        <Button className="composition-mobile-change" size="small" tone="secondary" onClick={onClose}>
          Close settings
        </Button>
      )}
      <Field>
        <Label>Display name</Label>
        <Input defaultValue="Main village" />
      </Field>
      <Field>
        <Label>Preparation alert</Label>
        <Select defaultValue="60">
          <option value="off">Disabled</option>
          <option value="60">60 minutes before</option>
          <option value="custom">Custom</option>
        </Select>
      </Field>
      <Checkbox
        label="Show preparation notifications"
        description="Active upgrade overrides remain unchanged."
        defaultChecked
      />
      <Card>
        <strong>Danger zone</strong>
        <p className="lab-muted">Deletion removes stored export history.</p>
        <Button size="small" tone="danger">
          Delete village
        </Button>
      </Card>
      <ActionBar sticky={Boolean(onClose)}>
        <Button tone="quiet">Reset</Button>
        <Button>Save settings</Button>
      </ActionBar>
    </section>
  );
}

export default function SettingsCompositionPage() {
  const [variant, setVariant] = useState("form-first");
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [scale, setScale] = useState<"representative" | "many">("many");
  const [selection, setSelection] = useState<"selected" | "none">("selected");
  const villageCount = scale === "many" ? 36 : 3;
  const list = <VillageList count={villageCount} selected={selection === "selected"} />;
  const form =
    selection === "selected" ? (
      <Form />
    ) : (
      <section className="flow-pane composition-no-selection">
        <EmptyState
          title="Select a village to edit"
          description="Search or choose a village from the list. No account is selected automatically."
        />
      </section>
    );
  return (
    <CompositionWorkbench
      title="Where should village selection live?"
      question="Can users edit the intended village without losing identity or scrolling past the task?"
      criteria={[
        "Selected village identity remains visible beside destructive and save actions.",
        "Mobile keeps the village list as its base and opens detailed settings in a near-full-height bottom sheet.",
        "Switching village does not discard edits silently.",
        "Primary save feedback appears close to the initiating action.",
        "Dozens of villages scroll independently without hiding the selected identity or save action.",
        "Direct navigation without a village shows an intentional no-selection state.",
      ]}
      variants={variants}
      variant={variant}
      viewport={viewport}
      scale={scale}
      onVariant={setVariant}
      onViewport={setViewport}
      onScale={setScale}
      extraControls={
        <Field>
          <Label>Selection state</Label>
          <Select value={selection} onChange={(event) => setSelection(event.target.value as "selected" | "none")}>
            <option value="selected">Main village selected</option>
            <option value="none">No village selected</option>
          </Select>
        </Field>
      }
    >
      {viewport === "mobile" ? (
        <div className="composition-mobile-master-detail">
          <div className="composition-mobile-list-base">
            <div>
              <p className="lab-kicker">Village settings</p>
              <h2>Choose a village</h2>
              <p className="lab-muted">Search {villageCount} accounts by display name or player tag.</p>
            </div>
            <Field>
              <Label>Search villages</Label>
              <Input placeholder="Name or #tag" />
            </Field>
            <VillageList count={villageCount} selected={false} onSelect={() => setSelection("selected")} />
          </div>
          {selection === "selected" && (
            <>
              <div className="composition-picker-backdrop" />
              <section className="composition-mobile-detail-sheet" aria-label="Village details">
                <Form onClose={() => setSelection("none")} />
              </section>
            </>
          )}
        </div>
      ) : (
        <SplitLayout className={`composition-settings composition-settings-${variant}`}>
          {variant === "list-first" && viewport === "desktop" ? (
            <>
              {list}
              {form}
            </>
          ) : (
            <>
              {form}
              {viewport === "desktop" && list}
            </>
          )}
        </SplitLayout>
      )}
    </CompositionWorkbench>
  );
}
