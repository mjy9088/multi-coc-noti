import { expect, test } from "@playwright/test";

test("persistent App Router layout keeps state and DOM identity across catalogue routes", async ({ page }) => {
  await page.goto("/");
  const header = page.locator(".lab-header");
  const initialBox = await header.boundingBox();
  await page.locator("#layout-note").fill("route state stays here");
  await page.getByRole("button", { name: "Layout 0" }).click();
  await page.getByRole("button", { name: "Layout 1" }).click();
  await page.evaluate(() => {
    (window as typeof window & { __uiLabHeader?: Element | null }).__uiLabHeader =
      document.querySelector(".lab-header");
  });

  await page.getByRole("link", { name: "Components" }).click();
  await expect(page).toHaveURL(/\/components$/);
  await expect(page.locator("#layout-note")).toHaveValue("route state stays here");
  await expect(page.getByRole("button", { name: "Layout 2" })).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        (window as typeof window & { __uiLabHeader?: Element | null }).__uiLabHeader ===
        document.querySelector(".lab-header"),
    ),
  ).toBe(true);
  expect((await header.boundingBox())?.height).toBe(initialBox?.height);

  await page.getByRole("link", { name: "Route patterns" }).click();
  await expect(page).toHaveURL(/\/patterns$/);
  await expect(page.locator("#layout-note")).toHaveValue("route state stays here");
});

