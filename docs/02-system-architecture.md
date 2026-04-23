# VVMP System Architecture

## Architecture Summary

VVMP should be built as five connected layers:

```text
1. Creation Layer
2. Provenance Capture Layer
3. Trust Manifest Layer
4. Binding and Embedding Layer
5. Verification Layer
```

## 1. Creation Layer

This is the source application workflow where a video is actually produced.

Examples:

- chat-to-video
- text-to-video
- storyboard-to-video
- clip editor
- newsroom publishing workflow

The creation layer is responsible for generating events, not for final trust semantics by itself.

Typical inputs and steps:

- user chat
- source selection
- prompt composition
- script generation
- storyboard generation
- visual generation
- voiceover generation
- caption generation
- human edits
- rendering
- publishing

## 2. Provenance Capture Layer

The capture layer records everything needed to reconstruct the creation record.

It should log:

- sources
- prompts
- generation events
- edit events
- guardrail events
- rights and consent events
- render events
- publication events

This layer should be implemented as a developer SDK with a stable event contract.

### Design Rules

- events must be append-only
- each event must have stable identifiers
- each event must reference its upstream dependencies where applicable
- sensitive payloads must support redacted public representations
- hashes should be computed at event creation time whenever possible

## 3. Trust Manifest Layer

This layer converts raw capture events into a structured VVMP manifest.

The manifest should contain:

- video identity
- source inventory
- prompt inventory
- tool and model inventory
- timeline source map
- edit history
- guardrail history
- rights metadata
- render output references
- disclosure summary
- signature references

This layer is where validation, normalization, and redaction policy are applied before signing.

## 4. Binding and Embedding Layer

This layer associates the manifest with the media asset.

It should support:

- embedded C2PA manifest store
- remote manifest publishing
- short trust code generation
- visible QR generation
- optional watermark or fingerprint lookup hooks

### Binding Modes

#### Hard binding

Use cryptographic binding between a signed manifest and the exact exported asset hash.

Use for:

- downloadable originals
- archival copies
- first-party exports

#### Soft binding

Use recoverable identifiers or fingerprints when embedded metadata may be lost.

Use for:

- social uploads
- re-encodes
- clipped or reposted renditions

## 5. Verification Layer

This is the public and developer-facing trust surface.

It includes:

- trust page UI
- registry APIs
- local CLI verifier
- embedded-manifest inspection
- remote manifest comparison
- trust state calculation

The verification layer must not depend on one proprietary UI to be meaningful.

## Core Services

### A. Manifest Builder

Responsibilities:

- aggregate event logs
- validate schema compliance
- construct segment mappings
- apply redaction rules
- produce a canonical manifest payload

### B. Signer Service

Responsibilities:

- canonicalize payloads
- prepare C2PA-compatible structures
- sign claims
- attach timestamps
- store certificate references

### C. Registry Service

Responsibilities:

- store published manifests
- map trust codes to manifest identifiers
- expose verification endpoints
- retain version history
- support public and restricted views

### D. Viewer Application

Responsibilities:

- plain-language trust summary
- timeline inspection
- technical verifier UX
- redaction disclosures
- manifest version history

## Recommended Repository Layout

```text
.
├── apps
│   ├── trust-registry
│   └── trust-viewer
├── docs
├── packages
│   ├── policy-pack-sdk
│   ├── trust-c2pa-adapter
│   ├── trust-capture-sdk
│   ├── trust-cli
│   ├── trust-registry-client
│   └── trust-schema
├── examples
│   └── chat-to-video
└── test-fixtures
    ├── manifests
    └── media
```

The current reference repository ships the `chat-to-video` example first. Additional domain examples such as newsroom or faith-specific apps remain optional follow-on surfaces rather than required core architecture pieces.

## Canonical End-to-End Flow

```text
User action
  -> capture sources
  -> capture prompts
  -> run generation
  -> run guardrails
  -> capture edits
  -> render output
  -> build VVMP manifest
  -> create C2PA assertions
  -> sign and bind
  -> publish registry record
  -> generate trust code and QR
  -> verify locally and remotely
```

## Architectural Rules

1. No public export without a manifest.
2. No silent mutation of a published manifest.
3. Every timeline segment must be able to express provenance state, even if partially sourced or redacted.
4. Registry presence must not replace embedded signing.
5. Embedded signing must not be the only recovery path.
6. Privacy controls must exist at the event and field level, not only at the page level.
