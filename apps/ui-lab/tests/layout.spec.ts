import { expect, test } from "@playwright/test";

test("persistent App Router layout keeps state and DOM identity across catalogue routes", async ({ page }) => {
  await page.goto("/");
  await page.locator("#layout-note").fill("route state stays here");
  await page.evaluate(() => {
    (window as typeof window & { __uiLabHeader?: Element | null }).__uiLabHeader =
      document.querySelector(".lab-header");
  });

  await page.getByRole("link", { name: "Components" }).click();
  await expect(page).toHaveURL(/\/components$/);
  await expect(page.locator("#layout-note")).toHaveValue("route state stays here");
  expect(
    await page.evaluate(
      () =>
        (window as typeof window & { __uiLabHeader?: Element | null }).__uiLabHeader ===
        document.querySelector(".lab-header"),
    ),
  ).toBe(true);
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

test("flow simulator switches viewport and scenario fixtures", async ({ page }) => {
  await page.goto("/flows/import");
  await page.getByRole("combobox", { name: "Viewport" }).selectOption("mobile");
  await expect(page.locator(".flow-stage")).toHaveAttribute("data-viewport", "mobile");

  await page.getByRole("button", { name: "Review export" }).click();
  await expect(page.getByRole("heading", { name: "Changes since the previous export" })).toBeVisible();
  await page.getByRole("combobox", { name: "Scenario" }).selectOption("invalid-json");
  await expect(page.getByText("This is not complete export JSON.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Review export" })).toBeDisabled();
});
