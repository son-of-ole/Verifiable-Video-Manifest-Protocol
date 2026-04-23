import { notFound } from "next/navigation";
import { ManifestView } from "../../components/manifest-view";
import { getViewerFixtureByManifestId, listViewerFixtures } from "../../lib/viewer-fixtures";

export async function generateStaticParams() {
  const fixtures = await listViewerFixtures();
  return fixtures.map((fixture) => ({
    manifestId: fixture.manifestRouteParam
  }));
}

export default async function ManifestIdPage({
  params
}: {
  params: Promise<{ manifestId: string }>;
}) {
  const { manifestId } = await params;
  const fixture = await getViewerFixtureByManifestId(decodeURIComponent(manifestId));

  if (!fixture) {
    notFound();
  }

  return <ManifestView fixture={fixture} routeMode="manifest" />;
}
