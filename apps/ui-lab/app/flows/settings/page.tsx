"use client";

import {
  Badge,
  Button,
  Card,
  Checkbox,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
  Field,
  FieldError,
  Input,
  Label,
  RequestState,
  Select,
  ToastProvider,
  useToast,
} from "@multi-coc/ui";
import { useState } from "react";
import { type FlowControls, FlowWorkbench } from "../flow-workbench";

const scenarios = [
  { value: "village", label: "Village settings" },
  { value: "alerts", label: "Upgrade alert override" },
  { value: "groups", label: "Group order" },
  { value: "delete", label: "Delete village" },
];
const initial: FlowControls = { scenario: "village", viewport: "desktop", latency: "instant", result: "success" };

function SettingsStage({ controls }: { controls: FlowControls }) {
  const { toast } = useToast();
  const pending = controls.latency === "slow";
  const save = () =>
    toast({
      intent: controls.result === "success" ? "success" : "error",
      title: controls.result === "success" ? "Settings saved" : "Could not save settings",
      description: controls.result === "success" ? "Changes are active immediately." : "Your edits remain in the form.",
      duration: controls.result === "success" ? 5000 : null,
    });
  return (
    <div className="flow-product settings-sim">
      <aside className="flow-side-list" aria-label="Villages">
        <button className="selected">
          <span className="flow-avatar">M</span>
          <span className="flow-side-copy">
            <strong>Main village</strong>
            <small>#2ABC</small>
          </span>
        </button>
        <button>
          <span className="flow-avatar blue">B</span>
          <span className="flow-side-copy">
            <strong>Builder focus</strong>
            <small>#8XYZ</small>
          </span>
        </button>
      </aside>
      <div className="flow-pane">
        <div className="flow-review-heading">
          <div>
            <p className="lab-kicker">Settings</p>
            <h2>
              {controls.scenario === "alerts"
                ? "Upgrade alert"
                : controls.scenario === "groups"
                  ? "Group order"
                  : "Main village"}
            </h2>
          </div>
          <Badge tone={controls.result === "failure" ? "warning" : "success"}>
            {controls.result === "failure" ? "Unsaved edits" : "Up to date"}
          </Badge>
        </div>
        {controls.result === "failure" && (
          <RequestState
            tone="error"
            title="The previous save failed"
            description="Review the highlighted field or retry. Other settings were not discarded."
          />
        )}
        {controls.scenario === "village" && (
          <div className="lab-stack">
            <Field>
              <Label>Display name</Label>
              <Input defaultValue="Main village" />
            </Field>
            <Field invalid={controls.result === "failure"}>
              <Label>Preparation time</Label>
              <Input type="number" defaultValue="60" />
              <FieldError>{controls.result === "failure" ? "Use a value between 5 and 1440 minutes." : ""}</FieldError>
            </Field>
            <Field>
              <Label>Color</Label>
              <Input type="color" defaultValue="#397a5d" />
            </Field>
            <Checkbox
              label="Preparation alerts"
              description="Individual active upgrades can override this default."
              defaultChecked
            />
          </div>
        )}
        {controls.scenario === "alerts" && (
          <div className="lab-stack">
            <Card>
              <Badge tone="accent">Active</Badge>
              <h3>Archer Queen · 96 → 97</h3>
              <p className="lab-muted">Finishes tomorrow at 18:42</p>
            </Card>
            <Field>
              <Label>Preparation alert</Label>
              <Select defaultValue="inherit">
                <option value="inherit">Use village default · 60 minutes</option>
                <option value="off">Disabled for this upgrade</option>
                <option value="custom">Custom time</option>
              </Select>
            </Field>
            <Button tone="secondary">Open village settings</Button>
          </div>
        )}
        {controls.scenario === "groups" && (
          <div className="flow-list">
            <Card>
              <span className="flow-drag">⠿</span>
              <strong>War</strong>
              <Badge>4 villages</Badge>
            </Card>
            <Card>
              <span className="flow-drag">⠿</span>
              <strong>Main</strong>
              <Badge>2 villages</Badge>
            </Card>
            <Card>
              <span className="flow-drag">⠿</span>
              <strong>Mini</strong>
              <Badge>3 villages</Badge>
            </Card>
          </div>
        )}
        {controls.scenario === "delete" && (
          <Card>
            <h3>Danger zone</h3>
            <p className="lab-muted">Deleting removes this village and its stored export history.</p>
            <Dialog>
              <DialogTrigger asChild>
                <Button tone="danger">Delete Main village</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogTitle>Delete Main village?</DialogTitle>
                <DialogDescription>
                  This permanently removes #2ABC, its history, and notification settings.
                </DialogDescription>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button tone="secondary">Keep village</Button>
                  </DialogClose>
                  <DialogClose asChild>
                    <Button tone="danger" onClick={() => toast({ intent: "success", title: "Village deleted" })}>
                      Delete permanently
                    </Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </Card>
        )}
        {controls.scenario !== "delete" && (
          <div className="flow-actions">
            <Button tone="quiet">Reset edits</Button>
            <Button pending={pending} disabled={pending} onClick={save}>
              {pending ? "Saving…" : "Save settings"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SettingsFlowPage() {
  const [controls, setControls] = useState(initial);
  return (
    <FlowWorkbench
      title="Settings that acknowledge every save"
      description="Inspect pending feedback, retained edits after failure, validation, destructive confirmation, and narrow-screen ordering."
      scenarios={scenarios}
      controls={controls}
      onChange={setControls}
    >
      <ToastProvider>
        <SettingsStage controls={controls} />
      </ToastProvider>
    </FlowWorkbench>
  );
}
