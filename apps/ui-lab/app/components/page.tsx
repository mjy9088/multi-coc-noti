import ComponentsShowcase from "./showcase";

export default function ComponentsPage() {
  return (
    <>
      <header className="lab-page-heading">
        <p className="lab-kicker">Components</p>
        <h1>One implementation, every state.</h1>
        <p>The catalogue imports production primitives from @multi-coc/ui and keeps interactive states live.</p>
      </header>
      <ComponentsShowcase />
    </>
  );
}
