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
  await page.route("**/api/villages", (route) => route.fulfill({ json: { accounts: [village] } }));
  await page.route("**/api/settings/upgrades", (route) => route.fulfill({ json: { upgrades: [] } }));
  await page.route("**/api/settings/dashboard", (route) => route.fulfill({ json: { groupOrder: ["War"] } }));
  await page.route("**/api/notification-channels", (route) => route.fulfill({ json: { channels: [] } }));
});

test("[UI-ROUTES-001] dashboard, village detail, and history compose owned UI primitives without horizontal overflow", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".village-card.ui-card")).toHaveCount(1);
  await expect(page.locator(".dashboard-filters .ui-input")).toHaveCount(1);
  await expect(page.locator(".dashboard-availability-field .ui-radio-group")).toBeVisible();
  await expect(page.locator(".account-tabs.ui-toggle-group")).toBeVisible();
  await page.locator(".app-quick-paste").click();
  await expect(page.locator(".quick-paste-dialog")).toBeVisible();
  await expect(page.locator(".quick-paste-dialog textarea")).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  await page.keyboard.press("Escape");
  await expect(page.locator(".quick-paste-dialog")).toBeHidden();
  await expect(page).toHaveURL(/\/$/);
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

test("[UI-ROUTES-001] a long Quick Paste review scrolls to its final action", async ({ page }) => {
  const upgrades = Array.from({ length: 12 }, (_, index) => ({
    id: `upgrade-${index}`,
    name: `Long upgrade ${index + 1}`,
    type: "building",
    level: index + 1,
    nextLevel: index + 2,
    finishAt: "2026-07-22T00:00:00.000Z",
  }));
  await page.route("**/api/village-exports/preview", (route) =>
    route.fulfill({
      json: {
        tag: village.tag,
        exportedAt: "2026-07-21T00:00:00.000Z",
        townHall: village.townHall,
        builders: { total: 6, free: 1, regularTotal: 6 },
        upgradeSlots: village.upgradeSlots,
        upgrades,
        unknownDataIds: [],
        account: { id: village.id, label: village.name, color: village.color },
        isNew: false,
        changes: {
          hasPrevious: true,
          started: upgrades,
          ended: [],
          slots: [],
        },
      },
    }),
  );

  await page.goto("/");
  await page.locator(".app-quick-paste").click();
  await page.locator(".quick-paste-dialog textarea").fill('{"tag":"#TEST1"}');
  await expect(page.locator(".quick-paste-dialog .settings-preview")).toBeVisible();

  const body = page.locator(".quick-paste-dialog-body");
  expect(
    await body.evaluate((element) => ({ scrollHeight: element.scrollHeight, clientHeight: element.clientHeight })),
  ).toMatchObject({ scrollHeight: expect.any(Number), clientHeight: expect.any(Number) });
  expect(await body.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);

  await body.hover();
  await page.mouse.wheel(0, 10_000);
  await expect.poll(() => body.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await expect(page.locator(".quick-paste-dialog .settings-confirm-row")).toBeVisible();
});
