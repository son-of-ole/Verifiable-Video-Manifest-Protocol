import { summarizeManifest } from "@vvmp/trust-core";
import { notFound } from "next/navigation";
import { getRegistry } from "../../lib/registry";

export const dynamic = "force-dynamic";

export default async function TrustCodePage({
  params
}: {
  params: Promise<{ trustCode: string }>;
}) {
  const { trustCode } = await params;
  const registry = getRegistry(process.env.VVMP_REGISTRY_BASE_URL);

  try {
    const envelope = await registry.getManifestByTrustCode(decodeURIComponent(trustCode));
    const summary = summarizeManifest(envelope.manifest);

    return (
      <main className="page">
        <section className="hero">
          <div className="eyebrow">Public Trust Page</div>
          <h1>{summary.title}</h1>
          <p>
            Trust code {summary.trustCode ?? trustCode} resolves to manifest {summary.manifestId}.
          </p>
          <div className="chip-row">
            <div className="chip">Version: {envelope.version_id}</div>
            <div className="chip">Profile: {summary.profileGuess}</div>
            <div className="chip">AI: {summary.aiInvolvement}</div>
            <div className="chip">Visibility: {summary.visibility}</div>
          </div>
        </section>

        <section className="grid">
          <article className="card span-7">
            <h2>Trust Summary</h2>
            <div className="stats">
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
            </div>
          </article>

          <article className="card span-5">
            <h3>Registry Record</h3>
            <div className="list">
              <div className="item code">manifest_id: {envelope.manifest_id}</div>
              <div className="item code">version_id: {envelope.version_id}</div>
              <div className="item code">published_at: {envelope.published_at}</div>
            </div>
          </article>

          <article className="card span-12">
            <h3>Timeline</h3>
            <div className="timeline">
              {envelope.manifest.timeline.map((segment) => (
                <div key={segment.segment_id} className="timeline-item">
                  <strong>
                    {segment.time_range.start}s - {segment.time_range.end}s
                  </strong>
                  <p>{segment.visible_text ?? segment.narration_text ?? "No public text"}</p>
                </div>
              ))}
            </div>
          </article>
        </section>
      </main>
    );
  } catch {
    notFound();
  }
}
