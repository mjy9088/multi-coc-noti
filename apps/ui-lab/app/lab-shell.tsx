"use client";

import { Button } from "@multi-coc/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useState } from "react";

const routes = [
  ["/", "Foundations"],
  ["/components", "Components"],
  ["/patterns", "Route patterns"],
  ["/flows/import", "Flow lab"],
  ["/compositions/import", "Composition lab"],
] as const;

export function LabShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [layoutValue, setLayoutValue] = useState(0);
  const [note, setNote] = useState("");

  return (
    <div className="lab-shell">
      <header className="lab-header">
        <div className="lab-brand">
          <strong>Multi CoC UI Lab</strong>
          <span>Shared tokens, primitives, and persistent App Router layout</span>
        </div>
        <div className="lab-layout-state">
          <label htmlFor="layout-note">Persistent layout note</label>
          <input
            id="layout-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Type, then change route"
          />
          <Button size="small" tone="secondary" onClick={() => setLayoutValue((value) => value + 1)}>
            Layout {layoutValue}
          </Button>
        </div>
        <nav className="lab-nav" aria-label="UI Lab sections">
          {routes.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              aria-current={
                pathname === href ||
                (href.startsWith("/flows") && pathname.startsWith("/flows")) ||
                (href.startsWith("/compositions") && pathname.startsWith("/compositions"))
                  ? "page"
                  : undefined
              }
            >
              {label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="lab-main">{children}</main>
    </div>
  );
}
