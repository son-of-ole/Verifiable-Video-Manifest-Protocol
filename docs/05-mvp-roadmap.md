# VVMP MVP Roadmap

## MVP Philosophy

The MVP should prove the protocol, not solve every media provenance problem on day one.

The fastest credible route is:

- schema first
- examples second
- SDK and viewer third
- C2PA embedding after the protocol is stable enough to sign

## MVP 1: Manifest Schema

Goal:

Define the VVMP format clearly enough that multiple apps could emit compatible manifests.

Scope:

- manifest JSON Schema
- canonical JSON and hashing rules
- required vs optional field profiles
- extension namespace rules
- TypeScript types
- validation library
- fixture manifests
- trust-state enums
- redaction model

Success signal:

- a manifest can describe a complete chat-to-video workflow with timecoded segment mappings
- two different stacks can validate the same fixture set and agree on results

## MVP 2: Chat-to-Video Source Mapping

Goal:

Capture a real workflow end to end without signing complexity yet.

Scope:

- original chat or source selection
- user prompt
- generated script
- timeline segmentation
- user edits
- guardrail events
- render event
- final asset hash

Success signal:

- a sample devotional or educational clip can show exactly which line came from which source and what was edited

## MVP 3: Trust Page and QR

Goal:

Make the protocol understandable to normal users.

Scope:

- trust code generation
- public trust page
- timeline segment inspector
- source list
- AI involvement summary
- guardrail summary
- QR target URL

Success signal:

- a user can scan or open a trust link and understand how a sample video was made

## MVP 4: C2PA Integration

Goal:

Bind VVMP to interoperable provenance standards.

Scope:

- C2PA manifest creation
- AI disclosure assertion support
- custom VVMP assertion
- local extraction and verification
- embedded and sidecar outputs

Success signal:

- provenance can be extracted from the media asset and checked against the VVMP record

## Cross-Stack Release Requirement

VVMP should not call itself interoperable until it has:

- a language-neutral protocol specification
- conformance fixtures
- at least two independent implementations
- one implementation that is not JavaScript or TypeScript

## MVP 5: Remote Registry and Recovery

Goal:

Support platform-stripped or re-encoded copies.

Scope:

- remote manifest store
- comparison of embedded vs remote record
- rendition tracking
- optional soft-binding hooks

Success signal:

- a redistributed copy can still recover a trustworthy creation record by trust code or other supported lookup path

Reference implementation note:

- the repository now includes a first recovery lane through trust-code and QR-target recovery cards, rendition comparison against observed copies, registry-backed watermark or fingerprint lookup hooks, and a reference PNG trustmark encode/decode path for watermark recovery

## Out of Scope for Initial MVP

- mandatory watermarking across every asset type
- all possible media formats
- every policy pack type
- fully decentralized registry infrastructure
- full mobile SDKs
- deep moderation workflow automation

## Recommended Demo Path

The strongest demo is a single sample app that exports:

- a vertical short video
- a VVMP manifest JSON file
- a trust page URL
- a trust code
- a timeline showing source mapping, edits, and guardrail checks

This demo should work even before full C2PA embedding.

Reference implementation note:

- the repository now includes a first end-to-end reference workflow in `examples/chat-to-video`

## MVP Acceptance Checklist

- manifest schema published
- sample manifests published
- capture SDK can emit valid manifests
- CLI can validate and summarize
- viewer can render trust pages from fixtures
- registry can resolve trust code to manifest
- at least one example workflow is fully documented
