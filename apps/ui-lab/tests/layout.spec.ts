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
