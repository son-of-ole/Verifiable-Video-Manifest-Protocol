# VVMP Conformance Suite

## Purpose

The VVMP conformance suite is the mechanism that proves independent implementations behave the same way.

Without it, the protocol risks fragmenting into incompatible SDK behaviors.

## Goals

The conformance suite should verify that implementations can:

- parse valid manifests
- reject invalid manifests
- normalize data consistently
- hash canonical inputs consistently
- compute trust states consistently
- enforce profile requirements consistently
- handle extensions consistently

## What the Suite Should Test

## 1. Schema Validity

Examples:

- missing required field
- wrong field type
- malformed enum
- malformed nested object

Expected output:

- pass or fail
- error code family

## 2. Semantic Validity

Examples:

- timeline segment ends before it starts
- duplicate identifiers in forbidden scope
- reference to missing source or prompt
- invalid redaction target reference

Expected output:

- pass or fail
- semantic error code

## 3. Canonicalization

Examples:

- object keys out of order in source file but identical normalized output
- equivalent numeric forms that should normalize identically
- UTF-8 string handling

Expected output:

- canonical bytes fixture
- canonical JSON fixture

## 4. Hashing

Examples:

- canonical JSON hash
- raw text hash
- media byte hash fixture

Expected output:

- exact algorithm
- exact hex or encoded digest

## 5. Profiles

Examples:

- valid Core Manifest profile
- invalid Registry-Backed profile missing trust code
- invalid Embedded Provenance profile missing signature reference

Expected output:

- profile pass or fail
- profile error code

## 6. Extensions

Examples:

- unknown non-critical extension
- unknown critical extension
- malformed namespace

Expected output:

- pass, warn, or fail depending on the extension rule

## 7. Trust-State Derivation

Examples:

- fully source-mapped clip
- partially redacted clip
- unsourced AI-generated clip
- registry-backed copy recovered by trust code

Expected output:

- expected file trust state
- expected provenance coverage state
- expected AI involvement state

## 8. Signature and Embedded-Provenance Cases

Examples:

- valid signed manifest with signature metadata
- invalid embedded-provenance claim with missing signatures
- invalid signature record missing required fields

Expected output:

- signature validation result
- profile pass or fail
- signature-related error-code family when invalid

## Suite Artifacts

The suite should publish these artifacts:

- manifest fixtures
- canonicalization input fixtures
- expected validation result files
- expected canonical JSON files
- expected hash files
- expected trust-state summaries
- profile expectation files

## Suggested Directory Layout

```text
test-fixtures/conformance
├── valid
│   ├── core
│   ├── registry
│   ├── embedded
│   └── extensions
├── invalid
│   ├── schema
│   ├── semantic
│   ├── profile
│   └── extensions
├── normalized
├── hashes
├── trust-states
└── expected-errors
```

```text
test-fixtures/canonicalization
├── *.input.json
└── *.expected.json
```

## Fixture Naming Conventions

Examples:

- `valid-core-minimal-001.json`
- `valid-registry-public-001.json`
- `invalid-schema-missing-video-id-001.json`
- `invalid-timeline-negative-duration-001.json`
- `invalid-extension-unknown-critical-001.json`

## Expected Output Format

Each fixture should have an adjacent expectation file.

Examples:

- `valid-core-minimal-001.expected.json`
- `invalid-schema-missing-video-id-001.expected.json`

Suggested expectation keys:

```json
{
  "valid": false,
  "error_codes": ["VVMP_SCHEMA_REQUIRED_FIELD"],
  "profiles": {
    "core_manifest": false
  }
}
```

## Canonicalization Fixtures

Canonicalization fixtures should contain:

- input JSON
- expected canonical JSON bytes
- expected hash result

This is the part that most strongly enables cross-language parity.

## Trust-State Fixtures

Trust-state fixtures should define the exact expected machine-readable state outputs.

Suggested format:

```json
{
  "file_trust_state": "remote_manifest_found",
  "provenance_coverage_state": "source_mapped",
  "guardrail_state": "passed_automated_review",
  "ai_involvement_state": "ai_generated_with_human_approval"
}
```

## Running the Suite

Every implementation should be able to run the same conformance corpus.

Recommended modes:

- local file validation
- CI validation
- machine-readable summary report

Reference implementation note:

- the repository now includes a GitHub Actions CI workflow that runs the reference verification path, including conformance fixtures

Suggested outputs:

- passed fixture count
- failed fixture count
- unsupported fixture count

## Pass Criteria

An implementation passes VVMP conformance for a profile when:

1. all required valid fixtures pass
2. all required invalid fixtures fail with the correct error-code family
3. all canonicalization outputs match
4. all hash outputs match
5. all trust-state outputs match

## Implementation Classes

VVMP should classify implementations by what they claim to support.

Suggested classes:

- validator
- capture-sdk
- registry
- viewer
- signer
- embedded-provenance adapter

Not every implementation must support every class.

## Next.js and Reference Tooling

A Next.js reference app can run the viewer and hosted registry surfaces, but conformance must not depend on a browser or Next.js runtime.

The conformance suite should be executable by:

- Node or Bun tooling
- Python scripts
- Rust test harnesses
- Go test runners

## Minimum First Release of the Suite

The first conformance release should include:

1. 10 valid manifest fixtures
2. 10 invalid manifest fixtures
3. canonical JSON examples
4. hash expectation files
5. profile validation fixtures
6. trust-state expectation fixtures

Reference implementation note:

- the repository now includes a dedicated C2PA verification matrix fixture set under `test-fixtures/c2pa-verification`
- those fixtures currently lock in the official ES256 valid-signature untrusted C2PA lane, a VVMP local trust-profile lane for that same signer, and the expected trust-state differences between default self-signed verification, trust-disabled verification through a settings file, and self-signed verification with a supplied anchor
- the repository now also includes a separate trust-program smoke lane that exercises bundled official/interim trust-program presets, signing-profile materialization, trusted-lane doctoring, and optional real trusted signing when a conforming signing profile or trusted env material is configured

## Immediate Follow-Up Tasks

1. Create the `test-fixtures/conformance` directory plan
2. Draft the first 20 fixtures
3. Define the `.expected.json` schema
4. Add one reference runner in TypeScript
5. Add one second runner in a non-JS language