test("owned interactive primitives expose keyboard and feedback behavior", async ({ page }) => {
  await page.goto("/components");

  const actionBarSection = page.getByRole("heading", { name: "Action bar" }).locator("..");
  expect(
    await actionBarSection.evaluate((section) => {
      const actionBar = section.querySelector<HTMLElement>(".ui-action-bar-sticky");
      return actionBar && getComputedStyle(actionBar).backgroundColor === getComputedStyle(section).backgroundColor;
    }),
    "custom surfaces should pass their context color to sticky actions",
  ).toBe(true);

  const upgradesTab = page.getByRole("tab", { name: "Upgrades" });
  await upgradesTab.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Syncs" })).toHaveAttribute("data-state", "active");
  await expect(page.getByText("Showing syncs content.")).toBeVisible();

  const dialogTrigger = page.getByRole("button", { name: "Open resource question" });
  await dialogTrigger.click();
  const dialog = page.getByRole("dialog", { name: "Resources for the next upgrade?" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(dialogTrigger).toBeFocused();

  await page.getByRole("button", { name: "Persistent error" }).click();
  const toastAlert = page.getByRole("alert").filter({ hasText: "Could not save settings" });
  await expect(toastAlert).toBeVisible();
  await toastAlert.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved after retry" })).toBeVisible();
});

test("flow simulator switches fixtures without API or layout state loss", async ({ page }) => {
  await page.goto("/flows/import");
  await page.locator("#layout-note").fill("keep flow context");
  await page.getByRole("combobox", { name: "Viewport" }).selectOption("mobile");
  await expect(page.locator(".flow-stage")).toHaveAttribute("data-viewport", "mobile");

  await page.getByRole("button", { name: "Review export" }).click();
  await expect(page.getByRole("heading", { name: "Changes since the previous export" })).toBeVisible();
  await page.getByRole("combobox", { name: "Scenario" }).selectOption("invalid-json");
  await expect(page.getByText("This is not complete export JSON.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Review export" })).toBeDisabled();

  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(page).toHaveURL(/\/flows\/settings$/);
  await expect(page.locator("#layout-note")).toHaveValue("keep flow context");
  await expect(page.getByRole("heading", { name: "Settings that acknowledge every save" })).toBeVisible();
});

test("composition studies compare variants without treating one layout as a regression contract", async ({ page }) => {
  await page.goto("/compositions/import");
  await expect(
    page.getByText("Can users review meaningful changes quickly without losing their previous task?"),
  ).toBeVisible();
  await expect(page.getByText("preferred", { exact: true })).toBeVisible();
  expect(
    await page.locator(".composition-surface").evaluate((surface) => {
      const header = surface.querySelector<HTMLElement>(".composition-list-header");
      return header && getComputedStyle(header).backgroundColor === getComputedStyle(surface).backgroundColor;
    }),
    "sticky chrome should retain its surface context through transparent composition wrappers",
  ).toBe(true);

  await page.getByRole("combobox", { name: "Variant" }).selectOption("dialog");
  await expect(page.locator(".composition-stage")).toHaveAttribute("data-variant", "dialog");
  await expect(page.getByText("exploring", { exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "Viewport" }).selectOption("mobile");
  await expect(page.locator(".composition-stage")).toHaveAttribute("data-viewport", "mobile");

  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await expect(page).toHaveURL(/\/compositions\/dashboard$/);
  await expect(page.getByRole("heading", { name: "What should Dashboard answer first?" })).toBeVisible();
  await page.getByRole("combobox", { name: "Data scale" }).selectOption("many");
  await expect(page.getByText("30 results · availability sorted")).toBeVisible();

  await page.getByRole("link", { name: "Village settings", exact: true }).click();
  await page.getByRole("combobox", { name: "Viewport" }).selectOption("desktop");
  const settingsPanels = page.locator(".composition-settings > *");
  await expect(settingsPanels).toHaveCount(2);
  const panelsHaveEqualHeight = async () => {
    const heights = await settingsPanels.evaluateAll((elements) =>
      elements.map((element) => element.getBoundingClientRect().height),
    );
    return heights.length === 2 && Math.abs(heights[0] - heights[1]) <= 1;
  };
  expect(await panelsHaveEqualHeight(), "form-first panes should share one row height").toBe(true);
  await page.getByRole("combobox", { name: "Variant" }).selectOption("list-first");
  expect(await panelsHaveEqualHeight(), "list-first panes should share one row height").toBe(true);
  await page.getByRole("combobox", { name: "Selection state" }).selectOption("none");
  await expect(page.getByText("Select a village to edit", { exact: true })).toBeVisible();
  await expect(page.getByText("36 accounts")).toBeVisible();
  await page.getByRole("combobox", { name: "Viewport" }).selectOption("mobile");
  const villageList = page.getByRole("complementary", { name: "Village list" });
  await expect(villageList).toBeVisible();
  await expect(page.getByText("Select a village to edit", { exact: true })).toBeHidden();
  expect(
    await villageList.evaluate((element) => {
      const master = element.closest<HTMLElement>(".composition-mobile-master-detail");
      const list = element.querySelector<HTMLElement>(".composition-scroll-list");
      if (!master || !list) return false;
      const remainingSpace = master.getBoundingClientRect().bottom - element.getBoundingClientRect().bottom;
      return remainingSpace <= 17 && list.scrollHeight > list.clientHeight;
    }),
    "the mobile village pane should fill the canvas and own its long-list overflow",
  ).toBe(true);
  expect(
    await villageList.evaluate((element) => {
      const header = element.querySelector<HTMLElement>(".composition-list-header");
      return header && getComputedStyle(header).backgroundColor === getComputedStyle(element).backgroundColor;
    }),
    "sticky list chrome should inherit its containing surface color",
  ).toBe(true);
  await page.getByRole("combobox", { name: "Variant" }).selectOption("list-first");
  await expect(villageList).toBeVisible();
  await villageList.getByRole("button", { name: /Main village 1 #V001$/ }).click();
  const details = page.getByRole("region", { name: "Village details" });
  await expect(details).toBeVisible();
  expect(
    await details.evaluate((element) => {
      const master = element.closest<HTMLElement>(".composition-mobile-master-detail");
      return master && Math.abs(master.getBoundingClientRect().bottom - element.getBoundingClientRect().bottom) <= 1;
    }),
    "a top-corner-only sheet should sit flush against its bottom edge",
  ).toBe(true);
  await expect(page.getByRole("textbox", { name: "Display name" })).toBeVisible();
  const detailsScroller = details.locator(":scope > .flow-pane");
  expect(
    await detailsScroller.evaluate((element) => element.scrollHeight > element.clientHeight),
    "the mobile settings sheet should own overflow for its long form",
  ).toBe(true);
  expect(
    await page.evaluate(() => {
      const header = document.querySelector(".composition-mobile-list-base .composition-list-header");
      const backdrop = document.querySelector(".composition-picker-backdrop");
      const sheet = document.querySelector(".composition-mobile-detail-sheet");
      return header && backdrop && sheet
        ? Number(getComputedStyle(header).zIndex) < Number(getComputedStyle(backdrop).zIndex) &&
            Number(getComputedStyle(backdrop).zIndex) < Number(getComputedStyle(sheet).zIndex)
        : false;
    }),
    "the list header must stay below the detail backdrop and sheet",
  ).toBe(true);
  await detailsScroller.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
  const actionBar = details.locator(".ui-action-bar-sticky");
  await expect(actionBar).toBeVisible();
  expect(
    await actionBar.evaluate((element) => {
      const style = getComputedStyle(element);
      const parentStyle = element.parentElement ? getComputedStyle(element.parentElement) : null;
      const backdropStyle = getComputedStyle(element, "::before");
      const actionRect = element.getBoundingClientRect();
      const scrollerRect = element.parentElement?.getBoundingClientRect();
      const coveredBottom = actionRect.bottom - Number.parseFloat(backdropStyle.bottom);
      return (
        style.position === "sticky" &&
        style.backgroundColor !== "transparent" &&
        style.backgroundColor !== "rgba(0, 0, 0, 0)" &&
        style.backgroundColor === parentStyle?.backgroundColor &&
        Number.parseFloat(backdropStyle.right) < 0 &&
        scrollerRect !== undefined &&
        coveredBottom >= scrollerRect.bottom - 1
      );
    }),
    "sticky actions should cover the scroll container's side and bottom padding with an opaque surface",
  ).toBe(true);
  await expect(details.getByRole("button", { name: "Save settings" })).toBeVisible();
  await page.getByRole("button", { name: "Close settings" }).click();
  await expect(details).toBeHidden();
  await expect(villageList).toBeVisible();
});
