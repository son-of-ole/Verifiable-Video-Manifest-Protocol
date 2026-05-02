import crypto from "node:crypto";
import { canonicalizeJson } from "./canonicalize";
import type { VvmpManifest, VvmpSignature } from "./types";

export type AppendSignatureInput = Partial<VvmpSignature> & {
  signer: string;
  type?: string;
  value?: string;
};

export type VerifySignatureContext = {
  manifest: VvmpManifest;
  signature: VvmpSignature;
  canonicalPayload: string;
  payloadSha256: string;
};

export type VerifySignatureResult = {
  signature_id: string;
  valid: boolean;
  message?: string;
};

export type VerifySignaturesResult = {
  valid: boolean;
  results: VerifySignatureResult[];
};

export type SignatureVerifier = (
  context: VerifySignatureContext
) => boolean | VerifySignatureResult | Promise<boolean | VerifySignatureResult>;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createSignatureId(manifest: VvmpManifest): string {
  return `sig_${String(manifest.signatures.length + 1).padStart(3, "0")}`;
}

/**
 * @since 0.1.1
 */
export function createManifestSigningPayload(manifest: VvmpManifest): string {
  return canonicalizeJson({
    ...clone(manifest),
    signatures: []
  });
}

/**
 * @since 0.1.1
 */
export function createManifestSigningPayloadSha256(manifest: VvmpManifest): string {
  const payload = createManifestSigningPayload(manifest);
  return `sha256:${crypto.createHash("sha256").update(payload).digest("hex")}`;
}

/**
 * @since 0.1.1
 */
export function appendSignature(
  manifest: VvmpManifest,
  signature: AppendSignatureInput
): VvmpManifest {
  const next = clone(manifest);
  const record: VvmpSignature = {
    ...signature,
    signature_id: signature.signature_id ?? createSignatureId(next),
    type: signature.type ?? "external",
    signer: signature.signer,
    payload_sha256: signature.payload_sha256 ?? createManifestSigningPayloadSha256(next),
    signed_at: signature.signed_at ?? new Date().toISOString()
  };

  next.signatures = [...next.signatures, record];
  return next;
}

/**
 * @since 0.1.1
 */
export async function verifySignatures(
  manifest: VvmpManifest,
  verifier: SignatureVerifier
): Promise<VerifySignaturesResult> {
  const canonicalPayload = createManifestSigningPayload(manifest);
  const payloadSha256 = `sha256:${crypto
    .createHash("sha256")
    .update(canonicalPayload)
    .digest("hex")}`;

  const results: VerifySignatureResult[] = [];
  for (const signature of manifest.signatures) {
    const verification = await verifier({
      manifest,
      signature,
      canonicalPayload,
      payloadSha256
    });

    if (typeof verification === "boolean") {
      results.push({
        signature_id: signature.signature_id,
        valid: verification
      });
    } else {
      results.push({
        signature_id: verification.signature_id ?? signature.signature_id,
        valid: verification.valid,
        message: verification.message
      });
    }
  }

  return {
    valid: results.length > 0 && results.every((result) => result.valid),
    results
  };
}
