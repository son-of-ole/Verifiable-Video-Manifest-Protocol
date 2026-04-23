import { notFound } from "next/navigation";
import { ManifestView } from "../../components/manifest-view";
import { getViewerFixtureByTrustCode, listViewerFixtures } from "../../lib/viewer-fixtures";

export async function generateStaticParams() {
  const fixtures = await listViewerFixtures();
  return fixtures
    .filter((fixture) => fixture.trustRouteParam)
    .map((fixture) => ({
      trustCode: fixture.trustRouteParam as string
    }));
}

export default async function TrustCodePage({
  params
}: {
  params: Promise<{ trustCode: string }>;
}) {
  const { trustCode } = await params;
  const fixture = await getViewerFixtureByTrustCode(decodeURIComponent(trustCode));

  if (!fixture) {
    notFound();
  }

  return <ManifestView fixture={fixture} routeMode="trust_code" />;
}
