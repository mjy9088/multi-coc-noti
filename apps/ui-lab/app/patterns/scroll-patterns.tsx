"use client";

import { Card, ScrollablePane, StatusIndicator } from "@multi-coc/ui";
import { useState } from "react";

const nestedRows = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];

function ScrollOwnershipDemo({ boundary }: { boundary: "handoff" | "contain" }) {
  const [outerTop, setOuterTop] = useState(0);
  const [innerTop, setInnerTop] = useState(0);
  const handoff = boundary === "handoff";
  return (
    <Card className="lab-scroll-demo-card">
      <div>
        <strong>{handoff ? "Handoff at the boundary" : "Independent contained pane"}</strong>
        <p className="lab-muted">
          {handoff
            ? "Scroll the inner list to its end, then keep scrolling: the outer pane continues."
            : "Scroll remains inside this pane at its edge, as required by modal and fixed master/detail surfaces."}
        </p>
      </div>
      <StatusIndicator tone={outerTop > 0 ? "success" : "neutral"}>
        Outer {Math.round(outerTop)} · Inner {Math.round(innerTop)}
      </StatusIndicator>
      <ScrollablePane
        className="lab-scroll-outer"
        aria-label={`${boundary} outer scroll pane`}
        tabIndex={0}
        onScroll={(event) => setOuterTop(event.currentTarget.scrollTop)}
      >
        <p>Outer content before the nested pane</p>
        <ScrollablePane
          className="lab-scroll-inner"
          boundary={boundary}
          aria-label={`${boundary} inner scroll pane`}
          tabIndex={0}
          onScroll={(event) => setInnerTop(event.currentTarget.scrollTop)}
        >
          {nestedRows.map((row, index) => (
            <div key={row}>Nested row {index + 1}</div>
          ))}
        </ScrollablePane>
        <div className="lab-scroll-after">
          <strong>Outer content after the nested pane</strong>
          <span>{handoff ? "This becomes visible after scroll handoff." : "The inner pane does not reveal this."}</span>
        </div>
      </ScrollablePane>
    </Card>
  );
}

export default function ScrollPatterns() {
  return (
    <div className="lab-scroll-pattern-grid">
      <ScrollOwnershipDemo boundary="handoff" />
      <ScrollOwnershipDemo boundary="contain" />
    </div>
  );
}
