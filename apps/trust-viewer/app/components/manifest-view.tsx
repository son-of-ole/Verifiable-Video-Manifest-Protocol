import Link from "next/link";
import { buildRecoveryCardSummary } from "@vvmp/trust-core";
import type { ViewerFixture } from "../lib/viewer-fixtures";

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC"
  }).format(date);
}

function renderRedactionItems(fixture: ViewerFixture) {
  const items: Array<{ key: string; title: string; detail: string }> = [];

  fixture.manifest.redactions.forEach((redaction, index) => {
    items.push({
      key: `explicit-${index}`,
      title: typeof redaction.redaction_id === "string" ? redaction.redaction_id : `redaction_${index + 1}`,
      detail:
        typeof redaction.reason === "string"
          ? redaction.reason
          : typeof redaction.public_mode === "string"
            ? `public mode: ${redaction.public_mode}`
            : "Explicit public redaction record."
    });
  });

  fixture.manifest.sources.forEach((source) => {
    if (source.visibility !== "public") {
      const sourcePublicSummary = (source as Record<string, unknown>).public_summary;
      items.push({
        key: `source-${source.source_id}`,
        title: `${source.source_id} is ${source.visibility}`,
        detail:
          typeof sourcePublicSummary === "string"
            ? sourcePublicSummary
            : "Source details are intentionally limited in the public view."
      });
    }
  });

  fixture.manifest.prompts.forEach((prompt) => {
    if (prompt.visibility !== "public") {
      items.push({
        key: `prompt-${prompt.prompt_id}`,
        title: `${prompt.prompt_id} is ${prompt.visibility}`,
        detail:
          typeof prompt.input_hash === "string"
            ? `Prompt text is withheld, but an input hash is recorded: ${prompt.input_hash}`
            : "Prompt text is intentionally withheld in the public view."
      });
    }
  });

  return items;
}

