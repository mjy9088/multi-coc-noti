import { expect, test } from "@playwright/test";

const village = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Main village",
  tag: "#TEST1",
  townHall: 17,
  level: 250,
  color: "#397a5d",
  tags: ["War"],
  online: true,
  lastSeen: "2026-07-20T00:00:00.000Z",
  builders: { free: 2, total: 6 },
  upgradeSlots: { laboratory: { available: false }, petHouse: { available: true }, builderBase: null },
  upgrades: [],
};

test.beforeEach(async ({ page }) => {
  await page.route("**/api/dashboard", (route) =>
    route.fulfill({ json: { generatedAt: "2026-07-20T00:00:00.000Z", accounts: [village], groupOrder: ["War"] } }),
  );
  await page.route("**/api/upgrades?**", (route) =>
    route.fulfill({
      json: {
        villages: [{ id: village.id, name: village.name, playerTag: village.tag, color: village.color }],
        upgrades: [],
        nextBefore: null,
      },
    }),
  );
  await page.route("**/api/syncs?**", (route) =>
    route.fulfill({
      json: {
        villages: [{ id: village.id, name: village.name, playerTag: village.tag, color: village.color }],
        syncs: [],
        nextBefore: null,
      },
    }),
  );
});

test("[UI-ROUTES-001] dashboard, village detail, and history compose owned UI primitives without horizontal overflow", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".village-card.ui-card")).toHaveCount(1);
  await expect(page.locator(".dashboard-filters .ui-input")).toHaveCount(1);
  await expect(page.locator(".dashboard-availability-field .ui-radio-group")).toBeVisible();
  await expect(page.locator(".account-tabs.ui-toggle-group")).toBeVisible();
  await page.locator(".village-card-link").click();
  await expect(page).toHaveURL(new RegExp(`/villages/${village.id}$`));
  await expect(page.locator(".village-detail-card.ui-card")).not.toHaveCount(0);
  await expect(page.locator(".village-detail-actions .ui-button")).toHaveCount(3);

  await page.goto("/history/upgrades");
  await expect(page.locator(".history-sections.ui-tabs")).toBeVisible();
  await expect(page.locator(".history-filters .ui-select")).toHaveCount(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(
    true,
  );
});
