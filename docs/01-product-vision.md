# VVMP Product Vision

## Working Name

**Verifiable Video Manifest Protocol (VVMP)**

VVMP is the preferred name for the project and protocol. Use the full name in formal documentation and `VVMP` in product, code, and developer references where brevity helps.

## Positioning

VVMP should be built as a trust and provenance infrastructure layer for video, not as a single end-user video creation app.

It should be usable by:

- AI video generators
- creator platforms
- newsrooms
- education tools
- faith-based apps
- marketplaces
- moderation and safety platforms
- archives and libraries

## Problem Statement

Current AI video systems usually expose only partial metadata:

- maybe a watermark
- maybe a model disclosure
- maybe a prompt history inside a private dashboard

That is not enough for durable provenance. A viewer, moderator, journalist, or developer often cannot answer basic questions about how the video was made, what it is based on, whether it was later altered, or whether the visible disclosure can be independently verified.

VVMP addresses that gap by defining an open manifest format and toolchain for:

- structured provenance capture
- signed creation records
- timecoded source mapping
- public trust pages
- independent verification
- privacy-aware redaction

## Non-Goals

VVMP should not:

- certify that content is true
- certify that content is official doctrine, official news, or official policy
- act as a moderation verdict by itself
- force public exposure of private prompts or private source material
- replace C2PA

## Core Promise

VVMP should make it possible to say:

> This video has a recorded provenance trail. You can inspect its sources, prompts, tools, edits, policy checks, and signature state. You do not need to trust the app's marketing claim alone.

## User Types

### 1. Creators

Need:

- easy export with trust metadata
- privacy controls
- simple public explanation of AI involvement

### 2. Viewers

Need:

- a plain-language trust page
- a scannable code or short lookup code
- understandable labels like quoted, paraphrased, AI-generated, or human-edited

### 3. Moderators and reviewers

Need:

- guardrail history
- model and tool disclosure
- rights and consent metadata
- technical verification state

### 4. Developers and integrators

Need:

- schemas
- SDKs
- CLI tooling
- a registry API
- C2PA interoperability

## Domain-Neutral Core, Domain-Specific Policy Packs

The core protocol should remain domain-neutral. Domain-specific trust logic belongs in policy packs.

Examples:

- `org.faith.lds`
- `org.news.election-integrity`
- `org.education.k12`
- `org.marketplace.product-claims`
- `org.health.medical-explainer`

This keeps VVMP broadly usable while still enabling strong, context-specific safety and provenance checks.

## Public UX Principles

VVMP should expose trust in layers:

### Level 1: Plain-language summary

Show:

- who created the video
- when it was created
- whether AI assisted
- whether a signed provenance record exists
- whether the asset matches the signed record

### Level 2: Timeline provenance

Show:

- segment-by-segment source mapping
- quote vs paraphrase vs explanation labels
- human edit markers
- guardrail outcomes
- model and tool disclosure

### Level 3: Technical verifier

Show:

- raw JSON
- signature validation results
- hashes
- redaction markers
- manifest version history
- embedded vs remote manifest comparisons

## Product Thesis

The best version of VVMP is not:

> We put a QR code on videos.

The best version is:

> Every AI-assisted video can ship with a signed, inspectable creation record that maps each part of the video back to its sources, prompts, tools, edits, policy checks, and human approvals.

## Open-Source Success Criteria

VVMP is succeeding if:

1. A third-party app can integrate the capture SDK without direct help.
2. A third-party verifier can validate a manifest without trusting the hosted trust page.
3. A creator can selectively redact private information while preserving evidence.
4. A viewer can understand the creation record without reading raw JSON.
5. A platform can recover provenance even after metadata stripping in at least some cases.
