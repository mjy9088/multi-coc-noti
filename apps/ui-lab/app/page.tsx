import type { CSSProperties } from "react";

const swatches = [
  ["Canvas", "var(--ui-color-canvas)"],
  ["Surface", "var(--ui-color-surface)"],
  ["Inset", "var(--ui-color-surface-inset)"],
  ["Accent", "var(--ui-color-accent)"],
  ["Danger", "var(--ui-color-danger)"],
  ["Warning", "var(--ui-color-warning)"],
  ["Information", "var(--ui-color-info)"],
] as const;

export default function FoundationsPage() {
  return (
    <>
      <header className="lab-page-heading">
        <p className="lab-kicker">Foundations</p>
        <h1>Adjust the system before the screens.</h1>
        <p>Semantic tokens are shared with Dashboard. Changes here are visible across every owned primitive.</p>
      </header>
      <div className="lab-grid">
        <section className="lab-section wide">
          <h2>Semantic color</h2>
          <p>Names describe roles so the palette can change without rewriting component APIs.</p>
          <div className="lab-swatches">
            {swatches.map(([name, color]) => (
              <div className="lab-swatch" key={name} style={{ "--swatch": color } as CSSProperties}>
                <span>{name}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="lab-section">
          <h2>Typography</h2>
          <p>Use both languages and numeric content while choosing scale and rhythm.</p>
          <div className="lab-stack">
            <strong style={{ fontSize: "1.6rem" }}>Village overview</strong>
            <strong style={{ fontSize: "1.6rem" }}>마을 업그레이드 현황</strong>
            <span>Builder available in 1h 42m · 장인 1시간 42분 후 사용 가능</span>
            <code>#2ABC · 2026-07-18 18:30</code>
          </div>
        </section>
        <section className="lab-section">
          <h2>Spacing and shape</h2>
          <p>Cards use semantic spacing, radius, and shadow instead of screen-specific values.</p>
          <div className="lab-stack">
            <div style={{ height: "var(--ui-space-2)", width: "25%", background: "var(--ui-color-accent)" }} />
            <div style={{ height: "var(--ui-space-3)", width: "50%", background: "var(--ui-color-accent)" }} />
            <div style={{ height: "var(--ui-space-4)", width: "75%", background: "var(--ui-color-accent)" }} />
            <div style={{ height: "var(--ui-space-5)", width: "100%", background: "var(--ui-color-accent)" }} />
          </div>
        </section>
      </div>
    </>
  );
}
