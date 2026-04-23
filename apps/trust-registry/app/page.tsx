export default function Page() {
  return (
    <main className="page">
      <section className="hero">
        <div className="eyebrow">VVMP Reference Registry</div>
        <h1>Publish, resolve, and verify VVMP manifests.</h1>
        <p>
          This app exposes the reference registry routes for manifest publication, trust-code
          resolution, version history, asset-hash lookup, recovery-locator lookup, verification,
          and public trust-page resolution.
        </p>
        <div className="chip-row">
          <div className="chip code">POST /api/v1/manifests</div>
          <div className="chip code">GET /api/v1/manifests/[manifestId]</div>
          <div className="chip code">GET /api/v1/trust-codes/[trustCode]</div>
          <div className="chip code">GET /api/v1/recovery-locators/[method]/[value]</div>
          <div className="chip code">POST /api/v1/verify</div>
        </div>
      </section>
    </main>
  );
}
