"use client";

import { Badge, Field, Label, Select } from "@multi-coc/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export type CompositionVariant = {
  value: string;
  label: string;
  status: "exploring" | "preferred" | "rejected";
  rationale: string;
};
const routes = [
  ["/compositions/import", "Import"],
  ["/compositions/dashboard", "Dashboard"],
  ["/compositions/settings", "Village settings"],
  ["/compositions/history", "History"],
] as const;

export function CompositionWorkbench({
  title,
  question,
  criteria,
  variants,
  variant,
  viewport,
  scale,
  onVariant,
  onViewport,
  onScale,
  extraControls,
  children,
}: {
  title: string;
  question: string;
  criteria: string[];
  variants: CompositionVariant[];
  variant: string;
  viewport: "desktop" | "mobile";
  scale: "representative" | "many";
  onVariant: (value: string) => void;
  onViewport: (value: "desktop" | "mobile") => void;
  onScale: (value: "representative" | "many") => void;
  extraControls?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const selected = variants.find((item) => item.value === variant) || variants[0];
  const tone = selected.status === "preferred" ? "success" : selected.status === "rejected" ? "danger" : "warning";
  return (
    <>
      <header className="lab-page-heading">
        <p className="lab-kicker">Composition lab</p>
        <h1>{title}</h1>
        <p>
          Compare information architecture with one fixture. These variants are disposable review artifacts, not
          production components.
        </p>
      </header>
      <nav className="flow-nav" aria-label="Composition studies">
        {routes.map(([href, label]) => (
          <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}>
            {label}
          </Link>
        ))}
      </nav>
      <div className="composition-review">
        <section>
          <span className="composition-label">Core question</span>
          <strong>{question}</strong>
        </section>
        <section>
          <span className="composition-label">Success criteria</span>
          <ul>
            {criteria.map((criterion) => (
              <li key={criterion}>{criterion}</li>
            ))}
          </ul>
        </section>
      </div>
      <section
        className={`flow-controls composition-controls${extraControls ? " has-extra" : ""}`}
        aria-label="Composition controls"
      >
        <Field>
          <Label>Variant</Label>
          <Select value={variant} onChange={(event) => onVariant(event.target.value)}>
            {variants.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field>
          <Label>Viewport</Label>
          <Select value={viewport} onChange={(event) => onViewport(event.target.value as "desktop" | "mobile")}>
            <option value="desktop">Desktop canvas</option>
            <option value="mobile">Mobile canvas</option>
          </Select>
        </Field>
        <Field>
          <Label>Data scale</Label>
          <Select value={scale} onChange={(event) => onScale(event.target.value as "representative" | "many")}>
            <option value="representative">Representative</option>
            <option value="many">Dozens / long lists</option>
          </Select>
        </Field>
        {extraControls}
        <div className="composition-decision">
          <span className="composition-label">Decision</span>
          <Badge tone={tone}>{selected.status}</Badge>
          <p>{selected.rationale}</p>
        </div>
      </section>
      <div className="flow-stage-shell">
        <div className="flow-stage-meta">
          <span>{selected.label}</span>
          <span>{scale === "many" ? "Dozens of records" : "Representative fixture"} · layout only</span>
        </div>
        <div className="flow-stage composition-stage" data-viewport={viewport} data-variant={variant}>
          {children}
        </div>
      </div>
    </>
  );
}
