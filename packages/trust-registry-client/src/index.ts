import type {
  FileRegistry,
  GetManifestOptions,
  ManifestEnvelope,
  ManifestVersionHistory,
  PublishManifestInput,
  PublishManifestResponse,
  RecoveryLocatorMethod,
  RecoveryLocatorResolution,
  RegisterRecoveryLocatorInput,
  TrustCodeResolution,
  VerifyRequest,
  VerifyResponse
} from "@vvmp/trust-registry";

export type RegistryClientConfig = {
  baseUrl: string;
  apiPathPrefix?: string;
  apiToken?: string;
  connectionClose?: boolean;
  headers?: Record<string, string>;
  fetchImpl?: typeof fetch;
};

export type RegistryProblemResponse = {
  title?: string;
  status?: number;
  code?: string;
  [key: string]: unknown;
};

export class RegistryClientError extends Error {
  status: number;
  code?: string;
  problem?: RegistryProblemResponse;

  constructor(status: number, message: string, code?: string, problem?: RegistryProblemResponse) {
    super(message);
    this.name = "RegistryClientError";
    this.status = status;
    this.code = code;
    this.problem = problem;
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

function normalizeApiPrefix(prefix?: string): string {
  const raw = prefix ?? "/api/v1";
  const trimmed = raw.replace(/^\/+|\/+$/g, "");
  return `/${trimmed}`;
}

function buildUrl(
  config: RegistryClientConfig,
  path: string,
  searchParams?: Record<string, string | undefined>
): string {
  const url = new URL(`${normalizeBaseUrl(config.baseUrl)}${normalizeApiPrefix(config.apiPathPrefix)}${path}`);

  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (typeof value === "string" && value.length > 0) {
        url.searchParams.set(key, value);
      }
    }
  }

  return url.toString();
}

function getFetchImpl(config: RegistryClientConfig): typeof fetch {
  if (typeof config.fetchImpl === "function") {
    return config.fetchImpl;
  }

  if (typeof fetch === "function") {
    return fetch;
  }

  throw new Error("No fetch implementation is available for @vvmp/trust-registry-client.");
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const raw = await response.text();
  if (raw.length === 0) {
    return null;
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}

function createHeaders(
  config: RegistryClientConfig,
  init: {
    json?: boolean;
  } = {}
): Headers {
  const headers = new Headers(config.headers ?? {});

  if (config.apiToken) {
    headers.set("authorization", `Bearer ${config.apiToken}`);
  }

  if (config.connectionClose) {
    headers.set("connection", "close");
  }

  if (init.json) {
    headers.set("content-type", "application/json");
    headers.set("accept", "application/json, application/problem+json");
  } else if (!headers.has("accept")) {
    headers.set("accept", "application/json, application/problem+json");
  }

  return headers;
}

async function requestJson<T>(
  config: RegistryClientConfig,
  input: {
    method: "GET" | "POST";
    path: string;
    searchParams?: Record<string, string | undefined>;
    body?: unknown;
  }
): Promise<T> {
  const fetchImpl = getFetchImpl(config);
  const response = await fetchImpl(buildUrl(config, input.path, input.searchParams), {
    method: input.method,
    headers: createHeaders(config, { json: input.body !== undefined }),
    body: input.body !== undefined ? JSON.stringify(input.body) : undefined
  });

  const body = await parseResponseBody(response);

  if (!response.ok) {
    const problem =
      typeof body === "object" && body !== null ? (body as RegistryProblemResponse) : undefined;
    throw new RegistryClientError(
      response.status,
      problem?.title ?? response.statusText ?? "Registry request failed.",
      problem?.code,
      problem
    );
  }

  return body as T;
}

export function createRegistryClient(config: RegistryClientConfig): FileRegistry {
  return {
    async publishManifest(input: PublishManifestInput): Promise<PublishManifestResponse> {
      return requestJson<PublishManifestResponse>(config, {
        method: "POST",
        path: "/manifests",
        body: input
      });
    },

    async getManifestById(
      manifestId: string,
      options: GetManifestOptions = {}
    ): Promise<ManifestEnvelope> {
      return requestJson<ManifestEnvelope>(config, {
        method: "GET",
        path: `/manifests/${encodeURIComponent(manifestId)}`,
        searchParams: {
          view: options.view,
          version: options.version
        }
      });
    },

    async getManifestVersions(manifestId: string): Promise<ManifestVersionHistory> {
      return requestJson<ManifestVersionHistory>(config, {
        method: "GET",
        path: `/manifests/${encodeURIComponent(manifestId)}/versions`
      });
    },

    async resolveTrustCode(trustCode: string): Promise<TrustCodeResolution> {
      return requestJson<TrustCodeResolution>(config, {
        method: "GET",
        path: `/trust-codes/${encodeURIComponent(trustCode)}`
      });
    },

    async getManifestByTrustCode(
      trustCode: string,
      options: GetManifestOptions = {}
    ): Promise<ManifestEnvelope> {
      const resolution = await this.resolveTrustCode(trustCode);
      return this.getManifestById(resolution.manifest_id, {
        view: options.view,
        version: options.version ?? resolution.current_version_id
      });
    },

    async getAssetByHash(algorithm: string, value: string): Promise<VerifyResponse> {
      return requestJson<VerifyResponse>(config, {
        method: "GET",
        path: `/assets/${encodeURIComponent(algorithm)}/${encodeURIComponent(value)}`
      });
    },

    async registerRecoveryLocator(
      input: RegisterRecoveryLocatorInput
    ): Promise<RecoveryLocatorResolution> {
      return requestJson<RecoveryLocatorResolution>(config, {
        method: "POST",
        path: "/recovery-locators",
        body: input
      });
    },

    async getRecoveryLocator(
      method: RecoveryLocatorMethod,
      value: string
    ): Promise<RecoveryLocatorResolution> {
      return requestJson<RecoveryLocatorResolution>(config, {
        method: "GET",
        path: `/recovery-locators/${encodeURIComponent(method)}/${encodeURIComponent(value)}`
      });
    },

    async verify(request: VerifyRequest): Promise<VerifyResponse> {
      return requestJson<VerifyResponse>(config, {
        method: "POST",
        path: "/verify",
        body: request
      });
    }
  };
}

export type {
  FileRegistry,
  GetManifestOptions,
  ManifestEnvelope,
  ManifestVersionEntry,
  ManifestVersionHistory,
  PublishManifestInput,
  PublishManifestResponse,
  RecoveryLocatorMethod,
  RecoveryLocatorResolution,
  RegisterRecoveryLocatorInput,
  RegistryAssetReference,
  RegistryRecoveryLocatorReference,
  TrustCodeResolution,
  VerifyRequest,
  VerifyResponse
} from "@vvmp/trust-registry";
