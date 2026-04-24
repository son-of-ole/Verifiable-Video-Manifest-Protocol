# @vvmp/trust-capture-sdk

Event-first capture SDK for VVMP.

Use this package to log sources, prompts, tools, assets, generations, segments, edits, guardrails, rights, renders, publications, and policy-pack output before building a deterministic VVMP manifest.

```sh
npm install @vvmp/trust-capture-sdk
```

```ts
import { createTrustSession } from "@vvmp/trust-capture-sdk";

const trust = createTrustSession({ sessionId: "render-job-123" });
trust.logPrompt({
  prompt_id: "prompt_001",
  prompt_type: "user_prompt",
  visibility: "public",
  text: "Create a short video"
});
```

See the root repository package integration guide for the full package map.
