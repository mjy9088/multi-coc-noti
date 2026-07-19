import { expect, test } from "@playwright/test";

const villageId = (index: number) => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
const accounts = Array.from({ length: 36 }, (_, index) => ({
  id: villageId(index + 1),
  label: `Village ${String(index + 1).padStart(2, "0")}`,
  playerTag: `#TEST${index + 1}`,
  color: index % 2 ? "#397a5d" : "#2e638d",
  tags: index % 3 ? ["Farm"] : ["War"],
  resourceStatus: "sufficient",
  resourceStatusUpdatedAt: "2026-07-19T00:00:00.000Z",
  resourcePreparationMinutes: 60,
}));

async function expectRouteTabsBelowHeader(page: import("@playwright/test").Page) {
  const headerBounds = await page.locator(".app-shell-header").boundingBox();
  const tabsBounds = await page.locator(".settings-tabs").boundingBox();
  expect(headerBounds).not.toBeNull();
  expect(tabsBounds).not.toBeNull();
  expect(tabsBounds?.y ?? -1).toBeGreaterThanOrEqual((headerBounds?.y ?? 0) + (headerBounds?.height ?? 0) - 1);
  expect((tabsBounds?.y ?? -1) + (tabsBounds?.height ?? 0)).toBeLessThanOrEqual(await page.evaluate(() => innerHeight));
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("multi-coc-admin-token", "test-token"));
  await page.route("**/api/dashboard", (route) =>
    route.fulfill({ json: { generatedAt: "2026-07-19T00:00:00.000Z", accounts: [] } }),
  );
  await page.route("**/api/admin/accounts", (route) => route.fulfill({ json: { accounts } }));
  await page.route("**/api/admin/upgrades", (route) => route.fulfill({ json: { upgrades: [] } }));
  await page.route("**/api/admin/dashboard-settings", (route) =>
    route.fulfill({ json: { groupOrder: ["War", "Farm"] } }),
  );
});

test("[UI-SETTINGS-001] pointer scrolling moves the page before the route frame becomes fixed", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "desktop composition assertion");
  await page.goto("/settings/groups");
  const frame = page.locator(".ui-sticky-route-frame");
  await frame.hover();
  await page.mouse.wheel(0, 500);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
});

test("[UI-SETTINGS-001] measured sticky chrome keeps the desktop settings viewport fully visible", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "desktop composition assertion");
  await page.goto("/settings/villages");
  await expect(page.locator(".settings-village-picker > button")).toHaveCount(36);

  const settingsPage = page.locator(".settings-page");
  await settingsPage.evaluate((element) => {
    element.dataset.persistenceProbe = "mounted";
  });
  await page.locator(".settings-village-picker > button").first().click();
  await expect(page).toHaveURL(new RegExp(`/settings/villages/${villageId(1)}$`));
  await expect(page.locator(".settings-village-editor-card")).toBeVisible();
  await expect(page.locator(".village-editor-scroll")).toHaveCSS("overflow-y", "auto");
  await expect(page.locator("#village-settings-form input").first()).toBeInViewport();
  expect(
    await page
      .locator("#village-settings-form input")
      .first()
      .evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2) === element;
      }),
  ).toBe(true);
  await page.locator(".village-editor-scroll").evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight }));
  await expectRouteTabsBelowHeader(page);
  await expect
    .poll(async () => {
      const tabsAtEnd = await page.locator(".settings-tabs-sticky").boundingBox();
      const layoutAtEnd = await page.locator(".settings-village-layout").boundingBox();
      const viewportHeight = await page.evaluate(() => innerHeight);
      if (!tabsAtEnd || !layoutAtEnd) return false;
      return (
        layoutAtEnd.y >= tabsAtEnd.y + tabsAtEnd.height && viewportHeight - layoutAtEnd.y - layoutAtEnd.height >= 15
      );
    })
    .toBe(true);
  await page.locator(".settings-tabs .ui-tab").nth(3).click();
  await expect(page).toHaveURL(/\/settings\/groups$/);
  await expect(settingsPage).toHaveAttribute("data-persistence-probe", "mounted");
});

test("[UI-SETTINGS-001] mobile village settings keep list and editor scroll ownership separate", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "mobile composition assertion");
  await page.goto("/settings/villages");
  const picker = page.locator(".settings-village-picker");
  await expect(picker.locator("> button")).toHaveCount(36);
  expect(await picker.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);

  await picker.locator("> button").first().click();
  const editor = page.locator(".settings-village-editor-card");
  await expect(editor).toBeVisible();
  await expect(editor).toHaveCSS("position", "fixed");
  await expect(editor).toHaveCSS("bottom", "0px");
  await expect(page.locator(".village-editor-scroll")).toHaveCSS("overflow-y", "auto");
  await expect(page.locator(".settings-action-bar")).toBeInViewport();
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight }));
  await expectRouteTabsBelowHeader(page);
});
