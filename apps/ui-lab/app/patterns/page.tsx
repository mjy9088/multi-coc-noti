export default function PatternsPage() {
  return (
    <>
      <header className="lab-page-heading">
        <p className="lab-kicker">Route patterns</p>
        <h1>The shell should not blink.</h1>
        <p>Type a note or increment the Layout counter above, then move between routes. Both values must remain.</p>
      </header>
      <div className="lab-grid">
        <section className="lab-section lab-route-card">
          <h2>Persistent layout</h2>
          <p>App-level navigation and controls live above the route segment and remain mounted.</p>
        </section>
        <section className="lab-section lab-route-card">
          <h2>Route content</h2>
          <p>Only this catalogue page changes. Focus, active navigation, and responsive geometry remain inspectable.</p>
        </section>
        <section className="lab-section wide">
          <h2>Manual transition checklist</h2>
          <ul className="lab-checklist">
            <li>The header height and navigation positions do not jump.</li>
            <li>The active route changes without briefly disappearing.</li>
            <li>The persistent input and counter retain their values.</li>
            <li>Keyboard focus remains visible and navigation remains reachable.</li>
            <li>Narrow viewports scroll navigation horizontally without page overflow.</li>
          </ul>
        </section>
      </div>
    </>
  );
}
