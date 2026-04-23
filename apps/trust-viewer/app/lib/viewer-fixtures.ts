import {
  summarizeManifest,
  validateManifest,
  type ManifestSummary,
  type ValidationResult,
  type VvmpManifest
} from "@vvmp/trust-core";
import educationLessonRedacted from "../../../../packages/trust-schema/examples/education-lesson.redacted.json";
import faithChatToVideoPublic from "../../../../packages/trust-schema/examples/faith-chat-to-video.public.json";
import newsroomExplainerPublic from "../../../../packages/trust-schema/examples/newsroom-explainer.public.json";
import validSignedManifest from "../../../../test-fixtures/conformance/valid/registry/valid-signed-manifest-001.json";

export type ViewerFixtureVersion = {
  version_id: string;
  published_at: string;
  note: string;
  current: boolean;
};

export type ViewerFixture = {
  id: string;
  label: string;
  description: string;
  manifest: VvmpManifest;
  summary: ManifestSummary;
  validation: ValidationResult;
  manifestRouteParam: string;
  trustRouteParam?: string;
  versionHistory: ViewerFixtureVersion[];
};

type ViewerFixtureSpec = {
  id: string;
  label: string;
  description: string;
  manifest: VvmpManifest;
  versionHistory?: ViewerFixtureVersion[];
};

const FIXTURE_SPECS: ViewerFixtureSpec[] = [
  {
    id: "faith-chat-to-video",
    label: "Faith Chat To Video",
    description:
      "A public example focused on segment-level sourcing, script generation, and automated guardrails.",
    manifest: faithChatToVideoPublic as VvmpManifest
  },
  {
    id: "education-redacted",
    label: "Education Redacted",
    description:
      "A redacted example showing how public trust pages can preserve proof without exposing private source material.",
    manifest: educationLessonRedacted as VvmpManifest
  },
  {
    id: "newsroom-registry",
    label: "Newsroom Registry Example",
    description:
      "A registry-backed example with a trust code and publication link that can be opened through the trust-code route.",
    manifest: newsroomExplainerPublic as VvmpManifest,
    versionHistory: [
      {
        version_id: "fixture_newsroom_v1",
        published_at: "2026-04-20T00:10:00Z",
        note: "Fixture-backed registry publication baseline.",
        current: true
      }
    ]
  },
  {
    id: "signed-manifest",
    label: "Signed Manifest Demo",
    description:
      "A signed registry-backed conformance fixture used to show signature disclosure and embedded-provenance states.",
    manifest: validSignedManifest as VvmpManifest,
    versionHistory: [
      {
        version_id: "fixture_signed_v1",
        published_at: "2026-04-20T00:40:00Z",
        note: "Signed and published provenance fixture.",
        current: true
      }
    ]
  }
];

function createDefaultVersionHistory(manifest: VvmpManifest): ViewerFixtureVersion[] {
  return [
    {
      version_id: `${manifest.manifest_id.split(":").at(-1) ?? "fixture"}_v1`,
      published_at: manifest.video.created_at,
      note:
        manifest.publication.status === "published"
          ? "Current fixture publication."
          : "Current fixture draft.",
      current: true
    }
  ];
}

const VIEWER_FIXTURES: ViewerFixture[] = FIXTURE_SPECS.map((spec) => ({
  id: spec.id,
  label: spec.label,
  description: spec.description,
  manifest: spec.manifest,
  summary: summarizeManifest(spec.manifest),
  validation: validateManifest(spec.manifest),
  manifestRouteParam: encodeURIComponent(spec.manifest.manifest_id),
  trustRouteParam: spec.manifest.video.trust_code
    ? encodeURIComponent(spec.manifest.video.trust_code)
    : undefined,
  versionHistory: spec.versionHistory ?? createDefaultVersionHistory(spec.manifest)
})).sort((left, right) => left.label.localeCompare(right.label));

export async function listViewerFixtures(): Promise<ViewerFixture[]> {
  return VIEWER_FIXTURES;
}

export async function getViewerFixtureByManifestId(
  manifestId: string
): Promise<ViewerFixture | null> {
  return VIEWER_FIXTURES.find((fixture) => fixture.manifest.manifest_id === manifestId) ?? null;
}

export async function getViewerFixtureByTrustCode(
  trustCode: string
): Promise<ViewerFixture | null> {
  return VIEWER_FIXTURES.find((fixture) => fixture.manifest.video.trust_code === trustCode) ?? null;
}
