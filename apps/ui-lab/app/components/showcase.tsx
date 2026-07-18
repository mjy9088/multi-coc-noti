"use client";

import {
  ActionBar,
  Badge,
  Button,
  Card,
  Checkbox,
  Description,
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
  EmptyState,
  Field,
  FieldError,
  IconButton,
  Input,
  Label,
  RequestState,
  Select,
  Separator,
  Skeleton,
  Spinner,
  SplitLayout,
  StaleNotice,
  Tab,
  Tabs,
  Textarea,
  ToastProvider,
  useToast,
} from "@multi-coc/ui";
import { useState } from "react";

function ToastExamples() {
  const { toast } = useToast();
  return (
    <div className="lab-row">
      <Button
        onClick={() =>
          toast({ intent: "success", title: "Village settings saved", description: "Changes are active immediately." })
        }
      >
        Success toast
      </Button>
      <Button
        tone="secondary"
        onClick={() =>
          toast({
            intent: "warning",
            title: "Export is getting stale",
            description: "Sync this village to refresh its upgrade state.",
          })
        }
      >
        Warning toast
      </Button>
      <Button
        tone="danger"
        onClick={() =>
          toast({
            id: "save-error",
            intent: "error",
            title: "Could not save settings",
            description: "Check the connection and retry.",
            action: {
              label: "Retry",
              onClick: () => toast({ id: "save-error", intent: "success", title: "Saved after retry" }),
            },
          })
        }
      >
        Persistent error
      </Button>
    </div>
  );
}

