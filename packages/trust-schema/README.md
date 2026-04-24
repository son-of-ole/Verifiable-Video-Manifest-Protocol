# @vvmp/trust-schema

Packaged VVMP schema artifacts and helpers.

Use this package when another project needs the JSON Schemas, JSON-LD context, registries, examples, or schema-level validation without knowing the repository layout.

```sh
npm install @vvmp/trust-schema
```

```ts
import { readManifestSchema, validateSchemaManifest } from "@vvmp/trust-schema";

const schema = await readManifestSchema();
const result = validateSchemaManifest(manifest);
```

See the root repository package integration guide for the full package map.
