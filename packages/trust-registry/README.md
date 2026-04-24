# @vvmp/trust-registry

Reference file-backed registry implementation for VVMP.

Use this package for local or embedded registry workflows that need manifest publication, trust-code resolution, asset hash lookup, version history, verification responses, and recovery-locator registration.

```sh
npm install @vvmp/trust-registry
```

```ts
import { createFileRegistry } from "@vvmp/trust-registry";

const registry = createFileRegistry({ rootDir: ".vvmp-registry" });
```

See the root repository package integration guide for the full package map.
