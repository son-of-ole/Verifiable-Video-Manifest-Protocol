import type {
  GuardrailRecord,
  PromptRecord,
  SourceRecord,
  TimelineSegment,
  ToolRecord,
  VvmpExtension,
  VvmpSignature,
  VvmpManifest
} from "@vvmp/trust-core";
import {
  buildPolicyExtensionDeclaration,
  createExecutionTargetsFromManifest,
  runPolicyPack as executePolicyPack,
  type PolicyPackDefinition
} from "@vvmp/policy-pack-sdk";
import type {
  AssetRecord,
  BuildManifestOptions,
  EditRecord,
  GenerationEventRecord,
  LogEventOptions,
  PublicationRecord,
  RedactionRule,
  RedactionTargetCollection,
  RenderRecord,
  RightsRecord,
  TrustEventDataMap,
  TrustEventEnvelope,
  TrustEventKind,
  TrustSession,
  TrustSessionOptions,
  TrustSessionSnapshot
} from "./types";

type CollectionKey =
  | "sources"
  | "prompts"
  | "tools"
  | "assets"
  | "timeline"
  | "edits"
  | "guardrails"
  | "rights";

type CollectionRecordMap = {
  sources: SourceRecord;
  prompts: PromptRecord;
  tools: ToolRecord;
  assets: AssetRecord;
  timeline: TimelineSegment;
  edits: EditRecord;
  guardrails: GuardrailRecord;
  rights: RightsRecord;
};

type EventStore = {
  source: TrustEventEnvelope<"source">[];
  prompt: TrustEventEnvelope<"prompt">[];
  tool: TrustEventEnvelope<"tool">[];
  asset: TrustEventEnvelope<"asset">[];
  generation: TrustEventEnvelope<"generation">[];
  segment: TrustEventEnvelope<"segment">[];
  edit: TrustEventEnvelope<"edit">[];
  guardrail: TrustEventEnvelope<"guardrail">[];
  rights: TrustEventEnvelope<"rights">[];
  render: TrustEventEnvelope<"render">[];
  publication: TrustEventEnvelope<"publication">[];
};

const EVENT_VERSION = "1.0.0-draft";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function nowIso(): string {
  return new Date().toISOString();
}

function createDefaultEventId(
  sessionId: string,
  kind: TrustEventKind,
  order: number,
  record: TrustEventDataMap[TrustEventKind]
): string {
  const recordId = extractRecordId(kind, record as never) ?? `order-${order}`;
  return `${sessionId}:${kind}:${recordId}:${order}`;
}

function extractRecordId(kind: TrustEventKind, record: TrustEventDataMap[TrustEventKind]): string | null {
  switch (kind) {
    case "source":
      return (record as SourceRecord).source_id;
    case "prompt":
      return (record as PromptRecord).prompt_id;
    case "tool":
      return (record as ToolRecord).tool_id;
    case "asset":
      return (record as AssetRecord).asset_id;
    case "generation":
      return (record as GenerationEventRecord).generation_event_id;
    case "segment":
      return (record as TimelineSegment).segment_id;
    case "edit":
      return (record as EditRecord).edit_event_id;
    case "guardrail":
      return (record as GuardrailRecord).guardrail_event_id;
    case "rights":
      return (record as RightsRecord).rights_event_id ?? (record as RightsRecord).asset_id ?? null;
    case "render":
      return (record as RenderRecord).render_id ?? null;
    case "publication":
      return (record as PublicationRecord).publication_id ?? null;
    default:
      return null;
  }
}

function getCollectionRecordId(collection: CollectionKey, record: CollectionRecordMap[CollectionKey]): string {
  switch (collection) {
    case "sources":
      return (record as SourceRecord).source_id;
    case "prompts":
      return (record as PromptRecord).prompt_id;
    case "tools":
      return (record as ToolRecord).tool_id;
    case "assets":
      return (record as AssetRecord).asset_id;
    case "timeline":
      return (record as TimelineSegment).segment_id;
    case "edits":
      return (record as EditRecord).edit_event_id;
    case "guardrails":
      return (record as GuardrailRecord).guardrail_event_id;
    case "rights":
      return (record as RightsRecord).rights_event_id ?? (record as RightsRecord).asset_id ?? JSON.stringify(record);
  }
}

