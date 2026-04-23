# Chat-to-Video Example

This example demonstrates a complete VVMP workflow:

1. capture source, prompt, tool, asset, edit, render, and publication events
2. run a policy pack to create guardrail records
3. assemble a full internal VVMP manifest
4. publish the manifest to a local reference registry
5. fetch both public and full registry views
6. resolve the assigned trust code

## Inputs

- `inputs/selected-chat.md`
  A creator-selected chat excerpt that is treated as private in public views
- `inputs/supporting-source.md`
  A public source used for the explainer clip
- `inputs/user-prompt.txt`
  The creator prompt that drives the script-generation step

## Run

From the repo root:

```bash
npm run build
node examples/chat-to-video/run-example.mjs
```

The script writes outputs to `examples/chat-to-video/generated` by default.

You can override the output directory:

```bash
node examples/chat-to-video/run-example.mjs --out-dir /tmp/vvmp-chat-to-video
```

## Generated Outputs

- `event-log.json`
  The append-only capture-session event log
- `manifest.full.json`
  The internal manifest with private fields intact
- `manifest.public.json`
  The registry-sanitized public manifest
- `summary.json`
  A human-friendly manifest summary derived from the public record
- `publish-result.json`
  Registry publish response with manifest and trust-code links
- `trust-code-resolution.json`
  Trust-code lookup response
- `version-history.json`
  Append-only manifest lineage history
- `example-report.md`
  A short walkthrough of the run and key provenance details

## What This Example Proves

- a VVMP-compatible app can start from captured events instead of hand-authored JSON
- guardrails can be produced from an optional policy pack during capture
- one manifest can support both full and public views without inventing a separate dialect
- a registry can assign a trust code and serve stable retrieval links from the same manifest lineage

## Useful Follow-On Commands

After generating the example outputs:

```bash
npm run build:cli
node packages/trust-cli/dist/cli.js validate examples/chat-to-video/generated/manifest.public.json
node packages/trust-cli/dist/cli.js summarize examples/chat-to-video/generated/manifest.public.json
```