export function ManifestView({
  fixture,
  routeMode
}: {
  fixture: ViewerFixture;
  routeMode: "manifest" | "trust_code";
}) {
  const manifest = fixture.manifest;
  const summary = fixture.summary;
  const validation = fixture.validation;
  const redactionItems = renderRedactionItems(fixture);
  const recovery = buildRecoveryCardSummary(manifest);

  return (
    <main className="page" data-testid="manifest-view">
      <section className="hero" data-testid="viewer-hero">
        <div className="eyebrow">VVMP Trust Viewer</div>
        <h1>{summary.title}</h1>
        <p>
          This page explains the recorded provenance of how the asset was made. It does not certify
          truth or official status.
        </p>
        <div className="chips">
          <span className="chip" data-testid="route-chip">
            Route: {routeMode === "trust_code" ? "trust code" : "manifest id"}
          </span>
          <span className="chip">Profile: {summary.profileGuess}</span>
          <span className="chip">AI: {validation.trustStates.ai_involvement_state}</span>
          <span className="chip">File State: {validation.trustStates.file_trust_state}</span>
          <span className="chip">Visibility: {summary.visibility}</span>
        </div>
        <div className="actions">
          <Link href="/" className="button button-secondary">
            View Fixture Index
          </Link>
          <Link
            href={`/manifest/${fixture.manifestRouteParam}`}
            className={`button ${routeMode === "manifest" ? "button-active" : ""}`}
          >
            Open Manifest Route
          </Link>
          {fixture.trustRouteParam ? (
            <Link
              href={`/v/${fixture.trustRouteParam}`}
              className={`button ${routeMode === "trust_code" ? "button-active" : ""}`}
            >
              Open Trust-Code Route
            </Link>
          ) : null}
        </div>
      </section>

      <section className="grid">
        <article className="card span-7" data-testid="trust-summary">
          <div className="section-eyebrow">Trust Summary</div>
          <h2>{fixture.label}</h2>
          <p className="muted">{fixture.description}</p>
          <div className="stats">
            <div className="stat">
              <span className="stat-label">Duration</span>
              <span className="stat-value">{summary.durationSeconds}s</span>
            </div>
            <div className="stat">
              <span className="stat-label">Sources</span>
              <span className="stat-value">{summary.sourceCount}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Prompts</span>
              <span className="stat-value">{summary.promptCount}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Tools</span>
              <span className="stat-value">{summary.toolCount}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Segments</span>
              <span className="stat-value">{summary.segmentCount}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Guardrails</span>
              <span className="stat-value">{summary.guardrailCount}</span>
            </div>
          </div>
        </article>

        <article className="card span-5" data-testid="verification-summary">
          <div className="section-eyebrow">Verification</div>
          <h3>Verifier State</h3>
          <div className="list">
            <div className="item">
              <strong>Manifest validity</strong>
              <span className="muted">{validation.valid ? "valid" : "invalid"}</span>
            </div>
            <div className="item">
              <strong>Provenance coverage</strong>
              <span className="muted">{validation.trustStates.provenance_coverage_state}</span>
            </div>
            <div className="item">
              <strong>Guardrail state</strong>
              <span className="muted">{validation.trustStates.guardrail_state}</span>
            </div>
            <div className="item code">
              manifest_id: {manifest.manifest_id}
              {"\n"}
              trust_code: {summary.trustCode ?? "not assigned"}
            </div>
          </div>
        </article>

        <article className="card span-6" data-testid="source-list">
          <div className="section-eyebrow">Sources</div>
          <h3>Source List</h3>
          <div className="list">
            {manifest.sources.map((source) => {
              const sourcePublicSummary = (source as Record<string, unknown>).public_summary;

              return (
                <div key={source.source_id} className="item">
                  <strong>{source.title ?? source.source_id}</strong>
                  <span className="muted">
                    {source.source_type} • visibility: {source.visibility}
                  </span>
                  {source.canonical_ref ? <span className="muted code">{source.canonical_ref}</span> : null}
                  {source.display_text ? <span className="prose">{source.display_text}</span> : null}
                  {typeof sourcePublicSummary === "string" ? (
                    <span className="prose">{sourcePublicSummary}</span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </article>

        <article className="card span-6" data-testid="ai-disclosure">
          <div className="section-eyebrow">AI Disclosure</div>
          <h3>Tools and Oversight</h3>
          <div className="list">
            <div className="item">
              <strong>Human oversight</strong>
              <span className="muted">{manifest.creation.human_oversight_level}</span>
            </div>
            {manifest.tools.map((tool) => (
              <div key={tool.tool_id} className="item">
                <strong>{tool.tool_type}</strong>
                <span className="muted">
                  purpose: {tool.purpose}
                  {tool.provider ? ` • provider: ${tool.provider}` : ""}
                  {tool.model_identifier ? ` • model: ${tool.model_identifier}` : ""}
                </span>
                {tool.human_oversight_level ? (
                  <span className="muted">oversight: {tool.human_oversight_level}</span>
                ) : null}
              </div>
            ))}
          </div>
        </article>

        <article className="card span-6" data-testid="guardrail-summary">
          <div className="section-eyebrow">Guardrails</div>
          <h3>Guardrail Summary</h3>
          <div className="list">
            {manifest.guardrails.length > 0 ? (
              manifest.guardrails.map((guardrail) => (
                <div key={guardrail.guardrail_event_id} className="item">
                  <strong>{guardrail.check_type}</strong>
                  <span className="muted">
                    {guardrail.verdict}
                    {guardrail.risk_level ? ` • risk: ${guardrail.risk_level}` : ""}
                    {guardrail.review_mode ? ` • review: ${guardrail.review_mode}` : ""}
                  </span>
                  <span className="muted code">
                    {guardrail.policy_profile} @ {guardrail.policy_version}
                  </span>
                  {guardrail.public_summary ? <span className="prose">{guardrail.public_summary}</span> : null}
                </div>
              ))
            ) : (
              <div className="item">
                <strong>No guardrail records declared</strong>
                <span className="muted">
                  This fixture does not include review events beyond the main manifest metadata.
                </span>
              </div>
            )}
          </div>
        </article>

        <article className="card span-6" data-testid="redaction-notices">
          <div className="section-eyebrow">Redactions</div>
          <h3>Redaction Notices</h3>
          <div className="list">
            {redactionItems.length > 0 ? (
              redactionItems.map((item) => (
                <div key={item.key} className="item">
                  <strong>{item.title}</strong>
                  <span className="muted">{item.detail}</span>
                </div>
              ))
            ) : (
              <div className="item">
                <strong>No public redactions declared</strong>
                <span className="muted">
                  All current fixture fields are already public in this viewer route.
                </span>
              </div>
            )}
          </div>
        </article>

        <article className="card span-12" data-testid="timeline-source-map">
          <div className="section-eyebrow">Timeline</div>
          <h3>Timeline Source Map</h3>
          <div className="timeline">
            {manifest.timeline.map((segment) => (
              <div key={segment.segment_id} className="timeline-item">
                <div className="timeline-time">
                  {segment.time_range.start}s - {segment.time_range.end}s
                </div>
                <p>{segment.narration_text ?? segment.visible_text ?? "No public text available."}</p>
                <div className="tag-row">
                  <span className="tag">claim: {segment.claim_type}</span>
                  <span className="tag">
                    sources: {segment.source_ids?.length ? segment.source_ids.join(", ") : "none"}
                  </span>
                  <span className="tag">
                    prompts: {segment.prompt_ids?.length ? segment.prompt_ids.join(", ") : "none"}
                  </span>
                  <span className="tag">
                    guardrails:{" "}
                    {segment.guardrail_event_ids?.length ? segment.guardrail_event_ids.join(", ") : "none"}
                  </span>
                  <span className="tag">
                    edits: {segment.edit_event_ids?.length ? segment.edit_event_ids.join(", ") : "none"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="card span-5" data-testid="version-history">
          <div className="section-eyebrow">History</div>
          <h3>Version History</h3>
          <div className="list">
            {fixture.versionHistory.map((entry) => (
              <div key={entry.version_id} className="item">
                <strong>{entry.version_id}</strong>
                <span className="muted">{formatDate(entry.published_at)}</span>
                <span className="muted">{entry.note}</span>
                {entry.current ? <span className="muted">current fixture version</span> : null}
              </div>
            ))}
          </div>
        </article>

        <article className="card span-7" data-testid="publication-signature">
          <div className="section-eyebrow">Publication</div>
          <h3>Publication and Signature</h3>
          <div className="list">
            <div className="item">
              <strong>Publication status</strong>
              <span className="muted">
                {typeof manifest.publication.status === "string"
                  ? manifest.publication.status
                  : "not declared"}
              </span>
            </div>
            <div className="item">
              <strong>Trust page</strong>
              <span className="muted code">
                {typeof manifest.links.trust_page === "string"
                  ? manifest.links.trust_page
                  : "not declared"}
              </span>
            </div>
            <div className="item">
              <strong>Signatures</strong>
              <span className="muted">
                {manifest.signatures.length > 0 ? `${manifest.signatures.length} declared` : "none declared"}
              </span>
            </div>
          </div>
        </article>

        <article className="card span-5" data-testid="recovery-record">
          <div className="section-eyebrow">Recovery</div>
          <h3>Recovery Record</h3>
          <div className="list">
            <div className="item">
              <strong>Visible trust code</strong>
              <span className="muted code">{recovery.trust_code ?? "not assigned"}</span>
            </div>
            <div className="item">
              <strong>QR target URL</strong>
              <span className="muted code">{recovery.qr_target_url ?? "not declared"}</span>
            </div>
            <div className="item">
              <strong>Recovery-capable</strong>
              <span className="muted">
                {recovery.recovery_capable
                  ? "yes, a reposted copy can be linked through a visible recovery path"
                  : "not yet"}
              </span>
            </div>
            <div className="item">
              <strong>Rendition note</strong>
              <span className="muted">
                A recovered copy may resolve to this trust record even when its binary hash no longer
                matches the original export.
              </span>
            </div>
          </div>
        </article>

        <article className="card span-12" data-testid="technical-json-pane">
          <div className="section-eyebrow">Technical Verifier</div>
          <h3>Technical JSON Pane</h3>
          <div className="inspector-grid">
            <div className="inspector-card">
              <strong>Validation</strong>
              <pre className="code-block">{JSON.stringify(validation, null, 2)}</pre>
            </div>
            <div className="inspector-card">
              <strong>Raw manifest</strong>
              <pre className="code-block">{JSON.stringify(manifest, null, 2)}</pre>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}
