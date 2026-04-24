# @vvmp/trust-core

Core TypeScript/JavaScript helpers for VVMP manifests.

Use this package for manifest types, canonical JSON, semantic validation, manifest summaries, trust-state derivation, and rendition recovery comparison.

```sh
npm install @vvmp/trust-core
```

```ts
import { validateManifest, summarizeManifest } from "@vvmp/trust-core";

const validation = validateManifest(manifest);
if (validation.valid) {
  console.log(summarizeManifest(manifest));
}
```

See the root repository package integration guide for the full package map.
