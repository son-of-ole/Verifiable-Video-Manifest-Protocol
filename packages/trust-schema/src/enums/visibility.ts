export const VISIBILITY_STATES = [
  "public",
  "redacted_public",
  "template_hash_only",
  "private_internal"
] as const;

export type VisibilityState = (typeof VISIBILITY_STATES)[number];
