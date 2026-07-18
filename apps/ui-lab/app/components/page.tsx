import { Button } from "@multi-coc/ui";

export default function ComponentsPage() {
  return (
    <>
      <header className="lab-page-heading">
        <p className="lab-kicker">Components</p>
        <h1>One implementation, every state.</h1>
        <p>The catalogue imports components from @multi-coc/ui; it never keeps a display-only copy.</p>
      </header>
      <div className="lab-grid">
        <section className="lab-section wide">
          <h2>Button tones</h2>
          <p>Semantic tones remain stable if the visual palette changes.</p>
          <div className="lab-row">
            <Button>Save changes</Button>
            <Button tone="secondary">Review export</Button>
            <Button tone="quiet">Cancel</Button>
            <Button tone="danger">Delete village</Button>
          </div>
        </section>
        <section className="lab-section">
          <h2>Size</h2>
          <div className="lab-row">
            <Button size="small">Small</Button>
            <Button size="medium">Medium</Button>
            <Button size="large">Large</Button>
          </div>
        </section>
        <section className="lab-section">
          <h2>Async state</h2>
          <div className="lab-row">
            <Button pending>Saving…</Button>
            <Button disabled>Unavailable</Button>
          </div>
        </section>
        <section className="lab-section wide">
          <h2>Translated and wrapping content</h2>
          <div className="lab-row">
            <Button>업그레이드 알림 설정 저장</Button>
            <Button tone="secondary">Save preparation notification settings</Button>
          </div>
        </section>
      </div>
    </>
  );
}
