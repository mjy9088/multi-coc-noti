"use client";

import {
  ActionBar,
  Badge,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  CardTitle,
  ChartCard,
  ChartCardBody,
  ChartCardHeader,
  ChartCardTitle,
  ChartLegend,
  ChartLegendItem,
  Checkbox,
  Cluster,
  ContentSection,
  DataList,
  DataListItem,
  DetailPane,
  DetailPaneBackdrop,
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
  Disclosure,
  DisclosureContent,
  DisclosureSummary,
  EmptyState,
  EntityHeader,
  EntityHeaderActions,
  EntityHeaderIdentity,
  EntityHeaderMeta,
  EntityHeaderTitle,
  Field,
  FormGrid,
  IconButton,
  Input,
  InputField,
  KeyValueGrid,
  KeyValueItem,
  Label,
  MasterDetailLayout,
  MasterPane,
  NavLink,
  PageContainer,
  PageIntro,
  Progress,
  RadioGroup,
  RadioGroupItem,
  RequestState,
  ResponsiveGrid,
  ScrollablePane,
  SelectField,
  SelectionList,
  SelectionListContent,
  SelectionListDescription,
  SelectionListItem,
  SelectionListLeading,
  SelectionListTitle,
  SelectionListTrailing,
  Separator,
  Skeleton,
  Spinner,
  SplitLayout,
  Stack,
  StaleNotice,
  Stat,
  StatGrid,
  StatusIndicator,
  Tab,
  Tabs,
  TextareaField,
  Timeline,
  TimelineContent,
  TimelineItem,
  TimelineMarker,
  TimelineMeta,
  ToastProvider,
  ToggleGroup,
  ToggleGroupItem,
  Toolbar,
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
  const [radio, setRadio] = useState("all");
  const [toggle, setToggle] = useState("all");
  const [selectedVillage, setSelectedVillage] = useState("main");
  const [detailOpen, setDetailOpen] = useState(false);
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
        <section id="navigation-and-choices" className="lab-section wide">
          <h2>Navigation and choices</h2>
          <p>
            Links preserve navigation semantics; radio and toggle groups provide keyboard-accessible single choices.
          </p>
          <div className="lab-row">
            <NavLink href="#navigation-and-choices" active>
              Dashboard
            </NavLink>
            <RadioGroup value={radio} onValueChange={setRadio} aria-label="Availability">
              <RadioGroupItem value="all">All</RadioGroupItem>
              <RadioGroupItem value="home">Home available</RadioGroupItem>
              <RadioGroupItem value="any">Any available</RadioGroupItem>
            </RadioGroup>
            <ToggleGroup type="single" value={toggle} onValueChange={(value) => value && setToggle(value)}>
              <ToggleGroupItem value="all">All</ToggleGroupItem>
              <ToggleGroupItem value="war">War</ToggleGroupItem>
              <ToggleGroupItem value="farm">Farm</ToggleGroupItem>
            </ToggleGroup>
          </div>
        </section>
        <section className="lab-section">
          <h2>Structured card</h2>
          <Card>
            <CardHeader>
              <CardTitle>Builder availability</CardTitle>
              <Badge tone="success">2 free</Badge>
            </CardHeader>
            <CardBody>
              <p>Header, body, and footer keep repeated surface structure consistent.</p>
            </CardBody>
            <CardFooter>
              <Button size="small" tone="secondary">
                Open village
              </Button>
            </CardFooter>
          </Card>
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
        <section className="lab-section wide">
          <h2>Layout compositions</h2>
          <p>
            Headers, actions, toolbars, and responsive grids arrange arbitrary feature content without owning its data.
          </p>
          <Stack>
            <PageIntro
              eyebrow="Dashboard"
              title="Manage every village at a glance"
              description="Long descriptions wrap while actions keep a predictable alignment at narrow widths."
              actions={
                <>
                  <Button tone="secondary">Display options</Button>
                  <Button>Quick Paste</Button>
                </>
              }
            />
            <Toolbar aria-label="Village filters">
              <StatusIndicator tone="success">36 villages synced</StatusIndicator>
              <Button size="small" tone="secondary">
                Filters
              </Button>
            </Toolbar>
            <ContentSection
              title="Available villages"
              description="Reusable section context stays separate from page identity."
              actions={
                <Button size="small" tone="quiet">
                  View all
                </Button>
              }
              spacing="compact"
            >
              <ResponsiveGrid minItemWidth="12rem">
                <Card>Main village</Card>
                <Card>Builder focus</Card>
                <Card>War mini</Card>
              </ResponsiveGrid>
            </ContentSection>
          </Stack>
        </section>
        <section className="lab-section wide">
          <h2>Data-display patterns</h2>
          <p>Semantic collections provide the middle layer between primitives and product-owned village components.</p>
          <div className="lab-stack">
            <StatGrid>
              <Stat label="Villages" value="36" description="Across 5 groups" />
              <Stat label="Builders free" value="12" description="Home and Builder Base" />
              <Stat label="Update needed" value="3" description="Older than the observed finish" />
            </StatGrid>
            <KeyValueGrid>
              <KeyValueItem label="Player tag" value="#2ABCDEF" />
              <KeyValueItem label="Town Hall" value="17" />
              <KeyValueItem label="Last export" value="2026-07-21 18:42" />
            </KeyValueGrid>
            <DataList>
              <DataListItem selected>
                <EntityHeader>
                  <EntityHeaderIdentity>
                    <EntityHeaderTitle>Main village</EntityHeaderTitle>
                    <EntityHeaderMeta>
                      <span>#2ABCDEF</span>
                      <span>Town Hall 17</span>
                    </EntityHeaderMeta>
                  </EntityHeaderIdentity>
                  <EntityHeaderActions>
                    <StatusIndicator tone="success">2 builders free</StatusIndicator>
                    <Button size="small" tone="secondary">
                      Open
                    </Button>
                  </EntityHeaderActions>
                </EntityHeader>
              </DataListItem>
              <DataListItem disabled>
                <EntityHeader>
                  <EntityHeaderIdentity>
                    <EntityHeaderTitle>Stale village</EntityHeaderTitle>
                    <EntityHeaderMeta>Needs a fresh export before planning</EntityHeaderMeta>
                  </EntityHeaderIdentity>
                  <StatusIndicator tone="warning">Update needed</StatusIndicator>
                </EntityHeader>
              </DataListItem>
            </DataList>
            <SelectionList aria-label="Villages">
              {[
                { id: "main", name: "Main village", tag: "#2ABCDEF", tone: "success" as const },
                { id: "builder", name: "Builder focus", tag: "#8XYZ123", tone: "warning" as const },
              ].map((village) => (
                <SelectionListItem
                  key={village.id}
                  selected={selectedVillage === village.id}
                  onClick={() => setSelectedVillage(village.id)}
                >
                  <SelectionListLeading>
                    <StatusIndicator tone={village.tone} aria-label={`${village.name} status`} />
                  </SelectionListLeading>
                  <SelectionListContent>
                    <SelectionListTitle>{village.name}</SelectionListTitle>
                    <SelectionListDescription>{village.tag} · War group</SelectionListDescription>
                  </SelectionListContent>
                  <SelectionListTrailing>
                    <Badge>{village.id === "main" ? "TH 17" : "BH 10"}</Badge>
                  </SelectionListTrailing>
                </SelectionListItem>
              ))}
            </SelectionList>
          </div>
        </section>
        <section className="lab-section">
          <h2>Timeline</h2>
          <Timeline>
            <TimelineItem>
              <TimelineMarker tone="success" />
              <TimelineContent>
                <strong>Export imported</strong>
                <span className="lab-muted">4 active upgrades detected</span>
              </TimelineContent>
              <TimelineMeta>18:42</TimelineMeta>
            </TimelineItem>
            <TimelineItem>
              <TimelineMarker tone="info" />
              <TimelineContent>
                <strong>Profile synchronized</strong>
                <span className="lab-muted">League and donations refreshed</span>
              </TimelineContent>
              <TimelineMeta>18:44</TimelineMeta>
            </TimelineItem>
          </Timeline>
        </section>
        <section className="lab-section">
          <h2>Chart frame and scroll pane</h2>
          <ChartCard>
            <ChartCardHeader>
              <ChartCardTitle>Active upgrades</ChartCardTitle>
              <ChartLegend>
                <ChartLegendItem tone="accent">Home</ChartLegendItem>
                <ChartLegendItem tone="info">All bases</ChartLegendItem>
              </ChartLegend>
            </ChartCardHeader>
            <ChartCardBody>
              <ScrollablePane className="lab-chart-scroll">
                <div className="lab-chart-placeholder" aria-label="Example chart">
                  <i style={{ height: "38%" }} />
                  <i style={{ height: "74%" }} />
                  <i style={{ height: "52%" }} />
                  <i style={{ height: "88%" }} />
                  <i style={{ height: "64%" }} />
                  <i style={{ height: "46%" }} />
                </div>
              </ScrollablePane>
            </ChartCardBody>
          </ChartCard>
        </section>
        <section className="lab-section wide">
          <h2>Responsive master/detail</h2>
          <p>Desktop keeps both panes aligned; compact viewports open the detail as a bottom sheet.</p>
          <PageContainer className="lab-contained-page">
            <MasterDetailLayout className="lab-master-detail-demo">
              <MasterPane>
                <Stack>
                  <strong>Villages</strong>
                  <SelectionList aria-label="Master detail villages">
                    <SelectionListItem selected onClick={() => setDetailOpen(true)}>
                      <SelectionListContent>
                        <SelectionListTitle>Main village</SelectionListTitle>
                        <SelectionListDescription>#2ABCDEF</SelectionListDescription>
                      </SelectionListContent>
                    </SelectionListItem>
                  </SelectionList>
                </Stack>
              </MasterPane>
              <DetailPaneBackdrop open={detailOpen} label="Close village detail" onClick={() => setDetailOpen(false)} />
              <DetailPane open={detailOpen}>
                <Stack>
                  <Cluster justify="between">
                    <strong>Main village settings</strong>
                    <Button size="small" tone="secondary" onClick={() => setDetailOpen(false)}>
                      Close
                    </Button>
                  </Cluster>
                  <Field>
                    <Label>Display name</Label>
                    <Input defaultValue="Main village" />
                  </Field>
                  <Progress label="Builder workload" value={4} max={6} valueLabel="4 / 6 active" />
                </Stack>
              </DetailPane>
            </MasterDetailLayout>
          </PageContainer>
        </section>
        <section className="lab-section wide">
          <h2>Progress and disclosure</h2>
          <ResponsiveGrid minItemWidth="15rem">
            <Stack>
              <Progress label="Archer Queen" value={72} valueLabel="4h 18m remaining" />
              <Progress tone="warning" label="Laboratory" value={35} valueLabel="35%" />
              <Progress tone="info" label="Waiting for export" valueLabel="Indeterminate" />
            </Stack>
            <Disclosure>
              <DisclosureSummary>Display options</DisclosureSummary>
              <DisclosureContent>
                <Stack gap="small">
                  <Checkbox label="Infer idle Goblin Researcher" defaultChecked />
                  <Checkbox label="Show upgrade-ready villages first" />
                </Stack>
              </DisclosureContent>
            </Disclosure>
          </ResponsiveGrid>
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
          <FormGrid columns="two">
            <InputField
              label="Display name"
              description="Shown throughout Dashboard instead of the in-game name."
              defaultValue="Main village"
            />
            <InputField
              label="Player tag"
              description="Include or omit the leading #."
              error="Use only valid tag characters."
              defaultValue="INVALID!"
            />
            <SelectField label="Resource policy" defaultValue="unknown">
              <option value="unknown">Ask after import</option>
              <option value="enough">Enough resources</option>
              <option value="short">Resources needed</option>
            </SelectField>
            <TextareaField label="Export JSON" placeholder="Paste export JSON" />
          </FormGrid>
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
