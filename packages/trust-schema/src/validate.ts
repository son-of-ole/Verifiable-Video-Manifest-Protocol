import {
  type ValidationIssue,
  type ValidationResult,
  type VvmpManifest,
  validateManifest
} from "@vvmp/trust-core";

export function validateSchemaManifest(manifest: unknown): ValidationResult {
  return validateManifest(manifest);
}

export function formatValidationIssues(issues: ValidationIssue[]): string[] {
  return issues.map((issue) => `${issue.code} ${issue.path} ${issue.message}`);
}

export function assertValidManifest(manifest: unknown): VvmpManifest {
  const validation = validateSchemaManifest(manifest);
  if (!validation.valid) {
    throw new Error(formatValidationIssues(validation.issues).join("\n"));
  }

  return manifest as VvmpManifest;
}
