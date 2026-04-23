export const TRUST_EVENT_KINDS = [
  "source",
  "prompt",
  "tool",
  "asset",
  "generation",
  "segment",
  "edit",
  "guardrail",
  "rights",
  "render",
  "publication"
] as const;

export type TrustEventKind = (typeof TRUST_EVENT_KINDS)[number];

export type TrustEventEnvelope<
  TData extends Record<string, unknown> = Record<string, unknown>,
  TKind extends TrustEventKind = TrustEventKind
> = {
  event_version: "1.0.0-draft";
  event_id: string;
  session_id: string;
  kind: TKind;
  recorded_at: string;
  order: number;
  idempotency_key?: string;
  data: TData;
};

export type EventEnvelopeValidationIssue = {
  code: string;
  path: string;
  message: string;
};

export type EventEnvelopeValidationResult = {
  valid: boolean;
  issues: EventEnvelopeValidationIssue[];
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function pushIssue(
  issues: EventEnvelopeValidationIssue[],
  code: string,
  path: string,
  message: string
) {
  issues.push({ code, path, message });
}

export function validateEventEnvelope(value: unknown): EventEnvelopeValidationResult {
  const issues: EventEnvelopeValidationIssue[] = [];

  if (!isObject(value)) {
    pushIssue(issues, "VVMP_EVENT_SCHEMA_TYPE", "$", "Event envelope must be an object.");
    return { valid: false, issues };
  }

  if (value.event_version !== "1.0.0-draft") {
    pushIssue(
      issues,
      "VVMP_EVENT_REQUIRED_FIELD",
      "event_version",
      "event_version must be 1.0.0-draft."
    );
  }

  for (const field of ["event_id", "session_id", "recorded_at"] as const) {
    if (!isNonEmptyString(value[field])) {
      pushIssue(
        issues,
        "VVMP_EVENT_REQUIRED_FIELD",
        field,
        `The field ${field} is required for event envelopes.`
      );
    }
  }

  if (!isNonEmptyString(value.kind) || !TRUST_EVENT_KINDS.includes(value.kind as TrustEventKind)) {
    pushIssue(
      issues,
      "VVMP_EVENT_KIND_UNKNOWN",
      "kind",
      "kind must be one of the known VVMP event kinds."
    );
  }

  if (!Number.isInteger(value.order) || Number(value.order) < 1) {
    pushIssue(
      issues,
      "VVMP_EVENT_ORDER_INVALID",
      "order",
      "order must be an integer greater than or equal to 1."
    );
  }

  if ("idempotency_key" in value && value.idempotency_key !== undefined && !isNonEmptyString(value.idempotency_key)) {
    pushIssue(
      issues,
      "VVMP_EVENT_IDEMPOTENCY_INVALID",
      "idempotency_key",
      "idempotency_key must be a non-empty string when present."
    );
  }

  if (!isObject(value.data)) {
    pushIssue(
      issues,
      "VVMP_EVENT_DATA_INVALID",
      "data",
      "data must be an object."
    );
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

export function validateEventLog(value: unknown): EventEnvelopeValidationResult {
  const issues: EventEnvelopeValidationIssue[] = [];

  if (!Array.isArray(value)) {
    pushIssue(issues, "VVMP_EVENT_LOG_TYPE", "$", "Event log must be an array.");
    return {
      valid: false,
      issues
    };
  }

  value.forEach((entry, index) => {
    const result = validateEventEnvelope(entry);
    result.issues.forEach((issue) => {
      issues.push({
        code: issue.code,
        path: issue.path === "$" ? `[${index}]` : `[${index}].${issue.path}`,
        message: issue.message
      });
    });
  });

  const previousOrderBySession = new Map<string, number>();
  value.forEach((entry, index) => {
    if (!isObject(entry) || !isNonEmptyString(entry.session_id) || !Number.isInteger(entry.order)) {
      return;
    }

    const previous = previousOrderBySession.get(entry.session_id);
    if (previous !== undefined && Number(entry.order) <= previous) {
      issues.push({
        code: "VVMP_EVENT_LOG_ORDER_INVALID",
        path: `[${index}].order`,
        message: "Event orders must increase within a session."
      });
    }

    previousOrderBySession.set(entry.session_id, Number(entry.order));
  });

  return {
    valid: issues.length === 0,
    issues
  };
}
