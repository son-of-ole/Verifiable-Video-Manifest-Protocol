import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const trustSchema = await import(path.join(repoRoot, "packages", "trust-schema", "dist", "index.js"));

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const manifestSchemaPath = trustSchema.getManifestSchemaPath();
  const eventEnvelopeSchemaPath = trustSchema.getEventEnvelopeSchemaPath();
  const renditionObservationSchemaPath = trustSchema.getRenditionObservationSchemaPath();
  const jsonLdContextPath = trustSchema.getJsonLdContextPath();

  const [
    manifestSchema,
    rootSchema,
    eventEnvelopeSchema,
    rootEventEnvelopeSchema,
    renditionObservationSchema,
    rootRenditionObservationSchema,
    jsonLdContext
  ] = await Promise.all([
    trustSchema.readManifestSchema(),
    JSON.parse(await fs.readFile(path.join(repoRoot, "schemas", "vvmp-manifest.v1.json"), "utf8")),
    trustSchema.readEventEnvelopeSchema(),
    JSON.parse(await fs.readFile(path.join(repoRoot, "schemas", "vvmp-event-envelope.v1.json"), "utf8")),
    trustSchema.readRenditionObservationSchema(),
    JSON.parse(
      await fs.readFile(path.join(repoRoot, "schemas", "vvmp-rendition-observation.v1.json"), "utf8")
    ),
    trustSchema.readJsonLdContext()
  ]);

  assert(
    trustSchema.canonicalizeJson(manifestSchema) === trustSchema.canonicalizeJson(rootSchema),
    "Packaged trust-schema manifest schema should stay in sync with the root schema artifact."
  );
  assert(
    trustSchema.canonicalizeJson(eventEnvelopeSchema) ===
      trustSchema.canonicalizeJson(rootEventEnvelopeSchema),
    "Packaged trust-schema event-envelope schema should stay in sync with the root event schema artifact."
  );
  assert(
    trustSchema.canonicalizeJson(renditionObservationSchema) ===
      trustSchema.canonicalizeJson(rootRenditionObservationSchema),
    "Packaged trust-schema rendition-observation schema should stay in sync with the root rendition schema artifact."
  );
  assert(typeof jsonLdContext?.["@context"] === "object", "JSON-LD context should expose an @context object.");
  assert(trustSchema.CLAIM_TYPES.includes("summary"), "Claim type registry should include summary.");
  assert(
    trustSchema.VISIBILITY_STATES.includes("redacted_public"),
    "Visibility state registry should include redacted_public."
  );
  assert(
    trustSchema.FILE_TRUST_STATES.includes("embedded_manifest_missing"),
    "Trust-state enums should include embedded_manifest_missing."
  );

  const registryChecks = {};
  for (const fileName of trustSchema.REGISTRY_ARTIFACT_FILES) {
    const registry = await trustSchema.readRegistryArtifact(fileName);
    assert(Array.isArray(registry.values) && registry.values.length > 0, `${fileName} should contain values.`);
    registryChecks[fileName] = registry.values.length;
  }

  const exampleSummaries = [];
  for (const fileName of trustSchema.EXAMPLE_MANIFEST_FILES) {
    const manifest = await trustSchema.readExampleManifest(fileName);
    const validation = trustSchema.validateSchemaManifest(manifest);
    assert(validation.valid, `Example manifest ${fileName} should validate.`);
    exampleSummaries.push({
      file: fileName,
      manifest_id: manifest.manifest_id,
      title: manifest.video.title
    });
  }

  const eventLogSummaries = [];
  for (const fileName of trustSchema.EXAMPLE_EVENT_LOG_FILES) {
    const eventLog = await trustSchema.readExampleEventLog(fileName);
    const validation = trustSchema.validateEventLog(eventLog);
    assert(validation.valid, `Example event log ${fileName} should validate.`);
    eventLogSummaries.push({
      file: fileName,
      event_count: eventLog.length,
      first_kind: eventLog[0]?.kind ?? null,
      last_kind: eventLog.at(-1)?.kind ?? null
    });
  }

  const renditionObservationSummaries = [];
  for (const fileName of trustSchema.EXAMPLE_RENDITION_OBSERVATION_FILES) {
    const observation = await trustSchema.readExampleRenditionObservation(fileName);
    const validation = trustSchema.validateRenditionObservation(observation);
    assert(validation.valid, `Example rendition observation ${fileName} should validate.`);
    renditionObservationSummaries.push({
      file: fileName,
      method: observation.recovery?.method ?? null,
      trust_code: observation.trust_code ?? null
    });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        manifestSchemaPath,
        eventEnvelopeSchemaPath,
        renditionObservationSchemaPath,
        jsonLdContextPath,
        registryChecks,
        exampleSummaries,
        eventLogSummaries,
        renditionObservationSummaries
      },
      null,
      2
    )
  );
}

await main();
