import { expect, test } from "@playwright/test";

test("pick a match, a round, and jump to an event", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/isn't endorsed by Riot Games/)).toBeVisible();

  await page.getByRole("button", { name: /Ascent.*13–11/ }).click();
  await expect(page.getByRole("heading", { name: /Ascent · Round 1/ })).toBeVisible();
  await expect(page.getByText(/No positions known yet/)).toBeVisible();

  await page.getByRole("tab").nth(2).click();
  await expect(page.getByRole("heading", { name: /Round 3/ })).toBeVisible();

  await page
    .getByRole("button", { name: /^Jump to/ })
    .first()
    .click();
  await expect(page.getByText(/Known positions at \d:\d\d \(kill\)/)).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
});

test("the API refuses a match the player was not in", async ({ page }) => {
  const res = await page.request.get("/api/matches/fx-match-0004-not-own");
  expect(res.status()).toBe(404);
});