export default function ComponentsShowcase() {
  const [tab, setTab] = useState("upgrades");
  return (
    <ToastProvider>
      <div className="lab-grid">
        <section className="lab-section wide">
          <h2>Buttons and icon actions</h2>
          <p>Semantic priority, size, pending, disabled, and labelled icon-only actions.</p>
          <div className="lab-row">
            <Button>Save changes</Button>
            <Button tone="secondary">Review export</Button>
            <Button tone="quiet">Cancel</Button>
            <Button tone="danger">Delete village</Button>
            <IconButton label="Copy player tag">⧉</IconButton>
            <IconButton label="Delete village" tone="danger">
              ×
            </IconButton>
          </div>
        </section>
        <section className="lab-section">
          <h2>Size and async state</h2>
          <div className="lab-row">
            <Button size="small">Small</Button>
            <Button size="medium">Medium</Button>
            <Button size="large">Large</Button>
            <Button pending>Saving…</Button>
            <Button disabled>Unavailable</Button>
          </div>
        </section>
        <section className="lab-section">
          <h2>Action bar</h2>
          <p>Persistent actions use an opaque surface so scrolling content never shows through.</p>
          <ActionBar sticky>
            <Button tone="quiet">Reset</Button>
            <Button>Save settings</Button>
          </ActionBar>
        </section>
        <section className="lab-section wide">
          <h2>Equal-height split layout</h2>
          <p>Sibling panes share the row height even when their content lengths differ.</p>
          <SplitLayout className="lab-split-demo">
            <Card>
              <strong>Primary pane</strong>
              <p>Longer forms or results determine the shared row height.</p>
              <p>Both pane boundaries remain aligned.</p>
            </Card>
            <Card>
              <strong>Secondary pane</strong>
            </Card>
          </SplitLayout>
        </section>
        <section className="lab-section">
          <h2>Badges</h2>
          <div className="lab-row">
            <Badge>Inactive</Badge>
            <Badge tone="accent">Builder free</Badge>
            <Badge tone="success">Synced</Badge>
            <Badge tone="warning">Update needed</Badge>
            <Badge tone="danger">Failed</Badge>
          </div>
        </section>

        <section className="lab-section wide">
          <h2>Fields</h2>
          <p>Labels, descriptions, and errors are connected to their controls.</p>
          <div className="lab-form-grid">
            <Field>
              <Label>Display name</Label>
              <Description>Shown throughout Dashboard instead of the in-game name.</Description>
              <Input defaultValue="Main village" />
            </Field>
            <Field invalid>
              <Label>Player tag</Label>
              <Description>Include or omit the leading #.</Description>
              <Input defaultValue="INVALID!" />
              <FieldError>Use only valid tag characters.</FieldError>
            </Field>
            <Field>
              <Label>Resource policy</Label>
              <Select defaultValue="unknown">
                <option value="unknown">Ask after import</option>
                <option value="enough">Enough resources</option>
                <option value="short">Resources needed</option>
              </Select>
            </Field>
            <Field>
              <Label>Export JSON</Label>
              <Textarea placeholder="Paste export JSON" />
            </Field>
          </div>
          <Separator />
          <div className="lab-stack">
            <Checkbox
              label="Show upgrade-ready villages first"
              description="Applies only in this browser."
              defaultChecked
            />
            <Checkbox label="Preparation alert" description="Disabled until a preparation time is selected." disabled />
          </div>
        </section>

        <section className="lab-section">
          <h2>Cards</h2>
          <div className="lab-stack">
            <Card>
              <strong>Default village</strong>
              <p className="lab-muted">One builder available</p>
            </Card>
            <Card selected>
              <strong>Selected village</strong>
              <p className="lab-muted">Settings form is open</p>
            </Card>
            <Card disabled>
              <strong>Unavailable action</strong>
              <p className="lab-muted">Waiting for a fresh export</p>
            </Card>
          </div>
        </section>
        <section className="lab-section">
          <h2>Tabs</h2>
          <Tabs label="History section" value={tab} onValueChange={setTab}>
            <Tab value="upgrades">Upgrades</Tab>
            <Tab value="syncs">Syncs</Tab>
          </Tabs>
          <p className="lab-tab-panel">Showing {tab} content. Product routes still own URL changes.</p>
        </section>

        <section className="lab-section wide">
          <h2>Request states</h2>
          <div className="lab-state-grid">
            <RequestState
              title="Loading villages"
              description="Current content stays stable when it is already cached."
              action={<Spinner />}
            />
            <RequestState
              tone="error"
              title="Could not load villages"
              description="The cause remains visible until retry succeeds."
              action={
                <Button size="small" tone="secondary">
                  Retry
                </Button>
              }
            />
            <StaleNotice onRetry={() => undefined}>Showing cached data from 12 minutes ago</StaleNotice>
            <EmptyState
              title="No upgrades match these filters"
              description="Change a filter or sync another village."
              action={
                <Button size="small" tone="secondary">
                  Clear filters
                </Button>
              }
            />
            <Card>
              <div className="lab-stack">
                <Skeleton width="42%" />
                <Skeleton width="85%" />
                <Skeleton width="65%" />
              </div>
            </Card>
          </div>
        </section>

        <section className="lab-section">
          <h2>Dialog</h2>
          <p>Focus is trapped, Escape closes, and mobile presentation becomes a bottom sheet.</p>
          <Dialog>
            <DialogTrigger asChild>
              <Button>Open resource question</Button>
            </DialogTrigger>
            <DialogContent closeLabel="Close resource question">
              <DialogTitle>Resources for the next upgrade?</DialogTitle>
              <DialogDescription>This changes when the preparation alert is sent for Main village.</DialogDescription>
              <DialogBody>
                <Checkbox
                  label="I have enough resources"
                  description="Notify close to completion instead of 60 minutes before."
                />
              </DialogBody>
              <DialogFooter>
                <DialogClose asChild>
                  <Button tone="quiet">Decide later</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button>Save answer</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </section>
        <section className="lab-section">
          <h2>Toast feedback</h2>
          <p>Trigger global, deduplicated feedback without shifting page layout.</p>
          <ToastExamples />
        </section>

        <section className="lab-section wide">
          <h2>Translated and wrapping content</h2>
          <div className="lab-row">
            <Button>업그레이드 알림 설정 저장</Button>
            <Badge tone="warning">마을 데이터를 다시 내보내야 합니다</Badge>
            <Button tone="secondary">Save preparation notification settings</Button>
          </div>
        </section>
      </div>
    </ToastProvider>
  );
}
