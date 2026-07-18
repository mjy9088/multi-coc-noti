"use client";

import { Field, Label, Select, Tab, Tabs } from "@multi-coc/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export type FlowControls = {
  scenario: string;
  viewport: "desktop" | "mobile";
  latency: "instant" | "slow";
  result: "success" | "failure";
};

const flowRoutes = [
  ["/flows/import", "Import"],
  ["/flows/settings", "Settings"],
  ["/flows/dashboard", "Dashboard"],
  ["/flows/history", "History"],
] as const;

export function FlowWorkbench({
  title,
  description,
  scenarios,
  controls,
  onChange,
  children,
}: {
  title: string;
  description: string;
  scenarios: Array<{ value: string; label: string }>;
  controls: FlowControls;
  onChange: (next: FlowControls) => void;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const update = <K extends keyof FlowControls>(key: K, value: FlowControls[K]) =>
    onChange({ ...controls, [key]: value });
  return (
    <>
      <header className="lab-page-heading">
        <p className="lab-kicker">Flow simulator</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </header>
      <nav className="flow-nav" aria-label="Simulated product flows">
        {flowRoutes.map(([href, label]) => (
          <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}>
            {label}
          </Link>
        ))}
      </nav>
      <section className="flow-controls" aria-label="Scenario controls">
        <Field>
          <Label>Scenario</Label>
          <Select value={controls.scenario} onChange={(event) => update("scenario", event.target.value)}>
            {scenarios.map((scenario) => (
              <option key={scenario.value} value={scenario.value}>
                {scenario.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field>
          <Label>Viewport</Label>
          <Select
            value={controls.viewport}
            onChange={(event) => update("viewport", event.target.value as FlowControls["viewport"])}
          >
            <option value="desktop">Desktop canvas</option>
            <option value="mobile">Mobile canvas</option>
          </Select>
        </Field>
        <Field>
          <Label>Latency</Label>
          <Select
            value={controls.latency}
            onChange={(event) => update("latency", event.target.value as FlowControls["latency"])}
          >
            <option value="instant">Instant</option>
            <option value="slow">Slow / pending</option>
          </Select>
        </Field>
        <Field>
          <Label>Result</Label>
          <Select
            value={controls.result}
            onChange={(event) => update("result", event.target.value as FlowControls["result"])}
          >
            <option value="success">Success</option>
            <option value="failure">Failure</option>
          </Select>
        </Field>
      </section>
      <div className="flow-stage-shell">
        <div className="flow-stage-meta">
          <span>{controls.viewport === "mobile" ? "390 px" : "Responsive desktop"}</span>
          <span>Fixture only · no API calls</span>
        </div>
        <div className="flow-stage" data-viewport={controls.viewport}>
          {children}
        </div>
      </div>
    </>
  );
}

export function StepTabs({
  value,
  onChange,
  steps,
}: {
  value: string;
  onChange: (value: string) => void;
  steps: Array<[string, string]>;
}) {
  return (
    <Tabs label="Flow steps" value={value} onValueChange={onChange}>
      {steps.map(([id, label]) => (
        <Tab key={id} value={id}>
          {label}
        </Tab>
      ))}
    </Tabs>
  );
}