function normalizeCollection<K extends CollectionKey>(
  collection: K,
  entries: TrustEventEnvelope[]
): CollectionRecordMap[K][] {
  const latestById = new Map<string, { order: number; value: CollectionRecordMap[K] }>();

  for (const entry of entries) {
    const record = entry.data as CollectionRecordMap[K];
    const recordId = getCollectionRecordId(collection, record);
    latestById.set(recordId, { order: entry.order, value: clone(record) });
  }

  return [...latestById.entries()]
    .sort((left, right) => {
      if (collection === "timeline") {
        const a = left[1].value as TimelineSegment;
        const b = right[1].value as TimelineSegment;
        if (a.time_range.start !== b.time_range.start) {
          return a.time_range.start - b.time_range.start;
        }
        if (a.time_range.end !== b.time_range.end) {
          return a.time_range.end - b.time_range.end;
        }
      }

      return left[0].localeCompare(right[0]) || left[1].order - right[1].order;
    })
    .map((entry) => entry[1].value);
}

function applyRedactionRules<K extends CollectionKey>(
  collection: K,
  records: CollectionRecordMap[K][],
  rules: RedactionRule[],
  redactions: Array<Record<string, unknown>>
): CollectionRecordMap[K][] {
  const relevantRules = rules.filter((rule) => rule.target_collection === collection);
  if (relevantRules.length === 0) {
    return records;
  }

  let nextRecords = records.map((record) => clone(record));

  for (const rule of relevantRules) {
    const recordIndex = nextRecords.findIndex(
      (record) => getCollectionRecordId(collection, record) === rule.record_id
    );

    if (recordIndex === -1) {
      continue;
    }

    redactions.push({
      redaction_id:
        rule.redaction_id ??
        `${collection}:${rule.record_id}:${"field" in rule ? rule.field : "record"}`,
      target_collection: rule.target_collection,
      record_id: rule.record_id,
      mode: rule.mode,
      reason: rule.reason,
      public_summary: rule.public_summary
    });

    if (rule.mode === "remove_record") {
      nextRecords = nextRecords.filter((_, index) => index !== recordIndex);
      continue;
    }

    const updated = { ...nextRecords[recordIndex] } as Record<string, unknown>;
    if (rule.mode === "remove_field") {
      delete updated[rule.field];
    } else {
      updated[rule.field] = clone(rule.replacement);
    }

    nextRecords[recordIndex] = updated as CollectionRecordMap[K];
  }

  return nextRecords;
}

function collectIds(records: Array<Record<string, unknown>>, field: string): Set<string> {
  const ids = new Set<string>();
  for (const record of records) {
    const value = record[field];
    if (typeof value === "string" && value.length > 0) {
      ids.add(value);
    }
  }
  return ids;
}

function ensureReferenceSet(
  idType: string,
  sourceIds: Iterable<string>,
  referencedIds: Iterable<string>
) {
  const known = new Set(sourceIds);
  for (const id of referencedIds) {
    if (!known.has(id)) {
      throw new Error(`Unknown ${idType} referenced during manifest assembly: ${id}`);
    }
  }
}

function flattenReferencedIds(
  timeline: TimelineSegment[],
  field:
    | "source_ids"
    | "prompt_ids"
    | "generation_event_ids"
    | "edit_event_ids"
    | "guardrail_event_ids"
    | "visual_asset_ids"
    | "audio_asset_ids"
): string[] {
  return timeline.flatMap((segment) =>
    Array.isArray(segment[field]) ? (segment[field] as string[]) : []
  );
}

