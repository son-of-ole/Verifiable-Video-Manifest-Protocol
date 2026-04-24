# @vvmp/trust-registry-client

HTTP client for VVMP-compatible registry APIs.

Use this package when an app needs to publish manifests, fetch manifests, resolve trust codes, verify asset hashes, or register recovery locators through a remote registry.

```sh
npm install @vvmp/trust-registry-client
```

```ts
import { createRegistryClient } from "@vvmp/trust-registry-client";

const registry = createRegistryClient({ baseUrl: "https://registry.example.com" });
```

See the root repository package integration guide for the full package map.
