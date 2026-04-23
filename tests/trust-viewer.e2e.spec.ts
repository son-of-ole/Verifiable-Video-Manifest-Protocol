import { expect, test } from "@playwright/test";

test.describe("VVMP trust viewer", () => {
  test("lists fixture-backed trust pages on the home route", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: "Verifiable Video Manifest Protocol" })
    ).toBeVisible();
    await expect(page.getByTestId("viewer-goals")).toContainText(
      "trust-code and manifest-id routes"
    );
    await expect(page.getByTestId("fixture-index")).toContainText("Faith Chat To Video");
    await expect(page.getByTestId("fixture-index")).toContainText("Education Redacted");
    await expect(page.getByTestId("fixture-index")).toContainText("Signed Manifest Demo");
  });

  test("trust-code route renders recovery and verifier sections", async ({ page }) => {
    await page.goto("/");

    const registryFixture = page.getByTestId("fixture-item-newsroom-registry");
    await expect(registryFixture).toBeVisible();
    await registryFixture.getByRole("link", { name: "Open Trust-Code Route" }).click();

    await expect(page).toHaveURL(/\/v\//);
    await expect(page.getByTestId("route-chip")).toContainText("trust code");
    await expect(page.getByTestId("trust-summary")).toContainText("Trust Summary");
    await expect(page.getByTestId("timeline-source-map")).toContainText("Timeline Source Map");
    await expect(page.getByTestId("recovery-record")).toContainText("Visible trust code");
    await expect(page.getByTestId("recovery-record")).toContainText("QR target URL");
    await expect(page.getByTestId("technical-json-pane")).toContainText("Raw manifest");
  });

  test("redacted manifest route preserves public redaction cues", async ({ page }) => {
    await page.goto("/");

    const redactedFixture = page.getByTestId("fixture-item-education-redacted");
    await expect(redactedFixture).toBeVisible();
    await redactedFixture.getByRole("link", { name: "Open Manifest Route" }).click();

    await expect(page).toHaveURL(/\/manifest\//);
    await expect(page.getByTestId("route-chip")).toContainText("manifest id");
    await expect(page.getByTestId("redaction-notices")).toContainText(/withheld|limited|redacted/i);
    await expect(page.getByTestId("source-list")).toContainText("visibility:");
    await expect(page.getByTestId("publication-signature")).toContainText("Trust page");
  });
});