function mergeManifestExtensions(
  explicitExtensions: Array<Record<string, unknown>> = [],
  registeredExtensions: Array<Record<string, unknown>> = []
): Array<Record<string, unknown>> {
  const merged: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();

  for (const extension of [...explicitExtensions, ...registeredExtensions]) {
    const extensionId =
      typeof extension.extension_id === "string" ? extension.extension_id : JSON.stringify(extension);
    const version = typeof extension.version === "string" ? extension.version : "";
    const key = `${extensionId}:${version}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    merged.push(clone(extension));
  }

  return merged;
}

export function createTrustSession(options: TrustSessionOptions): TrustSession {
  const sessionId = options.sessionId;
  const startedAt = options.startedAt ?? nowIso();
  const eventStore: EventStore = {
    source: [],
    prompt: [],
    tool: [],
    asset: [],
    generation: [],
    segment: [],
    edit: [],
    guardrail: [],
    rights: [],
    render: [],
    publication: []
  };
  const eventLog: TrustEventEnvelope[] = [];
  const idempotencyKeys = new Map<string, TrustEventEnvelope>();
  const registeredExtensions: Array<Record<string, unknown>> = [];
  let order = 0;

  function append<K extends TrustEventKind>(
    kind: K,
    record: TrustEventDataMap[K],
    options: LogEventOptions = {}
  ): TrustEventEnvelope<K> {
    const key = options.idempotencyKey ? `${kind}:${options.idempotencyKey}` : null;
    if (key && idempotencyKeys.has(key)) {
      return clone(idempotencyKeys.get(key) as TrustEventEnvelope<K>);
    }

    order += 1;
    const envelope: TrustEventEnvelope<K> = {
      event_version: EVENT_VERSION,
      event_id: options.eventId ?? createDefaultEventId(sessionId, kind, order, record),
      session_id: sessionId,
      kind,
      recorded_at: options.recordedAt ?? nowIso(),
      order,
      idempotency_key: options.idempotencyKey,
      data: clone(record)
    };

    eventLog.push(envelope);
    eventStore[kind].push(envelope as never);

    if (key) {
      idempotencyKeys.set(key, envelope);
    }

    return clone(envelope);
  }

  function buildManifest(options: BuildManifestOptions): VvmpManifest {
    const redactions: Array<Record<string, unknown>> = [];
    const rules = options.redactionRules ?? [];
    const extensions = mergeManifestExtensions(options.extensions ?? [], registeredExtensions);

    const sources = applyRedactionRules(
      "sources",
      normalizeCollection("sources", eventStore.source),
      rules,
      redactions
    );
    const prompts = applyRedactionRules(
      "prompts",
      normalizeCollection("prompts", eventStore.prompt),
      rules,
      redactions
    );
    const tools = applyRedactionRules(
      "tools",
      normalizeCollection("tools", eventStore.tool),
      rules,
      redactions
    );
    const assets = applyRedactionRules(
      "assets",
      normalizeCollection("assets", eventStore.asset),
      rules,
      redactions
    );
    const edits = applyRedactionRules(
      "edits",
      normalizeCollection("edits", eventStore.edit),
      rules,
      redactions
    );
    const guardrails = applyRedactionRules(
      "guardrails",
      normalizeCollection("guardrails", eventStore.guardrail),
      rules,
      redactions
    );
    const rights = applyRedactionRules(
      "rights",
      normalizeCollection("rights", eventStore.rights),
      rules,
      redactions
    );
    const timeline = applyRedactionRules(
      "timeline",
      normalizeCollection("timeline", eventStore.segment),
      rules,
      redactions
    );

    const generationIds = collectIds(
      eventStore.generation.map((entry) => entry.data as Record<string, unknown>),
      "generation_event_id"
    );

    ensureReferenceSet(
      "source_id",
      sources.map((record) => record.source_id),
      flattenReferencedIds(timeline, "source_ids")
    );
    ensureReferenceSet(
      "prompt_id",
      prompts.map((record) => record.prompt_id),
      flattenReferencedIds(timeline, "prompt_ids")
    );
    ensureReferenceSet(
      "generation_event_id",
      generationIds,
      flattenReferencedIds(timeline, "generation_event_ids")
    );
    ensureReferenceSet(
      "edit_event_id",
      edits.map((record) => record.edit_event_id),
      flattenReferencedIds(timeline, "edit_event_ids")
    );
    ensureReferenceSet(
      "guardrail_event_id",
      guardrails.map((record) => record.guardrail_event_id),
      flattenReferencedIds(timeline, "guardrail_event_ids")
    );

    const assetIds = assets.map((record) => record.asset_id);
    ensureReferenceSet("asset_id", assetIds, flattenReferencedIds(timeline, "visual_asset_ids"));
    ensureReferenceSet("asset_id", assetIds, flattenReferencedIds(timeline, "audio_asset_ids"));

    const latestRender = eventStore.render.at(-1)?.data ?? {};
    const latestPublication = eventStore.publication.at(-1)?.data ?? {};

    return {
      manifest_version: options.manifestVersion ?? EVENT_VERSION,
      manifest_id: options.manifestId,
      video: clone(options.video),
      creation: clone(options.creation),
      sources,
      prompts,
      tools,
      assets,
      timeline,
      edits,
      guardrails,
      rights,
      render: clone(options.render ?? latestRender),
      publication: clone(options.publication ?? latestPublication),
      redactions,
      signatures: clone(options.signatures ?? []) as VvmpSignature[],
      links: clone(options.links ?? {}),
      extensions: extensions as VvmpExtension[]
    };
  }

  return {
    sessionId,
    startedAt,
    getSnapshot(): TrustSessionSnapshot {
      return {
        session_id: sessionId,
        started_at: startedAt,
        event_count: eventLog.length
      };
    },
    getEventLog() {
      return clone(eventLog);
    },
    logSource(record, options) {
      return append("source", record, options);
    },
    logPrompt(record, options) {
      return append("prompt", record, options);
    },
    logTool(record, options) {
      return append("tool", record, options);
    },
    logAsset(record, options) {
      return append("asset", record, options);
    },
    logGeneration(record, options) {
      return append("generation", record, options);
    },
    logSegment(record, options) {
      return append("segment", record, options);
    },
    logEdit(record, options) {
      return append("edit", record, options);
    },
    logGuardrail(record, options) {
      return append("guardrail", record, options);
    },
    logRights(record, options) {
      return append("rights", record, options);
    },
    logRender(record, options) {
      return append("render", record, options);
    },
    logPublication(record, options) {
      return append("publication", record, options);
    },
    async runPolicyPack(policyPack: PolicyPackDefinition, options) {
      const previewManifest = buildManifest(options.manifestOptions);
      const execution = await executePolicyPack(policyPack, {
        manifest: previewManifest,
        targets:
          options.targets ??
          createExecutionTargetsFromManifest(previewManifest, options.targetTypes ?? ["script_segment"]),
        stage: options.stage,
        now: options.now,
        review_mode: options.review_mode,
        check_types: options.check_types,
        context: options.context
      });

      const loggedGuardrails = execution.guardrails.map((guardrail) =>
        append("guardrail", guardrail, {
          idempotencyKey: `policy:${guardrail.guardrail_event_id}`
        }).data as GuardrailRecord
      );

      if (options.appendExtension !== false) {
        const extension = buildPolicyExtensionDeclaration(
          policyPack,
          options.criticalExtension ?? policyPack.critical_extension ?? false
        );
        const exists = registeredExtensions.some(
          (candidate) =>
            candidate.extension_id === extension.extension_id &&
            candidate.version === extension.version
        );

        if (!exists) {
          registeredExtensions.push(extension);
        }
      }

      return {
        manifest: buildManifest(options.manifestOptions),
        execution,
        loggedGuardrails: clone(loggedGuardrails)
      };
    },
    buildManifest
  };
}
