export const CLAIM_TYPES = [
  "quote",
  "paraphrase",
  "context",
  "summary",
  "ai_assisted_summary",
  "ai_assisted_paraphrase",
  "ai_assisted_reflection",
  "user_authored",
  "personal_reflection",
  "humor",
  "parody",
  "opinion"
] as const;

export type ClaimType = (typeof CLAIM_TYPES)[number];
