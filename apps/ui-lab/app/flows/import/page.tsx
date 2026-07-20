"use client";

import {
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  Field,
  FieldError,
  Input,
  Label,
  RequestState,
  Separator,
  Skeleton,
  Textarea,
  ToastProvider,
  useToast,
} from "@multi-coc/ui";
import { useState } from "react";
import { type FlowControls, FlowWorkbench, StepTabs } from "../flow-workbench";

const scenarios = [
  { value: "existing-changes", label: "Existing village · changes" },
  { value: "existing-same", label: "Existing village · no changes" },
  { value: "new-village", label: "New village" },
  { value: "invalid-json", label: "Invalid JSON" },
  { value: "clipboard-denied", label: "Clipboard denied" },
];
const initial: FlowControls = {
  scenario: "existing-changes",
  viewport: "desktop",
  latency: "instant",
  result: "success",
};

function ImportStage({ controls }: { controls: FlowControls }) {
  const [step, setStep] = useState("paste");
  const { toast } = useToast();
  const invalid = controls.scenario === "invalid-json";
  const denied = controls.scenario === "clipboard-denied";
  const isNew = controls.scenario === "new-village";
  const unchanged = controls.scenario === "existing-same";
  const pending = controls.latency === "slow" && step === "review";
  const next = () => setStep(step === "paste" ? "review" : step === "review" ? "policy" : "done");
  if (step === "done")
    return (
      <EmptyState
        title={controls.result === "success" ? "Import complete" : "Import could not be saved"}
        description={
          controls.result === "success"
            ? "Main village and its history are up to date."
            : "The reviewed export is still here. Retry without pasting again."
        }
        action={
          <Button
            tone={controls.result === "success" ? "secondary" : "primary"}
            onClick={() => {
              if (controls.result === "failure") toast({ intent: "success", title: "Saved after retry" });
              setStep("paste");
            }}
          >
            {controls.result === "success" ? "Import another" : "Retry save"}
          </Button>
        }
      />
    );
  return (
    <div className="flow-product">
      <StepTabs
        value={step}
        onChange={setStep}
        steps={[
          ["paste", "1. Paste"],
          ["review", "2. Review"],
          ["policy", "3. Alerts"],
        ]}
      />
      {step === "paste" && (
        <div className="flow-pane">
          <div>
            <p className="lab-kicker">Update village data</p>
            <h2>Paste an export</h2>
            <p className="lab-muted">Copy it in Clash of Clans under Settings → More Settings → Data Export.</p>
          </div>
          {denied && (
            <RequestState
              tone="warning"
              title="Clipboard access was blocked"
              description="Paste manually below; nothing has been lost."
            />
          )}
          <Field invalid={invalid}>
            <Label>Export JSON</Label>
            <Textarea
              defaultValue={invalid ? "{player: #INVALID" : denied ? "" : '{"tag":"#2ABC","timestamp":1784342400,…}'}
            />
            <FieldError>{invalid ? "This is not complete export JSON." : ""}</FieldError>
          </Field>
          <div className="flow-actions">
            <Button tone="secondary">Paste from clipboard</Button>
            <Button onClick={next} disabled={invalid}>
              Review export
            </Button>
          </div>
        </div>
      )}
      {step === "review" && (
        <div className="flow-pane">
          {pending ? (
            <Card>
              <div className="lab-stack">
                <Skeleton width="35%" />
                <Skeleton />
                <Skeleton width="72%" />
              </div>
            </Card>
          ) : (
            <>
              <div className="flow-review-heading">
                <div>
                  <p className="lab-kicker">{isNew ? "New village" : "Main village · #2ABC"}</p>
                  <h2>{unchanged ? "No tracked changes" : "Changes since the previous export"}</h2>
                </div>
                <Badge tone={unchanged ? "neutral" : "accent"}>{unchanged ? "Same export state" : "4 changes"}</Badge>
              </div>
              {isNew && (
                <Field>
                  <Label>Display name</Label>
                  <Input placeholder="e.g. Main village" />
                </Field>
              )}
              <div className="flow-diff-grid">
                <Card>
                  <span className="flow-diff-label">Builders</span>
                  <strong>{unchanged ? "1 free" : "0 → 1 free"}</strong>
                </Card>
                <Card>
                  <span className="flow-diff-label">Upgrades</span>
                  <strong>{unchanged ? "5 active" : "6 → 5 active"}</strong>
                </Card>
                <Card>
                  <span className="flow-diff-label">Next finish</span>
                  <strong>{unchanged ? "2h 14m" : "Cannon · 48m"}</strong>
                </Card>
              </div>
              <Separator />
              <div>
                <h3>Detected work</h3>
                <div className="flow-list">
                  <Card>
                    <Badge tone="accent">Home</Badge>
                    <strong>Archer Queen · Level 96 → 97</strong>
                    <span>1d 8h remaining</span>
                  </Card>
                  <Card>
                    <Badge>Builder</Badge>
                    <strong>Multi Mortar · Level 9 → 10</strong>
                    <span>8h 24m remaining</span>
                  </Card>
                </div>
              </div>
            </>
          )}
          <div className="flow-actions">
            <Button tone="quiet" onClick={() => setStep("paste")}>
              Back
            </Button>
            <Button pending={pending} disabled={pending} onClick={next}>
              {unchanged ? "Import anyway" : "Import reviewed data"}
            </Button>
          </div>
        </div>
      )}
      {step === "policy" && (
        <div className="flow-pane">
          <div>
            <p className="lab-kicker">Notification policy</p>
            <h2>Resources for the next upgrade?</h2>
            <p className="lab-muted">This only changes preparation timing. The export is already ready to save.</p>
          </div>
          <div className="flow-choice-grid">
            <Card selected>
              <Checkbox label="Not enough yet" description="Keep the 60-minute preparation alert." defaultChecked />
            </Card>
            <Card>
              <Checkbox label="Enough resources" description="Notify close to completion." />
            </Card>
          </div>
          <div className="flow-actions">
            <Button tone="quiet" onClick={() => setStep("review")}>
              Back
            </Button>
            <Button onClick={next}>Save and finish</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ImportFlowPage() {
  const [controls, setControls] = useState(initial);
  return (
    <FlowWorkbench
      title="Import without losing context"
      description="Exercise the shared Dialog/sheet fast path across review density, validation recovery, and notification follow-up states."
      scenarios={scenarios}
      controls={controls}
      onChange={setControls}
    >
      <ToastProvider>
        <ImportStage key={controls.scenario} controls={controls} />
      </ToastProvider>
    </FlowWorkbench>
  );
}
