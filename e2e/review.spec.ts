import { expect, test } from "@playwright/test";

test("pick a match, a round, and jump to an event", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/isn't endorsed by Riot Games/)).toBeVisible();
  await expect(page.getByText("Sample data")).toBeVisible();

  await page.getByRole("button", { name: /Ascent 13–11 win/ }).click();
  await expect(page.getByRole("heading", { name: "Ascent" })).toBeVisible();
  await expect(page.getByText(/No known positions yet/)).toBeVisible();

  await page.getByRole("tab", { name: /^Round 3:/ }).click();
  await expect(page.getByText("Round 3", { exact: true })).toBeVisible();

  await page
    .getByRole("button", { name: /^Jump to/ })
    .first()
    .click();
  await expect(page.getByText(/Known positions · \d:\d\d kill/)).toBeVisible();
  await expect(page.getByRole("img", { name: /minimap with player positions/ })).toBeVisible();

  await page.getByRole("tab", { name: "Economy" }).click();
  await expect(page.getByText("Your team")).toBeVisible();
});

test("the API refuses a match the player was not in", async ({ page }) => {
  const res = await page.request.get("/api/matches/fx-match-0004-not-own");
  expect(res.status()).toBe(404);
});
