import Link from "next/link";
import { listViewerFixtures } from "./lib/viewer-fixtures";

export default async function Page() {
  const fixtures = await listViewerFixtures();
  return (
    <main className="page" data-testid="viewer-home">
      <section className="hero">
        <div className="eyebrow">VVMP Reference Viewer</div>
        <h1>Verifiable Video Manifest Protocol</h1>
        <p>
          Fixture-backed trust pages for real VVMP manifests. These routes stay close to the
          protocol so the viewer does not drift away from the spec, schema, and conformance corpus.
        </p>
        <div className="chips">
          <span className="chip">Routes: /manifest/[manifestId]</span>
          <span className="chip">Routes: /v/[trustCode]</span>
          <span className="chip">Fixtures: {fixtures.length}</span>
        </div>
      </section>

      <section className="grid">
        <article className="card span-7" data-testid="viewer-goals">
          <div className="section-eyebrow">Viewer Goals</div>
          <h2>What this reference app should prove</h2>
          <p className="muted">
            The docs call for a trust viewer that helps both non-technical and technical users.
            This app now provides fixture-backed trust-code and manifest-id routes, timeline
            source maps, redaction notices, guardrail summaries, and a technical JSON pane.
          </p>
          <div className="stats">
            <div className="stat">
              <span className="stat-label">Manifest Routes</span>
              <span className="stat-value">{fixtures.length}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Trust-Code Routes</span>
              <span className="stat-value">
                {fixtures.filter((fixture) => fixture.trustRouteParam).length}
              </span>
            </div>
            <div className="stat">
              <span className="stat-label">Registry-Backed</span>
              <span className="stat-value">
                {fixtures.filter((fixture) => fixture.summary.profileGuess === "registry_backed").length}
              </span>
            </div>
            <div className="stat">
              <span className="stat-label">Redacted Cases</span>
              <span className="stat-value">
                {
                  fixtures.filter((fixture) =>
                    fixture.manifest.sources.some((source) => source.visibility !== "public") ||
                    fixture.manifest.prompts.some((prompt) => prompt.visibility !== "public")
                  ).length
                }
              </span>
            </div>
          </div>
        </article>

        <article className="card span-5" data-testid="viewer-coverage">
          <div className="section-eyebrow">Protocol Surface</div>
          <h3>Viewer Coverage</h3>
          <div className="list">
            <div className="item">
              <strong>Public summary</strong>
              Every fixture route includes a plain-language trust summary and disclosure state.
            </div>
            <div className="item">
              <strong>Timeline source map</strong>
              Segment cards show sources, prompts, edits, and guardrail references.
            </div>
            <div className="item">
              <strong>Technical verifier</strong>
              Raw manifest JSON and validation output stay visible for developer inspection.
            </div>
          </div>
        </article>

        <article className="card span-12" data-testid="fixture-index">
          <div className="section-eyebrow">Fixture Index</div>
          <h3>Available Viewer Fixtures</h3>
          <div className="list">
            {fixtures.map((fixture) => (
              <div key={fixture.id} className="item" data-testid={`fixture-item-${fixture.id}`}>
                <strong>{fixture.label}</strong>
                <span className="muted">{fixture.description}</span>
                <span className="muted">
                  profile: {fixture.summary.profileGuess} • file state:{" "}
                  {fixture.validation.trustStates.file_trust_state}
                </span>
                <div className="tag-row">
                  <span className="tag">manifest: {fixture.manifest.manifest_id}</span>
                  {fixture.summary.trustCode ? <span className="tag">trust: {fixture.summary.trustCode}</span> : null}
                </div>
                <div className="actions actions-inline">
                  <Link href={`/manifest/${fixture.manifestRouteParam}`} className="button button-secondary">
                    Open Manifest Route
                  </Link>
                  {fixture.trustRouteParam ? (
                    <Link href={`/v/${fixture.trustRouteParam}`} className="button button-secondary">
                      Open Trust-Code Route
                    </Link>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
